import { mat4, vec3 } from 'gl-matrix';

export class Camera {
    private projectionMatrix: mat4;
    private viewMatrix: mat4;
    private eye: vec3 = [0, 0, -3]; // Posição da câmera
    private target: vec3 = [0, 0, 0]; // Para onde olha
    private up: vec3 = [0, 1, 0];

    constructor(aspectRatio: number) {
        this.projectionMatrix = mat4.create();
        this.viewMatrix = mat4.create();
        this.updateProjection(aspectRatio);
        this.updateView();
    }

    public updateProjection(aspectRatio: number) {
        mat4.perspective(this.projectionMatrix, (2 * Math.PI) / 5, aspectRatio, 0.1, 100.0);
    }

    public updateView() {
        mat4.lookAt(this.viewMatrix, this.eye, this.target, this.up);
    }

    public getMatrix(modelMatrix: mat4): mat4 {
        const mvp = mat4.create();
        mat4.multiply(mvp, this.viewMatrix, modelMatrix);
        mat4.multiply(mvp, this.projectionMatrix, mvp);
        return mvp;
    }
}