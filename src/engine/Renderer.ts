import { BasicShaderCode } from "../shaders/BasicShader";
import { CubeMesh } from "../geometry/CubeData";

export class Renderer {
    canvas: HTMLCanvasElement;
    device!: GPUDevice;
    context!: GPUCanvasContext;
    pipeline!: GPURenderPipeline;
    vertexBuffer!: GPUBuffer;
    uniformBuffer!: GPUBuffer;
    bindGroup!: GPUBindGroup;
    depthTexture!: GPUTexture;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    async initialize() {
        // Debug inicial
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

        // Classe genérica de shader do WebGPU
        const shaderModule = this.device.createShaderModule({ code: BasicShaderCode });


        // Pipeline da GPU
        this.pipeline = this.device.createRenderPipeline({
            layout: 'auto', // Deixa o WebGPU criar o layout automaticamente
            
            // Etapa de Vértices
            vertex: {
                module: shaderModule, // Classe genérica de shader do WebGPU
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 24, // 6 floats * 4 bytes
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x3' }, // Posição
                        { shaderLocation: 1, offset: 12, format: 'float32x3' } // Cor
                    ]
                }]
            },
            // Etapa de fragmentação (0/2)
            // Primitivas (1/2)
            primitive: {
                topology: 'triangle-list', // A cada 3 vértices, a GPU forma um triãngulo
                cullMode: 'back' // Back-face culling (um tipo de otimização, explico se precisar)
            },
            // Fragmentos (fragment shader) (2/2)
            fragment: {
                module: shaderModule, // Classe genérica de shader do WebGPU
                entryPoint: 'fs_main', // Função principal do fragment shader lá no código WGSL
                targets: [{ format: format }]
            },
            // Etapa de testes
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            }
        });

        // 3. Buffers
        this.vertexBuffer = this.device.createBuffer({
            size: CubeMesh.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.vertexBuffer, 0, CubeMesh);

        this.uniformBuffer = this.device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }]
        });

        // Depth Texture Inicial
        const observer = new ResizeObserver(() => {
            this.resize();
        });
        observer.observe(this.canvas);

        this.resize();
    }

    public resize() {
        // Pegar o aspect ratio do dispositivo
        const devicePixelRatio = window.devicePixelRatio || 1;

        const newWidth = Math.max(1, Math.floor(this.canvas.clientWidth * devicePixelRatio));
        const newHeight = Math.max(1, Math.floor(this.canvas.clientHeight * devicePixelRatio));

        // Só redimensiona se o tamanho for realmente diferente
        if (this.canvas.width !== newWidth || this.canvas.height !== newHeight) {
            this.canvas.width = newWidth;
            this.canvas.height = newHeight;

            // Destruir a textura de profundidade antiga para liberar memória
            if (this.depthTexture) {
                this.depthTexture.destroy();
            }
            
            // Recriar a textura com o novo tamanho
            this.depthTexture = this.device.createTexture({
                size: [this.canvas.width, this.canvas.height],
                format: 'depth24plus',
                usage: GPUTextureUsage.RENDER_ATTACHMENT
            });
        }
    }

    draw(mvpMatrix: Float32Array) {
        // Update dos uniforms
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
        renderPass.draw(36);
        renderPass.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }
}