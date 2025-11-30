import { mat4, vec3 } from './Math';

export class Camera {
    private projectionMatrix: number[];
    private viewMatrix: number[];

    public position: number[] = [0, 2, 5];

    private yaw: number = 0;
    private pitch: number = 0;

    private front: number[] = [0, 0, -1];
    private right: number[] = [1, 0, 0];
    private up: number[] = [0, 1, 0];
    private worldUp: number[] = [0, 1, 0];

    constructor(aspectRatio: number) {
        this.projectionMatrix = mat4.identity();
        this.viewMatrix = mat4.identity();
        this.updateProjection(aspectRatio);
        this.updateVectors();
        this.updateView();
    }

    public updateProjection(aspectRatio: number) {
        this.projectionMatrix = mat4.perspective((90 * Math.PI) / 180, aspectRatio, 0.1, 100.0);
    }

    public updateRotation(deltaX: number, deltaY: number) {
        const sensitivity = 0.001;
        this.yaw += deltaX * sensitivity;
        this.pitch -= deltaY * sensitivity;

        const maxPitch = Math.PI / 2 - 0.01;
        this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

        this.updateVectors();
    }

    private updateVectors() {
        const x = Math.cos(this.pitch) * Math.sin(this.yaw);
        const y = Math.sin(this.pitch);
        const z = -Math.cos(this.pitch) * Math.cos(this.yaw);

        this.front = vec3.normalize([x, y, z]);
        this.right = vec3.normalize(vec3.cross(this.front, this.worldUp));
        this.up = vec3.normalize(vec3.cross(this.right, this.front));
    }

    public move(direction: 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN', speed: number) {
        let velocity = [0, 0, 0];

        if (direction === 'FORWARD') velocity = vec3.scale(this.front, speed);
        if (direction === 'BACKWARD') velocity = vec3.scale(this.front, -speed);
        if (direction === 'LEFT') velocity = vec3.scale(this.right, -speed);
        if (direction === 'RIGHT') velocity = vec3.scale(this.right, speed);
        if (direction === 'UP') velocity = vec3.scale(this.worldUp, speed);
        if (direction === 'DOWN') velocity = vec3.scale(this.worldUp, -speed);

        this.position = vec3.add(this.position, velocity);
    }

    public updateView() {
        const target = vec3.add(this.position, this.front);
        this.viewMatrix = mat4.lookAt(this.position, target, this.up);
    }

    public getMatrix(modelMatrix: number[]): number[] {
        this.updateView();

        let mvp = mat4.multiply(this.viewMatrix, modelMatrix);
        mvp = mat4.multiply(this.projectionMatrix, mvp);

        return mvp;
    }

    public getFront(): number[] {
        return this.front;
    }

    public getRight(): number[] {
        return this.right;
    }

    public getUp(): number[] {
        return this.up;
    }

    // função só pra rotacionar a camera pra ver o cubemap
    public orbit(target: number[], angle: number, axis: 'x' | 'y' = 'y') {
        const offset = vec3.subtract(this.position, target);
        const radius = vec3.length(offset);

        if (axis === 'y') {
            this.yaw += angle;
        } else {
            this.pitch += angle;
            if (this.pitch > 1.55) this.pitch = 1.55;
            if (this.pitch < -1.55) this.pitch = -1.55;
        }

        const x = radius * Math.cos(this.pitch) * Math.sin(this.yaw);
        const y = radius * Math.sin(this.pitch);
        const z = -radius * Math.cos(this.pitch) * Math.cos(this.yaw);

        this.position = vec3.add(target, [x, y, z]);

        this.front = vec3.normalize(vec3.subtract(target, this.position));
        this.right = vec3.normalize(vec3.cross(this.front, this.worldUp));
        this.up = vec3.normalize(vec3.cross(this.right, this.front));
    }

    public lookAt(target: number[]) {
        this.front = vec3.normalize(vec3.subtract(target, this.position));
        this.right = vec3.normalize(vec3.cross(this.front, this.worldUp));
        this.up = vec3.normalize(vec3.cross(this.right, this.front));

        this.yaw = Math.atan2(this.front[2], this.front[0]);
        this.pitch = Math.asin(this.front[1]);
    }
}