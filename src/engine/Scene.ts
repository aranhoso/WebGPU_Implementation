import { mat4 } from './Math';
import { Renderer } from './Renderer';
import { Camera } from './Camera';
import { Mesh } from './Mesh';
import { ObjLoader } from '../loader/ObjLoader';
import { TextureLoader } from '../loader/TextureLoader';
import { Material } from '../loader/MtlLoader';

export interface SceneObject {
    mesh: Mesh;
    texture?: GPUTexture | undefined;
    textures?: Map<string, GPUTexture>;
    materials?: Map<string, Material>;
    modelMatrix: number[];
}

export class Scene {
    private renderer: Renderer;
    private camera: Camera;
    private objects: SceneObject[] = [];
    private isRunning: boolean = false;
    private hasSkybox: boolean = false;

    constructor(renderer: Renderer, camera: Camera) {
        this.renderer = renderer;
        this.camera = camera;
    }

    public async loadSkybox(urls: string[]): Promise<boolean> {
        try {
            if (urls.length !== 6) {
                console.error("Skybox requer 6 URLs de textura");
                return false;
            }
            await this.renderer.setSkybox(urls);
            this.hasSkybox = true;
            return true;
        } catch (error) {
            console.error("Erro ao carregar skybox:", error);
            return false;
        }
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
    public async loadObjectWithMaterials(objPath: string): Promise<SceneObject | null> {
        try {
            const result = await ObjLoader.loadWithMaterials(objPath);
            if (!result.mesh) {
                console.error(`Falha ao carregar mesh: ${objPath}`);
                return null;
            }

            const textures = new Map<string, GPUTexture>();
            
            for (const [name, material] of result.materials) {
                if (material.diffuseMap) {
                    try {
                        const texture = await TextureLoader.load(this.renderer.device, material.diffuseMap);
                        if (texture) {
                            textures.set(name, texture);
                            console.log(`Textura carregada para material '${name}': ${material.diffuseMap}`);
                        }
                    } catch (err) {
                        console.warn(`Falha ao carregar textura para material '${name}': ${material.diffuseMap}`);
                    }
                }
            }

            const sceneObject: SceneObject = {
                mesh: result.mesh,
                textures,
                materials: result.materials,
                modelMatrix: mat4.identity()
            };

            this.objects.push(sceneObject);
            console.log(`Objeto com materiais carregado: ${objPath} (${result.mesh.subMeshes.length} submeshes, ${textures.size} texturas)`);
            return sceneObject;

        } catch (error) {
            console.error(`Erro ao carregar objeto com materiais: ${objPath}`, error);
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
        this.renderer.beginFrame();

        if (this.hasSkybox) {
            this.renderer.drawSkyboxInFrame(
                this.camera.getFront(),
                this.camera.getRight(),
                this.camera.getUp()
            );
        }

        this.camera.updateProjection(this.renderer.canvas.width / this.renderer.canvas.height);

        for (const obj of this.objects) {
            this.renderer.setMesh(obj.mesh);
            const mvp = this.camera.getMatrix(obj.modelMatrix);
            const mvpArray = new Float32Array(mvp);

            if (obj.textures && obj.textures.size > 0 && obj.mesh.subMeshes.length > 1) {
                for (const subMesh of obj.mesh.subMeshes) {
                    const texture = obj.textures.get(subMesh.materialName);
                    if (texture) {
                        this.renderer.setTexture(texture);
                    } else {
                        this.renderer.resetTexture();
                    }
                    this.renderer.drawMeshInFrame(mvpArray, subMesh.startIndex, subMesh.indexCount);
                }
            } else {
                if (obj.texture) {
                    this.renderer.setTexture(obj.texture);
                } else {
                    this.renderer.resetTexture();
                }
                this.renderer.drawMeshInFrame(mvpArray);
            }
        }
        this.renderer.endFrame();
    }

    public start(updateCallback?: (scene: Scene, deltaTime: number) => void): void {
        if (this.isRunning) return;
        this.isRunning = true;

        let lastTime = performance.now();
        
        // FPS counter
        let frameCount = 0;
        let fpsLastTime = performance.now();
        const fpsElement = document.getElementById('fps-counter');

        const frame = (currentTime: number) => {
            if (!this.isRunning) return;

            const deltaTime = (currentTime - lastTime) / 1000;
            lastTime = currentTime;

            frameCount++;
            if (currentTime - fpsLastTime >= 1000) {
                const fps = Math.round(frameCount * 1000 / (currentTime - fpsLastTime));
                if (fpsElement) {
                    fpsElement.textContent = `FPS: ${fps}`;
                }
                frameCount = 0;
                fpsLastTime = currentTime;
            }

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
