import { BasicShaderCode } from "../shaders/BasicShader";
import { Mesh } from "../engine/Mesh";

export class Renderer {
    canvas: HTMLCanvasElement;
    device!: GPUDevice;
    context!: GPUCanvasContext;
    pipeline!: GPURenderPipeline;

    vertexBuffer: GPUBuffer | null = null;
    indexBuffer: GPUBuffer | null = null;
    uniformBuffer!: GPUBuffer;
    
    bindGroup!: GPUBindGroup;
    depthTexture!: GPUTexture;
    indexCount: number = 0;
    sampler!: GPUSampler;
    diffuseTexture!: GPUTexture;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    async initialize() {
        if (!navigator.gpu) throw new Error("WebGPU não suportado");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error("Sem adaptador GPU");
        this.device = await adapter.requestDevice();

        this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
        const format = navigator.gpu.getPreferredCanvasFormat();

        this.context.configure({
            device: this.device,
            format: format,
            alphaMode: 'opaque'
        });

        const shaderModule = this.device.createShaderModule({ code: BasicShaderCode });

        this.pipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 32, 
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x3' }, // pos
                        { shaderLocation: 1, offset: 3*4, format: 'float32x2' }, // uv
                        { shaderLocation: 2, offset: 5*4, format: 'float32x3' }, // normals
                    ]
                }]
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'back' 
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{ format: format }]
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            }
        });

        this.sampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
        });

        this.createFallbackTexture();

        this.uniformBuffer = this.device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.updateBindGroup();

        const observer = new ResizeObserver(() => this.resize());
        observer.observe(this.canvas);
        this.resize();
    }

    private createFallbackTexture() {
        this.diffuseTexture = this.device.createTexture({
            size: [1, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        });
        const whitePixel = new Uint8Array([255, 255, 255, 255]);
        this.device.queue.writeTexture(
            { texture: this.diffuseTexture },
            whitePixel,
            { bytesPerRow: 4 },
            { width: 1, height: 1 }
        );
    }

    public setTexture(texture: GPUTexture) {
        this.diffuseTexture = texture;
        this.updateBindGroup();
    }

    private updateBindGroup() {
        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } }, // uniforms
                { binding: 1, resource: this.sampler }, // sampler
                { binding: 2, resource: this.diffuseTexture.createView() } // textura
            ]
        });
    }

    public resize() {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const newWidth = Math.max(1, Math.floor(this.canvas.clientWidth * devicePixelRatio));
        const newHeight = Math.max(1, Math.floor(this.canvas.clientHeight * devicePixelRatio));

        if (this.canvas.width !== newWidth || this.canvas.height !== newHeight) {
            this.canvas.width = newWidth;
            this.canvas.height = newHeight;

            if (this.depthTexture) this.depthTexture.destroy();
            
            this.depthTexture = this.device.createTexture({
                size: [this.canvas.width, this.canvas.height],
                format: 'depth24plus',
                usage: GPUTextureUsage.RENDER_ATTACHMENT
            });
        }
    }

    draw(mvpMatrix: Float32Array) {
        if (!this.vertexBuffer || !this.indexBuffer || this.indexCount === 0) {
            return; 
        }

        this.device.queue.writeBuffer(this.uniformBuffer, 0, mvpMatrix as BufferSource);

        const commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        });

        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindGroup);
        renderPass.setVertexBuffer(0, this.vertexBuffer);
        renderPass.setIndexBuffer(this.indexBuffer, 'uint32');
        renderPass.drawIndexed(this.indexCount);
        
        renderPass.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }

    async setMesh(mesh: Mesh) {
        if (this.vertexBuffer) this.vertexBuffer.destroy();
        if (this.indexBuffer) this.indexBuffer.destroy();

        this.vertexBuffer = this.device.createBuffer({
            size: mesh.vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.vertexBuffer, 0, mesh.vertexData as BufferSource);

        let indexData = mesh.indexData;

        this.indexBuffer = this.device.createBuffer({
            size: indexData.byteLength, 
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.indexBuffer, 0, indexData as BufferSource);
        
        this.indexCount = mesh.indexCount;
    }
}