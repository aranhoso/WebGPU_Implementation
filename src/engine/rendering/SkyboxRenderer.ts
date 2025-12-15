import { SkyShaderCode } from "../../shaders/SkyShader";
import { CubeMapMaterial } from "../CubeMaterials";

export class SkyboxRenderer {
  private device: GPUDevice;
  private canvasFormat: GPUTextureFormat;

  private skyPipeline!: GPURenderPipeline;
  private skyBindGroup!: GPUBindGroup;
  private skyUniformBuffer!: GPUBuffer;
  private skyMaterial: CubeMapMaterial | null = null;

  constructor(device: GPUDevice, canvasFormat: GPUTextureFormat) {
    this.device = device;
    this.canvasFormat = canvasFormat;
    this.createUniformBuffer();
  }

  private createUniformBuffer(): void {
    this.skyUniformBuffer = this.device.createBuffer({
      size: 48, // 3 vec3 * 4 floats (padding)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  private async initializePipeline(): Promise<void> {
    const skyShaderModule = this.device.createShaderModule({
      code: SkyShaderCode,
    });

    this.skyPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: skyShaderModule,
        entryPoint: "sky_vert_main",
      },
      fragment: {
        module: skyShaderModule,
        entryPoint: "sky_frag_main",
        targets: [{ format: this.canvasFormat }],
      },
      primitive: {
        topology: "triangle-list",
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "less-equal",
        format: "depth24plus",
      },
    });
  }

  private updateBindGroup(): void {
    if (!this.skyMaterial?.view || !this.skyMaterial?.sampler) return;

    this.skyBindGroup = this.device.createBindGroup({
      layout: this.skyPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.skyUniformBuffer } },
        { binding: 1, resource: this.skyMaterial.view },
        { binding: 2, resource: this.skyMaterial.sampler },
      ],
    });
  }

  public async loadSkybox(urls: string[]): Promise<void> {
    this.skyMaterial = new CubeMapMaterial();
    await this.skyMaterial.initialize(this.device, urls);
    await this.initializePipeline();
    this.updateBindGroup();
    console.log("Skybox carregado.");
  }

  public hasSkybox(): boolean {
    return this.skyMaterial !== null && this.skyBindGroup !== undefined;
  }

  public drawInFrame(
    renderPass: GPURenderPassEncoder,
    cameraForward: number[],
    cameraRight: number[],
    cameraUp: number[]
  ): void {
    if (!this.skyMaterial || !this.skyBindGroup) return;

    const cameraData = new Float32Array(12);
    cameraData.set(cameraForward, 0);
    cameraData.set(cameraRight, 4);
    cameraData.set(cameraUp, 8);
    this.device.queue.writeBuffer(this.skyUniformBuffer, 0, cameraData);

    renderPass.setPipeline(this.skyPipeline);
    renderPass.setBindGroup(0, this.skyBindGroup);
    renderPass.draw(6);
  }
}
