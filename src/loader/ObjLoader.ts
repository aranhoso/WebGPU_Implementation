import { Mesh } from "../engine/Mesh";

export class ObjLoader {

    static async load(url: string): Promise<Mesh> {
        const response = await fetch(url);
        const text = await response.text();
        return this.parse(text);
    }

    static parse(text: string): Mesh {
        const positions: number[][] = [];
        const normals: number[][] = [];
        const uvs: number[][] = [];

        const finalVertices: number[] = [];
        const finalIndices: number[] = [];

        const cache: { [key: string]: number } = {};
        let nextIndex = 0;

        const lines = text.split('\n');

        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const type = parts[0];

            if (type === 'v') {
                positions.push([
                    parseFloat(parts[1] || '0'),
                    parseFloat(parts[2] || '0'),
                    parseFloat(parts[3] || '0')
                ]);
            } else if (type === 'vn') {
                normals.push([
                    parseFloat(parts[1] || '0'),
                    parseFloat(parts[2] || '0'),
                    parseFloat(parts[3] || '0')
                ]);
            } else if (type === 'vt') {
                uvs.push([
                    parseFloat(parts[1] || '0'),
                    parseFloat(parts[2] || '0')
                ]);
            } else if (type === 'f') {
                const faceVertices = parts.slice(1);

                for (let i = 0; i < faceVertices.length - 2; i++) {

                    const v1 = faceVertices[0];
                    const v2 = faceVertices[i + 1];
                    const v3 = faceVertices[i + 2];

                    if (!v1 || !v2 || !v3) continue;

                    const triangle = [v1, v2, v3];

                    for (const vertString of triangle) {
                        if (!cache[vertString]) {
                            const indices = vertString.split('/');

                            const posIndex = indices[0] ? parseInt(indices[0]) - 1 : -1;
                            const uvIndex = indices[1] ? parseInt(indices[1]) - 1 : -1;
                            const normIndex = indices[2] ? parseInt(indices[2]) - 1 : -1;

                            const p = positions[posIndex] || [0, 0, 0];
                            const uv = (uvIndex >= 0 && uvs[uvIndex]) ? uvs[uvIndex] : [0, 0];

                            let n = [0, 1, 0];
                            if (normIndex >= 0 && normals[normIndex]) {
                                n = normals[normIndex];
                            }

                            finalVertices.push(
                                p[0] ?? 0, p[1] ?? 0, p[2] ?? 0,
                                uv[0] ?? 0, uv[1] ?? 0,
                                n[0] ?? 0, n[1] ?? 0, n[2] ?? 0
                            );

                            cache[vertString] = nextIndex;
                            nextIndex++;
                        }
                        finalIndices.push(cache[vertString]!);
                    }
                }
            }
        }

        return new Mesh(finalVertices, finalIndices);
    }
}