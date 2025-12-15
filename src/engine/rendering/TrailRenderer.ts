import { TrailShaderCode } from "../../shaders/TrailShader";

export class TrailRenderer {
  private device: GPUDevice;
  private canvasFormat: GPUTextureFormat;

  private trailPipeline!: GPURenderPipeline;
  private trailBindGroup!: GPUBindGroup;
  private trailUniform!: GPUBuffer;
  private trailVertexBuffer!: GPUBuffer;
  private trailInstanceBuffer!: GPUBuffer;
  private trailInstanceCapacity: number = 0;

  constructor(device: GPUDevice, canvasFormat: GPUTextureFormat) {
    this.device = device;
    this.canvasFormat = canvasFormat;
    this.initialize();
  }

  private initialize(): void {
    this.createPipeline();
    this.createBuffers();
  }

  private createPipeline(): void {
    const trailShaderModule = this.device.createShaderModule({
      code: TrailShaderCode,
    });

    this.trailPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: trailShaderModule,
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 8,
            stepMode: "vertex",
            attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
          },
          {
            arrayStride: 16,
            stepMode: "instance",
            attributes: [
              { shaderLocation: 1, offset: 0, format: "float32x3" },
              { shaderLocation: 2, offset: 12, format: "float32" },
            ],
          },
        ],
      },
      fragment: {
        module: trailShaderModule,
        entryPoint: "fs_main",
        targets: [{ format: this.canvasFormat }],
      },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "less-equal",
        format: "depth24plus",
      },
    });
  }

  private createBuffers(): void {
    // geometria do rastro
    const quadData = new Float32Array([
      // triângulo 1: bottom-left, bottom-right, top-left
      -0.2, -0.2, 0.2, -0.2, -0.2, 0.2,
      // triângulo 2: top-left, bottom-right, top-right
      -0.2, 0.2, 0.2, -0.2, 0.2, 0.2,
    ]);

    this.trailVertexBuffer = this.device.createBuffer({
      size: quadData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.trailVertexBuffer, 0, quadData);

    this.trailUniform = this.device.createBuffer({
      size: 16 * 4 * 2, // 128 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  private updateUniform(
    viewProj: Float32Array,
    right: number[],
    up: number[],
    ttl: number
  ): void {
    const data = new Float32Array(32); // 4x4 + 3 vec4
    data.set(viewProj, 0);
    data.set([right[0], right[1], right[2], 0.48], 16);
    data.set([up[0], up[1], up[2], ttl], 20);
    data.set([0.2, 1.0, 0.9, 0.9], 24);
    this.device.queue.writeBuffer(this.trailUniform, 0, data as BufferSource);
  }

  private ensureBindGroup(): void {
    this.trailBindGroup = this.device.createBindGroup({
      layout: this.trailPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.trailUniform } }],
    });
  }

  public drawInFrame(
    renderPass: GPURenderPassEncoder,
    instances: Float32Array,
    instanceCount: number,
    viewProj: Float32Array,
    right: number[],
    up: number[],
    ttl: number
  ): void {
    if (instanceCount === 0) return;

    const neededSize = instances.byteLength;
    if (!this.trailInstanceBuffer || neededSize > this.trailInstanceCapacity) {
      if (this.trailInstanceBuffer) this.trailInstanceBuffer.destroy();
      const newSize = Math.max(neededSize, 1024 * 4);
      this.trailInstanceBuffer = this.device.createBuffer({
        size: newSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      this.trailInstanceCapacity = newSize;
    }

    this.device.queue.writeBuffer(
      this.trailInstanceBuffer,
      0,
      instances.buffer,
      instances.byteOffset,
      instances.byteLength
    );

    this.updateUniform(viewProj, right, up, ttl);
    this.ensureBindGroup();

    renderPass.setPipeline(this.trailPipeline);
    renderPass.setBindGroup(0, this.trailBindGroup);
    renderPass.setVertexBuffer(0, this.trailVertexBuffer);
    renderPass.setVertexBuffer(1, this.trailInstanceBuffer);
    renderPass.draw(6, instanceCount);
  }
}
