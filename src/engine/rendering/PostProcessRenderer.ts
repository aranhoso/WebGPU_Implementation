import { CrtShaderCode } from "../../shaders/CrtShader";

export interface PostProcessSettings {
  fisheyeStrength: number;
  scanLineIntensity: number;
  rgbOffset: number;
  vignetteIntensity: number;
  waveAmplitude: number;
  waveFrequency: number;
  jitterIntensity: number;
}

export const DEFAULT_POST_PROCESS_SETTINGS: PostProcessSettings = {
  fisheyeStrength: 1.0,
  scanLineIntensity: 0.025,
  rgbOffset: 0.0018,
  vignetteIntensity: 0.03,
  waveAmplitude: 0.0002,
  waveFrequency: 14.7,
  jitterIntensity: 0.0,
};

export class PostProcessRenderer {
  private device: GPUDevice;
  private canvasFormat: GPUTextureFormat;

  private pipeline!: GPURenderPipeline;
  private bindGroup!: GPUBindGroup;
  private sampler!: GPUSampler;
  private uniformBuffer!: GPUBuffer;

  private settings: PostProcessSettings = { ...DEFAULT_POST_PROCESS_SETTINGS };
  private time: number = 0;
  private canvasWidth: number = 0;
  private canvasHeight: number = 0;

  constructor(device: GPUDevice, canvasFormat: GPUTextureFormat) {
    this.device = device;
    this.canvasFormat = canvasFormat;
    this.initialize();
  }

  private initialize(): void {
    this.createPipeline();
    this.createResources();
  }

  private createPipeline(): void {
    const crtShaderModule = this.device.createShaderModule({
      code: CrtShaderCode,
    });

    this.pipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: crtShaderModule,
        entryPoint: "vs_main",
      },
      fragment: {
        module: crtShaderModule,
        entryPoint: "fs_main",
        targets: [{ format: this.canvasFormat }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });
  }

  private createResources(): void {
    this.sampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });

    this.uniformBuffer = this.device.createBuffer({
      size: 48, // 12 floats * 4 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  public updateBindGroup(colorTextureView: GPUTextureView): void {
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: colorTextureView },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: { buffer: this.uniformBuffer } },
      ],
    });
  }

  public setCanvasSize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  public setTime(timeSeconds: number): void {
    this.time = timeSeconds;
  }

  public setFisheyeStrength(value: number): void {
    this.settings.fisheyeStrength = Math.max(0, value);
  }

  public setScanLineIntensity(value: number): void {
    this.settings.scanLineIntensity = Math.max(0, value);
  }

  public setRgbOffset(value: number): void {
    this.settings.rgbOffset = Math.max(0, value);
  }

  public setVignetteIntensity(value: number): void {
    this.settings.vignetteIntensity = Math.max(0, value);
  }

  public setWaveAmplitude(value: number): void {
    this.settings.waveAmplitude = Math.max(0, value);
  }

  public setWaveFrequency(value: number): void {
    this.settings.waveFrequency = Math.max(0, value);
  }

  public setJitterIntensity(value: number): void {
    this.settings.jitterIntensity = Math.max(0, value);
  }

  public updateUniforms(): void {
    const data = new Float32Array(12);
    data[0] = this.canvasWidth;
    data[1] = this.canvasHeight;
    data[2] = this.time;
    data[3] = this.settings.fisheyeStrength;

    data[4] = this.settings.scanLineIntensity;
    data[5] = this.settings.rgbOffset;
    data[6] = this.settings.vignetteIntensity;
    data[7] = this.settings.waveAmplitude;

    data[8] = this.settings.waveFrequency;
    data[9] = this.settings.jitterIntensity;
    data[10] = 0.0;
    data[11] = 0.0;

    this.device.queue.writeBuffer(this.uniformBuffer, 0, data as BufferSource);
  }

  public render(
    commandEncoder: GPUCommandEncoder,
    targetView: GPUTextureView
  ): void {
    if (!this.bindGroup) return;

    this.updateUniforms();

    const postPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: targetView,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    postPass.setPipeline(this.pipeline);
    postPass.setBindGroup(0, this.bindGroup);
    postPass.draw(3);
    postPass.end();
  }
}
