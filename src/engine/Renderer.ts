import { BasicShaderCode } from "../shaders/BasicShader";
import { SkyShaderCode } from "../shaders/SkyShader";
import { Mesh } from "../engine/Mesh";
import { CubeMapMaterial } from "./CubeMaterials";

export class Renderer {
    canvas: HTMLCanvasElement;
    device!: GPUDevice;
    context!: GPUCanvasContext;
    pipeline!: GPURenderPipeline;

    // Skybox
    skyPipeline!: GPURenderPipeline;
    skyBindGroup!: GPUBindGroup;
    skyUniformBuffer!: GPUBuffer;
    skyMaterial: CubeMapMaterial | null = null;

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

        this.skyUniformBuffer = this.device.createBuffer({
            size: 48,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.updateBindGroup();

        const observer = new ResizeObserver(() => this.resize());
        observer.observe(this.canvas);
        this.resize();
    }

    private async initializeSkyPipeline(format: GPUTextureFormat) {
        const skyShaderModule = this.device.createShaderModule({ code: SkyShaderCode });

        this.skyPipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: skyShaderModule,
                entryPoint: 'sky_vert_main',
            },
            fragment: {
                module: skyShaderModule,
                entryPoint: 'sky_frag_main',
                targets: [{ format: format }]
            },
            primitive: {
                topology: 'triangle-list',
            },
            depthStencil: {
                depthWriteEnabled: false,
                depthCompare: 'less-equal',
                format: 'depth24plus',
            }
        });
    }

    public async setSkybox(urls: string[]) {
        this.skyMaterial = new CubeMapMaterial();
        await this.skyMaterial.initialize(this.device, urls);

        const format = navigator.gpu.getPreferredCanvasFormat();
        await this.initializeSkyPipeline(format);

        this.updateSkyBindGroup();
        console.log("Skybox carregado.");
    }

    private updateSkyBindGroup() {
        if (!this.skyMaterial?.view || !this.skyMaterial?.sampler) return;

        this.skyBindGroup = this.device.createBindGroup({
            layout: this.skyPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.skyUniformBuffer } },
                { binding: 1, resource: this.skyMaterial.view },
                { binding: 2, resource: this.skyMaterial.sampler }
            ]
        });
    }

    private fallbackTexture!: GPUTexture;

    private createFallbackTexture() {
        this.fallbackTexture = this.device.createTexture({
            size: [1, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
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

    // Cache de bind groups por textura para evitar recriação a cada frame
    private bindGroupCache = new Map<GPUTexture, GPUBindGroup>();

    public setTexture(texture: GPUTexture) {
        if (this.diffuseTexture === texture) return;
        
        this.diffuseTexture = texture;
        
        // Verifica se já tem um bind group cacheado para esta textura
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
                { binding: 0, resource: { buffer: this.uniformBuffer } }, // uniforms
                { binding: 1, resource: this.sampler }, // sampler
                { binding: 2, resource: this.diffuseTexture.createView() } // textura
            ]
        });
    }

    public clearBindGroupCache() {
        this.bindGroupCache.clear();
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

    private commandEncoder!: GPUCommandEncoder;
    private renderPass!: GPURenderPassEncoder;
    private frameStarted: boolean = false;

    public beginFrame() {
        this.commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();

        this.renderPass = this.commandEncoder.beginRenderPass({
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

        this.frameStarted = true;
    }

    public endFrame() {
        if (!this.frameStarted) return;
        
        this.renderPass.end();
        this.device.queue.submit([this.commandEncoder.finish()]);
        this.frameStarted = false;
    }

    public drawSkyboxInFrame(cameraForward: number[], cameraRight: number[], cameraUp: number[]) {
        if (!this.skyMaterial || !this.skyBindGroup || !this.frameStarted) return;

        const cameraData = new Float32Array(12);
        cameraData.set(cameraForward, 0);
        cameraData.set(cameraRight, 4);
        cameraData.set(cameraUp, 8);
        this.device.queue.writeBuffer(this.skyUniformBuffer, 0, cameraData);

        this.renderPass.setPipeline(this.skyPipeline);
        this.renderPass.setBindGroup(0, this.skyBindGroup);
        this.renderPass.draw(6);
    }

    public drawMeshInFrame(mvpMatrix: Float32Array, startIndex: number = 0, indexCount?: number) {
        if (!this.vertexBuffer || !this.indexBuffer || !this.frameStarted) return;

        this.device.queue.writeBuffer(this.uniformBuffer, 0, mvpMatrix as BufferSource);

        this.renderPass.setPipeline(this.pipeline);
        this.renderPass.setBindGroup(0, this.bindGroup);
        this.renderPass.setVertexBuffer(0, this.vertexBuffer);
        this.renderPass.setIndexBuffer(this.indexBuffer, 'uint32');
        this.renderPass.drawIndexed(indexCount ?? this.indexCount, 1, startIndex, 0, 0);
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

    // Cache de buffers por mesh para evitar recriação a cada frame
    private meshBufferCache = new Map<Mesh, { vertexBuffer: GPUBuffer, indexBuffer: GPUBuffer }>();
    private currentMesh: Mesh | null = null;

    setMesh(mesh: Mesh) {
        if (this.currentMesh === mesh) return;
        
        this.currentMesh = mesh;
        
        // Verifica se já tem buffers cacheados para esta mesh
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
        this.device.queue.writeBuffer(vertexBuffer, 0, mesh.vertexData as BufferSource);

        const indexBuffer = this.device.createBuffer({
            size: mesh.indexData.byteLength, 
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(indexBuffer, 0, mesh.indexData as BufferSource);

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

    drawSky(cameraForward: number[], cameraRight: number[], cameraUp: number[]) {
        if (!this.skyMaterial || !this.skyBindGroup) return;

        const cameraData = new Float32Array(12); // 3 vec3 * 4 floats (padding)
        cameraData.set(cameraForward, 0);
        cameraData.set(cameraRight, 4);
        cameraData.set(cameraUp, 8);
        this.device.queue.writeBuffer(this.skyUniformBuffer, 0, cameraData);

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

        renderPass.setPipeline(this.skyPipeline);
        renderPass.setBindGroup(0, this.skyBindGroup);
        renderPass.draw(6);

        renderPass.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }

    drawObjects(mvpMatrix: Float32Array) {
        if (!this.vertexBuffer || !this.indexBuffer || this.indexCount === 0) {
            return; 
        }

        this.device.queue.writeBuffer(this.uniformBuffer, 0, mvpMatrix as BufferSource);

        const commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                loadOp: 'load',
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthLoadOp: 'load',
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

    drawSubMesh(mvpMatrix: Float32Array, startIndex: number, indexCount: number) {
        if (!this.vertexBuffer || !this.indexBuffer || indexCount === 0) {
            return; 
        }

        this.device.queue.writeBuffer(this.uniformBuffer, 0, mvpMatrix as BufferSource);

        const commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                loadOp: 'load',
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthLoadOp: 'load',
                depthStoreOp: 'store'
            }
        });

        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindGroup);
        renderPass.setVertexBuffer(0, this.vertexBuffer);
        renderPass.setIndexBuffer(this.indexBuffer, 'uint32');
        renderPass.drawIndexed(indexCount, 1, startIndex, 0, 0);
        
        renderPass.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }
}