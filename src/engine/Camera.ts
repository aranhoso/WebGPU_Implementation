import { mat4, vec3 } from './Math';

export class Camera {
    private projectionMatrix: number[];
    private viewMatrix: number[];
    
    public position: number[] = [0, 2, 5];
    
    private yaw: number = -Math.PI / 2;
    private pitch: number = 0;

    private front: number[] = [0, 0, -1];
    private right: number[] = [1, 0, 0];
    private up: number[] = [0, 1, 0];
    private worldUp: number[] = [0, 1, 0];

    constructor(aspectRatio: number) {
        this.projectionMatrix = mat4.identity();
        this.viewMatrix = mat4.identity();
        this.updateProjection(aspectRatio);
        this.updateView();
    }

    public updateProjection(aspectRatio: number) {
        this.projectionMatrix = mat4.perspective((60 * Math.PI) / 180, aspectRatio, 0.1, 100.0);
    }

    public updateRotation(deltaX: number, deltaY: number) {
        const sensitivity = 0.002;
        this.yaw += deltaX * sensitivity;
        this.pitch += deltaY * sensitivity;

        if (this.pitch > 1.55) this.pitch = 1.55;
        if (this.pitch < -1.55) this.pitch = -1.55;

        this.updateVectors();
    }

    private updateVectors() {
        const x = Math.cos(this.yaw) * Math.cos(this.pitch);
        const y = Math.sin(this.pitch);
        const z = Math.sin(this.yaw) * Math.cos(this.pitch);

        this.front = vec3.normalize([x, y, z]);
        this.right = vec3.normalize(vec3.cross(this.front, this.worldUp));
        this.up = vec3.normalize(vec3.cross(this.right, this.front));
    }

    public move(direction: 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT', speed: number) {
        let velocity = [0, 0, 0];
        
        if (direction === 'FORWARD') velocity = vec3.scale(this.front, speed);
        if (direction === 'BACKWARD') velocity = vec3.scale(this.front, -speed);
        if (direction === 'LEFT') velocity = vec3.scale(this.right, -speed);
        if (direction === 'RIGHT') velocity = vec3.scale(this.right, speed);
        
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
}