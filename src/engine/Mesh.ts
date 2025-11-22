export class Mesh {
    public vertexData: Float32Array;
    public indexData: Uint32Array;
    public vertexCount: number;
    public indexCount: number;

    constructor(vertices: number[], indices: number[]) {
        this.vertexData = new Float32Array(vertices);
        this.indexData = new Uint32Array(indices);
        this.vertexCount = this.vertexData.length / 6; // 3 floats para posição + 3 floats para cor
        this.indexCount = this.indexData.length;
    }
}