import { mat4 } from './Math';
import { Renderer } from './Renderer';
import { Camera } from './Camera';
import { Mesh } from './Mesh';
import { ObjLoader } from '../loader/ObjLoader';
import { TextureLoader } from '../loader/TextureLoader';

export interface SceneObject {
    mesh: Mesh;
    texture?: GPUTexture | undefined;
    modelMatrix: number[];
}

export class Scene {
    private renderer: Renderer;
    private camera: Camera;
    private objects: SceneObject[] = [];
    private isRunning: boolean = false;

    constructor(renderer: Renderer, camera: Camera) {
        this.renderer = renderer;
        this.camera = camera;
    }

    public async loadObject(objPath: string, texturePath?: string): Promise<SceneObject | null> {
        try {
            const mesh = await ObjLoader.load(objPath);
            if (!mesh) {
                console.error(`Falha ao carregar mesh: ${objPath}`);
                return null;
            }

            let texture: GPUTexture | undefined;
            if (texturePath) {
                texture = await TextureLoader.load(this.renderer.device, texturePath);
            }

            const sceneObject: SceneObject = {
                mesh,
                texture,
                modelMatrix: mat4.identity()
            };

            this.objects.push(sceneObject);
            console.log(`Objeto carregado: ${objPath}`);
            return sceneObject;

        } catch (error) {
            console.error(`Erro ao carregar objeto: ${objPath}`, error);
            return null;
        }
    }

    public addObject(object: SceneObject): void {
        this.objects.push(object);
    }

    public removeObject(object: SceneObject): void {
        const index = this.objects.indexOf(object);
        if (index > -1) {
            this.objects.splice(index, 1);
        }
    }

    public getObjects(): SceneObject[] {
        return this.objects;
    }

    public getCamera(): Camera {
        return this.camera;
    }

    public getRenderer(): Renderer {
        return this.renderer;
    }


    public update(deltaTime: number): void {
        // provisorio
    }


    public render(): void {
        for (const obj of this.objects) {
            this.renderer.setMesh(obj.mesh);
            if (obj.texture) {
                this.renderer.setTexture(obj.texture);
            }

            this.camera.updateProjection(this.renderer.canvas.width / this.renderer.canvas.height);
            const mvp = this.camera.getMatrix(obj.modelMatrix);
            this.renderer.draw(new Float32Array(mvp));
        }
    }

    public start(updateCallback?: (scene: Scene, deltaTime: number) => void): void {
        if (this.isRunning) return;
        this.isRunning = true;

        let lastTime = performance.now();

        const frame = (currentTime: number) => {
            if (!this.isRunning) return;

            const deltaTime = (currentTime - lastTime) / 1000;
            lastTime = currentTime;

            if (updateCallback) {
                updateCallback(this, deltaTime);
            }

            this.update(deltaTime);

            this.render();

            requestAnimationFrame(frame);
        };

        console.log("Iniciando Loop de Renderização...");
        requestAnimationFrame(frame);
    }

    public stop(): void {
        this.isRunning = false;
    }
}
