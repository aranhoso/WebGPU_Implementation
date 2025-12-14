import { Scene, SceneObject } from './Scene';
import { Mesh } from './Mesh';
import { mat4 } from './Math';

export interface ButtonConfig {
    position: [number, number, number];
    radius?: number;
}

export class Chronometer {
    private start: ButtonConfig;
    private finish: ButtonConfig;
    private running = false;
    private startTime = 0;
    private lastRun: number | null = null;
    private bestRun: number | null = null;
    private inStartZone = false;
    private inFinishZone = false;
    private displayEl: HTMLElement | null;
    private scene: Scene | null;
    private startMarker: SceneObject | null = null;
    private finishMarker: SceneObject | null = null;
    private markersShown = false;

    constructor(start: ButtonConfig, finish: ButtonConfig, displayEl?: HTMLElement | null, scene?: Scene | null) {
        this.start = { ...start, radius: start.radius ?? 2 };
        this.finish = { ...finish, radius: finish.radius ?? 2 };
        this.displayEl = displayEl ?? null;
        this.scene = scene ?? null;
    }

    private distance(a: [number, number, number], b: [number, number, number]): number {
        const dx = a[0] - b[0];
        const dy = a[1] - b[1];
        const dz = a[2] - b[2];
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    private formatSeconds(sec: number): string {
        const minutes = Math.floor(sec / 60);
        const seconds = sec % 60;
        return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
    }

    private ensureMarkers(show: boolean) {
        if (!this.scene) return;

        if (show && !this.markersShown) {
            const cube = this.buildMarkerMesh(0.6);

            const startObj: SceneObject = {
                mesh: cube,
                modelMatrix: mat4.translate(mat4.identity(), this.start.position[0], this.start.position[1], this.start.position[2])
            };
            const finishObj: SceneObject = {
                mesh: cube,
                modelMatrix: mat4.translate(mat4.identity(), this.finish.position[0], this.finish.position[1], this.finish.position[2])
            };

            this.scene.addObject(startObj);
            this.scene.addObject(finishObj);
            this.startMarker = startObj;
            this.finishMarker = finishObj;
            this.markersShown = true;
        } else if (!show && this.markersShown) {
            if (this.startMarker) this.scene.removeObject(this.startMarker);
            if (this.finishMarker) this.scene.removeObject(this.finishMarker);
            this.startMarker = null;
            this.finishMarker = null;
            this.markersShown = false;
        }
    }

    private buildMarkerMesh(scale: number): Mesh {
        const s = scale;
        const vertices = [
            // pos            // uv   // normal
            -s, -s, -s, 0, 0, 0, 0, -1,
             s, -s, -s, 1, 0, 0, 0, -1,
             s,  s, -s, 1, 1, 0, 0, -1,
            -s,  s, -s, 0, 1, 0, 0, -1,

            -s, -s,  s, 0, 0, 0, 0, 1,
             s, -s,  s, 1, 0, 0, 0, 1,
             s,  s,  s, 1, 1, 0, 0, 1,
            -s,  s,  s, 0, 1, 0, 0, 1,

            -s,  s,  s, 1, 0, -1, 0, 0,
            -s,  s, -s, 1, 1, -1, 0, 0,
            -s, -s, -s, 0, 1, -1, 0, 0,
            -s, -s,  s, 0, 0, -1, 0, 0,

             s,  s,  s, 1, 0, 1, 0, 0,
             s,  s, -s, 1, 1, 1, 0, 0,
             s, -s, -s, 0, 1, 1, 0, 0,
             s, -s,  s, 0, 0, 1, 0, 0,

            -s, -s, -s, 0, 1, 0, -1, 0,
             s, -s, -s, 1, 1, 0, -1, 0,
             s, -s,  s, 1, 0, 0, -1, 0,
            -s, -s,  s, 0, 0, 0, -1, 0,

            -s,  s, -s, 0, 1, 0, 1, 0,
             s,  s, -s, 1, 1, 0, 1, 0,
             s,  s,  s, 1, 0, 0, 1, 0,
            -s,  s,  s, 0, 0, 0, 1, 0,
        ];

        const indices = [
            0, 1, 2, 0, 2, 3,
            4, 6, 5, 4, 7, 6,
            8, 9,10, 8,10,11,
           12,14,13,12,15,14,
           16,17,18,16,18,19,
           20,22,21,20,23,22,
        ];
        return new Mesh(vertices, indices);
    }

    public update(
        playerPos: [number, number, number],
        interactPressed: boolean,
        debugVisible: boolean,
        allowFinishWhileNoclip: boolean = false,
        isNoclip: boolean = false
    ): void {
        const now = performance.now();

        this.ensureMarkers(debugVisible);

        // detect start gate (requires E press)
        const distStart = this.distance(playerPos, this.start.position);
        const inStart = distStart <= (this.start.radius ?? 2);
        if (inStart && interactPressed && !this.running) {
            this.running = true;
            this.startTime = now;
            this.lastRun = null;
        }
        this.inStartZone = inStart;

        // detect finish gate (requires E press)
        const distFinish = this.distance(playerPos, this.finish.position);
        const inFinish = distFinish <= (this.finish.radius ?? 2);
        if (this.running && inFinish && interactPressed) {
            if (allowFinishWhileNoclip || !isNoclip) {
                const elapsed = (now - this.startTime) / 1000;
                this.lastRun = elapsed;
                if (this.bestRun === null || elapsed < this.bestRun) {
                    this.bestRun = elapsed;
                }
                this.running = false;
            }
        }
        this.inFinishZone = inFinish;

        this.render(now);
    }

    private render(now: number) {
        if (!this.displayEl) return;
        const current = this.running ? (now - this.startTime) / 1000 : 0;
        const lines = [] as string[];
        lines.push(`Chrono: ${this.running ? this.formatSeconds(current) + ' (running)' : 'idle'}`);
        if (this.lastRun !== null) {
            lines.push(`Last: ${this.formatSeconds(this.lastRun)}`);
        }
        if (this.bestRun !== null) {
            lines.push(`Best: ${this.formatSeconds(this.bestRun)}`);
        }
        this.displayEl.textContent = lines.join(' | ');
    }

    public isRunning(): boolean {
        return this.running;
    }

    public reset(): void {
        this.running = false;
        this.startTime = 0;
        this.lastRun = null;
        this.inStartZone = false;
        this.inFinishZone = false;
        this.render(performance.now());
    }
}
