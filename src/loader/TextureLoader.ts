export class TextureLoader {
    static async load(device: GPUDevice, url: string, isNormalMap: boolean = false): Promise<GPUTexture> {
        const res = await fetch(url);
        const blob = await res.blob();
        const source = await createImageBitmap(blob);
        const mipLevelCount = Math.floor(Math.log2(Math.max(source.width, source.height))) + 1;
        
        const texture = device.createTexture({
            label: url,
            size: [source.width, source.height],
            format: 'rgba8unorm',
            mipLevelCount: mipLevelCount,
            usage: GPUTextureUsage.TEXTURE_BINDING | 
                   GPUTextureUsage.COPY_DST | 
                   GPUTextureUsage.RENDER_ATTACHMENT
        });

        device.queue.copyExternalImageToTexture(
            { source: source, flipY: true },
            { texture: texture },
            { width: source.width, height: source.height }
        );

        await this.generateMipmaps(device, texture, source.width, source.height);

        return texture;
    }

    private static async generateMipmaps(device: GPUDevice, texture: GPUTexture, width: number, height: number) {
        const mipLevelCount = Math.floor(Math.log2(Math.max(width, height))) + 1;
        
        if (mipLevelCount <= 1) return;

        const shaderModule = device.createShaderModule({
            code: `
                @group(0) @binding(0) var srcTexture: texture_2d<f32>;
                @group(0) @binding(1) var dstTexture: texture_storage_2d<rgba8unorm, write>;

                @compute @workgroup_size(8, 8)
                fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                    let dstSize = textureDimensions(dstTexture);
                    if (id.x >= dstSize.x || id.y >= dstSize.y) {
                        return;
                    }
                    
                    let srcCoord = vec2<i32>(id.xy * 2);
                    let color = (
                        textureLoad(srcTexture, srcCoord, 0) +
                        textureLoad(srcTexture, srcCoord + vec2<i32>(1, 0), 0) +
                        textureLoad(srcTexture, srcCoord + vec2<i32>(0, 1), 0) +
                        textureLoad(srcTexture, srcCoord + vec2<i32>(1, 1), 0)
                    ) * 0.25;
                    
                    textureStore(dstTexture, vec2<i32>(id.xy), color);
                }
            `
        });

        const pipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'main'
            }
        });

        let mipWidth = width;
        let mipHeight = height;

        for (let level = 1; level < mipLevelCount; level++) {
            const srcView = texture.createView({
                baseMipLevel: level - 1,
                mipLevelCount: 1
            });

            mipWidth = Math.max(1, Math.floor(mipWidth / 2));
            mipHeight = Math.max(1, Math.floor(mipHeight / 2));

            const dstTexture = device.createTexture({
                size: [mipWidth, mipHeight],
                format: 'rgba8unorm',
                usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC
            });

            const bindGroup = device.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: srcView },
                    { binding: 1, resource: dstTexture.createView() }
                ]
            });

            const commandEncoder = device.createCommandEncoder();
            const passEncoder = commandEncoder.beginComputePass();
            passEncoder.setPipeline(pipeline);
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.dispatchWorkgroups(
                Math.ceil(mipWidth / 8),
                Math.ceil(mipHeight / 8)
            );
            passEncoder.end();

            commandEncoder.copyTextureToTexture(
                { texture: dstTexture },
                { texture: texture, mipLevel: level },
                [mipWidth, mipHeight]
            );

            device.queue.submit([commandEncoder.finish()]);
            dstTexture.destroy();
        }
    }
}