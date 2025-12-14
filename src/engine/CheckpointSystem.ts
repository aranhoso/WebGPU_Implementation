import { mat4, vec3 } from './Math';
import { Mesh } from './Mesh';
import { Renderer } from './Renderer';
import { Scene, SceneObject } from './Scene';

export interface CheckpointConfig {
    position: [number, number, number];
    radius?: number;
}

export class CheckpointSystem {
    private scene: Scene;
    private renderer: Renderer;
    private checkpoints: CheckpointConfig[] = [];
    private markerMesh: Mesh | null = null;
    private markerTexture: GPUTexture | null = null;
    private markerObjects: (SceneObject | null)[] = [];
    private active: boolean = false;
    private spawnPoint: [number, number, number];
    private lastCheckpoint: [number, number, number];
    private lastCheckpointIndex: number | null = null;
    private visited: boolean[] = [];

    constructor(scene: Scene, renderer: Renderer, spawnPoint: [number, number, number]) {
        this.scene = scene;
        this.renderer = renderer;
        this.spawnPoint = [...spawnPoint];
        this.lastCheckpoint = [...spawnPoint];
    }

    public setSpawnPoint(spawn: [number, number, number]): void {
        this.spawnPoint = [...spawn];
        if (!this.active) {
            this.lastCheckpoint = [...spawn];
        }
    }

    public setCheckpoints(list: CheckpointConfig[]): void {
        this.checkpoints = list.map(cp => ({
            position: [...cp.position] as [number, number, number],
            radius: cp.radius ?? 1.5
        }));
        this.visited = this.checkpoints.map(() => false);
        if (this.active) {
            this.rebuildMarkers();
        }
    }

    public setActive(enabled: boolean): void {
        if (enabled === this.active) return;
        this.active = enabled;

        if (enabled) {
            this.ensureResources();
            this.visited = this.checkpoints.map(() => false);
            this.rebuildMarkers();
            this.lastCheckpointIndex = null;
        } else {
            this.removeMarkers();
            this.lastCheckpoint = [...this.spawnPoint];
            this.lastCheckpointIndex = null;
            this.visited = this.checkpoints.map(() => false);
        }
    }

    public resetToSpawn(): void {
        this.lastCheckpoint = [...this.spawnPoint];
        this.lastCheckpointIndex = null;
        this.visited = this.checkpoints.map(() => false);
    }

    public update(playerPos: [number, number, number]): void {
        if (!this.active || this.checkpoints.length === 0) return;

        for (let i = 0; i < this.checkpoints.length; i++) {
            const cp = this.checkpoints[i];
            if (this.visited[i]) continue;
            const dist = this.distance(playerPos, cp.position);
            if (dist <= (cp.radius ?? 1.5)) {
                if (this.lastCheckpointIndex !== i) {
                    this.lastCheckpointIndex = i;
                    this.lastCheckpoint = [...cp.position];
                    this.visited[i] = true;
                    const obj = this.markerObjects[i];
                    if (obj) {
                        this.scene.removeObject(obj);
                        this.markerObjects[i] = null;
                    }
                    console.log(`Checkpoint reached (#${i + 1}) at (${cp.position[0].toFixed(2)}, ${cp.position[1].toFixed(2)}, ${cp.position[2].toFixed(2)})`);
                }
                return;
            }
        }
    }

    public getLastCheckpoint(): [number, number, number] {
        return [...this.lastCheckpoint];
    }

    private rebuildMarkers(): void {
        this.removeMarkers();
        if (!this.markerMesh || !this.markerTexture) return;

        for (let i = 0; i < this.checkpoints.length; i++) {
            const cp = this.checkpoints[i];
            if (this.visited[i]) {
                this.markerObjects[i] = null;
                continue;
            }
            const scale = Math.max(0.25, (cp.radius ?? 1.5) * 0.6);
            const model = mat4.translate(
                mat4.scale(mat4.identity(), scale, scale, scale),
                cp.position[0],
                cp.position[1],
                cp.position[2]
            );

            const obj: SceneObject = {
                mesh: this.markerMesh,
                texture: this.markerTexture,
                modelMatrix: model
            };

            this.scene.addObject(obj);
            this.markerObjects[i] = obj;
        }
    }

    private removeMarkers(): void {
        for (const obj of this.markerObjects) {
            if (obj) {
                this.scene.removeObject(obj);
            }
        }
        this.markerObjects = [];
    }

    private ensureResources(): void {
        if (!this.markerMesh) {
            this.markerMesh = this.buildSphereMesh(0.5, 16, 12);
        }
        if (!this.markerTexture) {
            this.markerTexture = this.createSolidColorTexture([50, 255, 255, 255]);
        }
    }

    private buildSphereMesh(radius: number, segments: number, rings: number): Mesh {
        const vertices: number[] = [];
        const indices: number[] = [];

        for (let y = 0; y <= rings; y++) {
            const v = y / rings;
            const theta = v * Math.PI;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            for (let x = 0; x <= segments; x++) {
                const u = x / segments;
                const phi = u * Math.PI * 2;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);

                const nx = cosPhi * sinTheta;
                const ny = cosTheta;
                const nz = sinPhi * sinTheta;

                const px = radius * nx;
                const py = radius * ny;
                const pz = radius * nz;

                vertices.push(px, py, pz, u, 1 - v, nx, ny, nz);
            }
        }

        const stride = segments + 1;
        for (let y = 0; y < rings; y++) {
            for (let x = 0; x < segments; x++) {
                const a = y * stride + x;
                const b = a + stride;
                const c = a + 1;
                const d = b + 1;
                indices.push(a, b, c);
                indices.push(c, b, d);
            }
        }

        return new Mesh(vertices, indices);
    }

    private createSolidColorTexture(color: [number, number, number, number]): GPUTexture {
        const texture = this.renderer.device.createTexture({
            size: [1, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
        });
        const data = new Uint8Array(color);
        this.renderer.device.queue.writeTexture(
            { texture },
            data,
            { bytesPerRow: 4 },
            { width: 1, height: 1 }
        );
        return texture;
    }

    private distance(a: [number, number, number], b: [number, number, number]): number {
        return Math.sqrt(
            Math.pow(a[0] - b[0], 2) +
            Math.pow(a[1] - b[1], 2) +
            Math.pow(a[2] - b[2], 2)
        );
    }
}
