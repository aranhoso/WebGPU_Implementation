export class TextureLoader {
    static async load(device: GPUDevice, url: string, isNormalMap: boolean = false): Promise<GPUTexture> {
        const res = await fetch(url);
        const blob = await res.blob();
        const source = await createImageBitmap(blob);
        const texture = device.createTexture({
            label: url,
            size: [source.width, source.height],
            format: 'rgba8unorm', 
            usage: GPUTextureUsage.TEXTURE_BINDING | 
                   GPUTextureUsage.COPY_DST | 
                   GPUTextureUsage.RENDER_ATTACHMENT
        });

        device.queue.copyExternalImageToTexture(
            { source: source, flipY: true },
            { texture: texture },
            { width: source.width, height: source.height }
        );

        return texture;
    }
}