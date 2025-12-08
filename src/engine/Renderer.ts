import { PhongShaderCode } from "../shaders/PhongShader";
import { SkyShaderCode } from "../shaders/SkyShader";
import { CrtShaderCode } from "../shaders/CrtShader";
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

    private lightDirection: [number, number, number] = [0.16, 1.0, -0.11];
    private lightIntensity: number = 0.87;
    private ambientIntensity: number = 0.74;
    private shininess: number = 4.0;

    private static readonly UNIFORM_FLOAT_COUNT = 28; // 16 (mvp) + 4 (light dir + shininess) + 4 (light color) + 4 (ambient)
    private static readonly UNIFORM_BUFFER_SIZE = Renderer.UNIFORM_FLOAT_COUNT * 4;

    private canvasFormat!: GPUTextureFormat;
    private colorTexture!: GPUTexture;
    private colorTextureView!: GPUTextureView;

    private postProcessPipeline!: GPURenderPipeline;
    private postProcessBindGroup!: GPUBindGroup;
    private postProcessSampler!: GPUSampler;
    private postProcessUniform!: GPUBuffer;
    private postProcessTime: number = 0;

    private fisheyeStrength = 1.0;
    private scanLineIntensity = 0.025;
    private rgbOffset = 0.0018;
    private vignetteIntensity = 0.03;
    private waveAmplitude = 0.0002;
    private waveFrequency = 14.7;
    private jitterIntensity = 0.0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    async initialize() {
        if (!navigator.gpu) throw new Error("WebGPU não suportado");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error("Sem adaptador GPU");
        this.device = await adapter.requestDevice();

        this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
        this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();

        this.context.configure({
            device: this.device,
            format: this.canvasFormat,
            alphaMode: 'opaque'
        });

        const shaderModule = this.device.createShaderModule({ code: PhongShaderCode });

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
                cullMode: 'none' 
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{ format: this.canvasFormat }]
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            }
        });

        const crtShaderModule = this.device.createShaderModule({ code: CrtShaderCode });

        this.postProcessPipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: crtShaderModule,
                entryPoint: 'vs_main'
            },
            fragment: {
                module: crtShaderModule,
                entryPoint: 'fs_main',
                targets: [{ format: this.canvasFormat }]
            },
            primitive: {
                topology: 'triangle-list'
            }
        });

        this.sampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear',
            addressModeU: 'repeat',
            addressModeV: 'repeat',
            maxAnisotropy: 16,
        });

        this.createFallbackTexture();

        this.createRenderTargets();
        this.postProcessSampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge'
        });
        this.postProcessUniform = this.device.createBuffer({
            size: 48,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        this.updatePostProcessBindGroup();

        this.uniformBuffer = this.device.createBuffer({
            size: Renderer.UNIFORM_BUFFER_SIZE,
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

    public setLightDirection(dir: number[]) {
        this.lightDirection = [dir[0], dir[1], dir[2]];
    }

    public setLightIntensity(intensity: number) {
        this.lightIntensity = Math.max(0, intensity);
    }

    public setAmbientIntensity(intensity: number) {
        this.ambientIntensity = Math.max(0, intensity);
    }

    public setShininess(value: number) {
        this.shininess = Math.max(1, value);
    }

    public setPostProcessTime(timeSeconds: number) {
        this.postProcessTime = timeSeconds;
    }

    public setFisheyeStrength(value: number) {
        this.fisheyeStrength = Math.max(0, value);
    }

    public setScanLineIntensity(value: number) {
        this.scanLineIntensity = Math.max(0, value);
    }

    public setRgbOffset(value: number) {
        this.rgbOffset = Math.max(0, value);
    }

    public setVignetteIntensity(value: number) {
        this.vignetteIntensity = Math.max(0, value);
    }

    public setWaveAmplitude(value: number) {
        this.waveAmplitude = Math.max(0, value);
    }

    public setWaveFrequency(value: number) {
        this.waveFrequency = Math.max(0, value);
    }

    public setJitterIntensity(value: number) {
        this.jitterIntensity = Math.max(0, value);
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

    private createRenderTargets() {
        if (this.colorTexture) this.colorTexture.destroy();

        this.colorTexture = this.device.createTexture({
            size: [this.canvas.width, this.canvas.height],
            format: this.canvasFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });

        this.colorTextureView = this.colorTexture.createView();
    }

    private updatePostProcessBindGroup() {
        if (!this.postProcessPipeline || !this.colorTextureView || !this.postProcessSampler || !this.postProcessUniform) return;

        this.postProcessBindGroup = this.device.createBindGroup({
            layout: this.postProcessPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: this.colorTextureView },
                { binding: 1, resource: this.postProcessSampler },
                { binding: 2, resource: { buffer: this.postProcessUniform } }
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

            this.createRenderTargets();
            this.updatePostProcessBindGroup();
        }
    }

    private commandEncoder!: GPUCommandEncoder;
    private renderPass!: GPURenderPassEncoder;
    private frameStarted: boolean = false;

    public beginFrame() {
        if (!this.colorTexture) {
            this.createRenderTargets();
            this.updatePostProcessBindGroup();
        }

        this.commandEncoder = this.device.createCommandEncoder();
        const textureView = this.colorTextureView;

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

        this.updatePostProcessUniforms();

        this.frameStarted = true;
        this.currentDrawIndex = 0;
    }

    public endFrame() {
        if (!this.frameStarted) return;
        
        this.renderPass.end();
        const swapView = this.context.getCurrentTexture().createView();

        const postPass = this.commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: swapView,
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        });

        postPass.setPipeline(this.postProcessPipeline);
        postPass.setBindGroup(0, this.postProcessBindGroup);
        postPass.draw(3);
        postPass.end();

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

    private uniformBufferPool: GPUBuffer[] = [];
    private currentDrawIndex: number = 0;

    private getOrCreateUniformBuffer(index: number): GPUBuffer {
        if (index < this.uniformBufferPool.length) {
            return this.uniformBufferPool[index];
        }

        const buffer = this.device.createBuffer({
            size: Renderer.UNIFORM_BUFFER_SIZE,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
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

        const dir = this.normalizeVec3(this.lightDirection);
        data.set([dir[0], dir[1], dir[2], this.shininess], 16);

        const light = this.lightIntensity;
        data.set([light, light, light, 0.0], 20);

        const ambient = this.ambientIntensity;
        data.set([ambient, ambient, ambient, 0.0], 24);

        return data;
    }

    private updatePostProcessUniforms() {
        if (!this.postProcessUniform) return;

        const data = new Float32Array(12);
        data[0] = this.canvas.width;
        data[1] = this.canvas.height;
        data[2] = this.postProcessTime;
        data[3] = this.fisheyeStrength;

        data[4] = this.scanLineIntensity;
        data[5] = this.rgbOffset;
        data[6] = this.vignetteIntensity;
        data[7] = this.waveAmplitude;

        data[8] = this.waveFrequency;
        data[9] = this.jitterIntensity;
        data[10] = 0.0;
        data[11] = 0.0;

        this.device.queue.writeBuffer(this.postProcessUniform, 0, data as BufferSource);
    }

    public drawMeshInFrame(mvpMatrix: Float32Array, startIndex: number = 0, indexCount?: number) {
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
                { binding: 2, resource: this.diffuseTexture.createView() }
            ]
        });

        this.renderPass.setPipeline(this.pipeline);
        this.renderPass.setBindGroup(0, bindGroup);
        this.renderPass.setVertexBuffer(0, this.vertexBuffer);
        this.renderPass.setIndexBuffer(this.indexBuffer, 'uint32');
        this.renderPass.drawIndexed(indexCount ?? this.indexCount, 1, startIndex, 0, 0);
    }

    draw(mvpMatrix: Float32Array) {
        if (!this.vertexBuffer || !this.indexBuffer || this.indexCount === 0) {
            return; 
        }

        const uniformData = this.buildUniformData(mvpMatrix);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData as BufferSource);

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