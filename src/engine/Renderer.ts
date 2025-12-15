import { PhongShaderCode } from "../shaders/PhongShader";
import { Mesh } from "../engine/Mesh";
import {
  SkyboxRenderer,
  TrailRenderer,
  PostProcessRenderer,
  LightingSettings,
  DEFAULT_LIGHTING,
} from "./rendering";

export class Renderer {
  canvas: HTMLCanvasElement;
  device!: GPUDevice;
  context!: GPUCanvasContext;
  pipeline!: GPURenderPipeline;

  // sub-renderers
  private skyboxRenderer!: SkyboxRenderer;
  private trailRenderer!: TrailRenderer;
  private postProcessRenderer!: PostProcessRenderer;

  vertexBuffer: GPUBuffer | null = null;
  indexBuffer: GPUBuffer | null = null;
  uniformBuffer!: GPUBuffer;

  bindGroup!: GPUBindGroup;
  depthTexture!: GPUTexture;
  indexCount: number = 0;
  sampler!: GPUSampler;
  diffuseTexture!: GPUTexture;

  private lighting: LightingSettings = { ...DEFAULT_LIGHTING };

  private static readonly UNIFORM_FLOAT_COUNT = 28; // 16 (mvp) + 4 (light dir + shininess) + 4 (light color) + 4 (ambient)
  private static readonly UNIFORM_BUFFER_SIZE =
    Renderer.UNIFORM_FLOAT_COUNT * 4;

  private canvasFormat!: GPUTextureFormat;
  private colorTexture!: GPUTexture;
  private colorTextureView!: GPUTextureView;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async initialize() {
    if (!navigator.gpu) throw new Error("WebGPU não suportado");
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("Sem adaptador GPU");
    this.device = await adapter.requestDevice();

    this.context = this.canvas.getContext("webgpu") as GPUCanvasContext;
    this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.canvasFormat,
      alphaMode: "opaque",
    });

    this.skyboxRenderer = new SkyboxRenderer(this.device, this.canvasFormat);
    this.trailRenderer = new TrailRenderer(this.device, this.canvasFormat);
    this.postProcessRenderer = new PostProcessRenderer(
      this.device,
      this.canvasFormat
    );

    const shaderModule = this.device.createShaderModule({
      code: PhongShaderCode,
    });

    this.pipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 32,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x3" }, // pos
              { shaderLocation: 1, offset: 3 * 4, format: "float32x2" }, // uv
              { shaderLocation: 2, offset: 5 * 4, format: "float32x3" }, // normals
            ],
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [
          {
            format: this.canvasFormat,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          },
        ],
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
    });

    this.sampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      addressModeU: "repeat",
      addressModeV: "repeat",
      maxAnisotropy: 16,
    });

    this.createFallbackTexture();
    this.createRenderTargets();

    this.uniformBuffer = this.device.createBuffer({
      size: Renderer.UNIFORM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.updateBindGroup();

    const observer = new ResizeObserver(() => this.resize());
    observer.observe(this.canvas);
    this.resize();
  }

  public async setSkybox(urls: string[]) {
    await this.skyboxRenderer.loadSkybox(urls);
  }

  public setPostProcessTime(timeSeconds: number) {
    this.postProcessRenderer.setTime(timeSeconds);
  }

  public setFisheyeStrength(value: number) {
    this.postProcessRenderer.setFisheyeStrength(value);
  }

  public setScanLineIntensity(value: number) {
    this.postProcessRenderer.setScanLineIntensity(value);
  }

  public setRgbOffset(value: number) {
    this.postProcessRenderer.setRgbOffset(value);
  }

  public setVignetteIntensity(value: number) {
    this.postProcessRenderer.setVignetteIntensity(value);
  }

  public setWaveAmplitude(value: number) {
    this.postProcessRenderer.setWaveAmplitude(value);
  }

  public setWaveFrequency(value: number) {
    this.postProcessRenderer.setWaveFrequency(value);
  }

  public setJitterIntensity(value: number) {
    this.postProcessRenderer.setJitterIntensity(value);
  }

  public setLightDirection(dir: number[]) {
    this.lighting.direction = [dir[0], dir[1], dir[2]];
  }

  public setLightIntensity(intensity: number) {
    this.lighting.intensity = Math.max(0, intensity);
  }

  public setAmbientIntensity(intensity: number) {
    this.lighting.ambientIntensity = Math.max(0, intensity);
  }

  public setShininess(value: number) {
    this.lighting.shininess = Math.max(1, value);
  }

  private fallbackTexture!: GPUTexture;

  private createFallbackTexture() {
    this.fallbackTexture = this.device.createTexture({
      size: [1, 1],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const whitePixel = new Uint8Array([255, 255, 255, 255]);
    this.device.queue.writeTexture(
      { texture: this.fallbackTexture },
      whitePixel,
      { bytesPerRow: 4 },
      { width: 1, height: 1 }
    );
    this.diffuseTexture = this.fallbackTexture;
  }

  // Bind group cache
  private bindGroupCache = new Map<GPUTexture, GPUBindGroup>();

  public setTexture(texture: GPUTexture) {
    if (this.diffuseTexture === texture) return;

    this.diffuseTexture = texture;

    let cachedBindGroup = this.bindGroupCache.get(texture);
    if (cachedBindGroup) {
      this.bindGroup = cachedBindGroup;
    } else {
      this.updateBindGroup();
      this.bindGroupCache.set(texture, this.bindGroup);
    }
  }

  public resetTexture() {
    this.setTexture(this.fallbackTexture);
  }

  private updateBindGroup() {
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.diffuseTexture.createView() },
      ],
    });
  }

  private createRenderTargets() {
    if (this.colorTexture) this.colorTexture.destroy();

    this.colorTexture = this.device.createTexture({
      size: [this.canvas.width, this.canvas.height],
      format: this.canvasFormat,
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.colorTextureView = this.colorTexture.createView();
    this.postProcessRenderer.updateBindGroup(this.colorTextureView);
  }

  public clearBindGroupCache() {
    this.bindGroupCache.clear();
  }

  public resize() {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const newWidth = Math.max(
      1,
      Math.floor(this.canvas.clientWidth * devicePixelRatio)
    );
    const newHeight = Math.max(
      1,
      Math.floor(this.canvas.clientHeight * devicePixelRatio)
    );

    if (this.canvas.width !== newWidth || this.canvas.height !== newHeight) {
      this.canvas.width = newWidth;
      this.canvas.height = newHeight;

      if (this.depthTexture) this.depthTexture.destroy();

      this.depthTexture = this.device.createTexture({
        size: [this.canvas.width, this.canvas.height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });

      this.createRenderTargets();
    }

    this.postProcessRenderer.setCanvasSize(
      this.canvas.width,
      this.canvas.height
    );
  }

  private commandEncoder!: GPUCommandEncoder;
  private renderPass!: GPURenderPassEncoder;
  private frameStarted: boolean = false;

  public beginFrame() {
    if (!this.colorTexture) {
      this.createRenderTargets();
    }

    this.commandEncoder = this.device.createCommandEncoder();
    const textureView = this.colorTextureView;

    this.renderPass = this.commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });

    this.frameStarted = true;
    this.currentDrawIndex = 0;
  }

  public endFrame() {
    if (!this.frameStarted) return;

    this.renderPass.end();

    const swapView = this.context.getCurrentTexture().createView();
    this.postProcessRenderer.render(this.commandEncoder, swapView);

    this.device.queue.submit([this.commandEncoder.finish()]);
    this.frameStarted = false;
  }

  public drawSkyboxInFrame(
    cameraForward: number[],
    cameraRight: number[],
    cameraUp: number[]
  ) {
    if (!this.frameStarted || !this.skyboxRenderer.hasSkybox()) return;
    this.skyboxRenderer.drawInFrame(
      this.renderPass,
      cameraForward,
      cameraRight,
      cameraUp
    );
  }

  public drawTrailInFrame(
    instances: Float32Array,
    instanceCount: number,
    viewProj: Float32Array,
    right: number[],
    up: number[],
    ttl: number
  ) {
    if (!this.frameStarted || instanceCount === 0) return;
    this.trailRenderer.drawInFrame(
      this.renderPass,
      instances,
      instanceCount,
      viewProj,
      right,
      up,
      ttl
    );
  }

  private uniformBufferPool: GPUBuffer[] = [];
  private currentDrawIndex: number = 0;

  private getOrCreateUniformBuffer(index: number): GPUBuffer {
    if (index < this.uniformBufferPool.length) {
      return this.uniformBufferPool[index];
    }

    const buffer = this.device.createBuffer({
      size: Renderer.UNIFORM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.uniformBufferPool.push(buffer);
    return buffer;
  }

  private normalizeVec3(v: [number, number, number]): [number, number, number] {
    const len = Math.hypot(v[0], v[1], v[2]);
    if (len < 1e-6) return [0, 1, 0];
    return [v[0] / len, v[1] / len, v[2] / len];
  }

  private buildUniformData(mvpMatrix: Float32Array): Float32Array {
    const data = new Float32Array(Renderer.UNIFORM_FLOAT_COUNT);
    data.set(mvpMatrix, 0);

    const dir = this.normalizeVec3(this.lighting.direction);
    data.set([dir[0], dir[1], dir[2], this.lighting.shininess], 16);

    const light = this.lighting.intensity;
    data.set([light, light, light, 0.0], 20);

    const ambient = this.lighting.ambientIntensity;
    data.set([ambient, ambient, ambient, 0.0], 24);

    return data;
  }

  public drawMeshInFrame(
    mvpMatrix: Float32Array,
    startIndex: number = 0,
    indexCount?: number
  ) {
    if (!this.vertexBuffer || !this.indexBuffer || !this.frameStarted) return;

    const buffer = this.getOrCreateUniformBuffer(this.currentDrawIndex);
    this.currentDrawIndex++;

    const uniformData = this.buildUniformData(mvpMatrix);
    this.device.queue.writeBuffer(buffer, 0, uniformData as BufferSource);

    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: buffer } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.diffuseTexture.createView() },
      ],
    });

    this.renderPass.setPipeline(this.pipeline);
    this.renderPass.setBindGroup(0, bindGroup);
    this.renderPass.setVertexBuffer(0, this.vertexBuffer);
    this.renderPass.setIndexBuffer(this.indexBuffer, "uint32");
    this.renderPass.drawIndexed(
      indexCount ?? this.indexCount,
      1,
      startIndex,
      0,
      0
    );
  }

  // mesh buffer cache
  private meshBufferCache = new Map<
    Mesh,
    { vertexBuffer: GPUBuffer; indexBuffer: GPUBuffer }
  >();
  private currentMesh: Mesh | null = null;

  setMesh(mesh: Mesh) {
    if (this.currentMesh === mesh) return;

    this.currentMesh = mesh;

    let cached = this.meshBufferCache.get(mesh);
    if (cached) {
      this.vertexBuffer = cached.vertexBuffer;
      this.indexBuffer = cached.indexBuffer;
      this.indexCount = mesh.indexCount;
      return;
    }

    const vertexBuffer = this.device.createBuffer({
      size: mesh.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(
      vertexBuffer,
      0,
      mesh.vertexData as BufferSource
    );

    const indexBuffer = this.device.createBuffer({
      size: mesh.indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(
      indexBuffer,
      0,
      mesh.indexData as BufferSource
    );

    this.meshBufferCache.set(mesh, { vertexBuffer, indexBuffer });

    this.vertexBuffer = vertexBuffer;
    this.indexBuffer = indexBuffer;
    this.indexCount = mesh.indexCount;
  }

  public clearMeshCache() {
    for (const cached of this.meshBufferCache.values()) {
      cached.vertexBuffer.destroy();
      cached.indexBuffer.destroy();
    }
    this.meshBufferCache.clear();
    this.currentMesh = null;
  }
}
