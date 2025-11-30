export interface SubMesh {
    startIndex: number;
    indexCount: number;
    materialName: string;
}

export class Mesh {
    public vertexData: Float32Array;
    public indexData: Uint32Array;
    public vertexCount: number;
    public indexCount: number;
    public subMeshes: SubMesh[] = [];

    constructor(vertices: number[], indices: number[], subMeshes?: SubMesh[]) {
        this.vertexData = new Float32Array(vertices);
        this.indexData = new Uint32Array(indices);
        this.vertexCount = this.vertexData.length / 8; // 3 pos + 2 uv + 3 normal
        this.indexCount = this.indexData.length;
        
        if (subMeshes && subMeshes.length > 0) {
            this.subMeshes = subMeshes;
        } else {
            this.subMeshes = [{
                startIndex: 0,
                indexCount: this.indexCount,
                materialName: 'default'
            }];
        }
    }

    public hasMultipleMaterials(): boolean {
        return this.subMeshes.length > 1;
    }
}