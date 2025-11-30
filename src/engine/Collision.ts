import { vec3 } from './Math';
import { Mesh } from './Mesh';

export interface Triangle {
    v0: number[];
    v1: number[];
    v2: number[];
    normal: number[];
}

export interface AABB {
    min: number[];
    max: number[];
}

export class CollisionSystem {
    private triangles: Triangle[] = [];
    private playerRadius: number = 0.3;
    private playerHeight: number = 1.8;

    constructor(playerRadius: number = 0.3, playerHeight: number = 1.8) {
        this.playerRadius = playerRadius;
        this.playerHeight = playerHeight;
    }

    public loadMeshCollision(mesh: Mesh): void {
        this.triangles = [];
        
        const vertices = mesh.vertexData;
        const indices = mesh.indexData;
        
        // Cada vértice tem 8 floats: 3 pos + 2 uv + 3 normal
        const stride = 8;
        
        for (let i = 0; i < indices.length; i += 3) {
            const i0 = indices[i];
            const i1 = indices[i + 1];
            const i2 = indices[i + 2];
            
            const v0 = [
                vertices[i0 * stride],
                vertices[i0 * stride + 1],
                vertices[i0 * stride + 2]
            ];
            const v1 = [
                vertices[i1 * stride],
                vertices[i1 * stride + 1],
                vertices[i1 * stride + 2]
            ];
            const v2 = [
                vertices[i2 * stride],
                vertices[i2 * stride + 1],
                vertices[i2 * stride + 2]
            ];
            
            // Calcula a normal do triângulo
            const edge1 = vec3.subtract(v1, v0);
            const edge2 = vec3.subtract(v2, v0);
            const normal = vec3.normalize(vec3.cross(edge1, edge2));
            
            this.triangles.push({ v0, v1, v2, normal });
        }
        
        console.log(`CollisionSystem: Carregados ${this.triangles.length} triângulos para colisão`);
    }

    public resolveCollision(oldPos: number[], newPos: number[]): number[] {
        let resultPos = [...newPos];
        
        const playerSphere = {
            center: [resultPos[0], resultPos[1] + this.playerHeight / 2, resultPos[2]],
            radius: this.playerRadius
        };

        for (const tri of this.triangles) {
            const collision = this.sphereTriangleCollision(playerSphere, tri);
            
            if (collision.collided) {
                const pushVector = vec3.scale(collision.normal, collision.depth);
                resultPos[0] += pushVector[0];
                resultPos[1] += pushVector[1];
                resultPos[2] += pushVector[2];
                
                playerSphere.center = [resultPos[0], resultPos[1] + this.playerHeight / 2, resultPos[2]];
            }
        }
        
        return resultPos;
    }

    private sphereTriangleCollision(
        sphere: { center: number[], radius: number },
        triangle: Triangle
    ): { collided: boolean, normal: number[], depth: number } {

        const closestPoint = this.closestPointOnTriangle(sphere.center, triangle);

        const diff = vec3.subtract(sphere.center, closestPoint);
        const distSq = diff[0] * diff[0] + diff[1] * diff[1] + diff[2] * diff[2];
        const radiusSq = sphere.radius * sphere.radius;
        
        if (distSq < radiusSq) {
            const dist = Math.sqrt(distSq);
            const normal = dist > 0.0001 ? vec3.scale(diff, 1 / dist) : triangle.normal;
            const depth = sphere.radius - dist;
            
            return { collided: true, normal, depth };
        }
        
        return { collided: false, normal: [0, 0, 0], depth: 0 };
    }

    private closestPointOnTriangle(point: number[], triangle: Triangle): number[] {
        const { v0, v1, v2 } = triangle;
        
        const ab = vec3.subtract(v1, v0);
        const ac = vec3.subtract(v2, v0);
        const ap = vec3.subtract(point, v0);
        
        const d1 = this.dot(ab, ap);
        const d2 = this.dot(ac, ap);
        if (d1 <= 0 && d2 <= 0) return v0;

        const bp = vec3.subtract(point, v1);
        const d3 = this.dot(ab, bp);
        const d4 = this.dot(ac, bp);
        if (d3 >= 0 && d4 <= d3) return v1;

        const vc = d1 * d4 - d3 * d2;
        if (vc <= 0 && d1 >= 0 && d3 <= 0) {
            const v = d1 / (d1 - d3);
            return vec3.add(v0, vec3.scale(ab, v));
        }
        
        const cp = vec3.subtract(point, v2);
        const d5 = this.dot(ab, cp);
        const d6 = this.dot(ac, cp);
        if (d6 >= 0 && d5 <= d6) return v2;

        const vb = d5 * d2 - d1 * d6;
        if (vb <= 0 && d2 >= 0 && d6 <= 0) {
            const w = d2 / (d2 - d6);
            return vec3.add(v0, vec3.scale(ac, w));
        }
        
        const va = d3 * d6 - d5 * d4;
        if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
            const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
            return vec3.add(v1, vec3.scale(vec3.subtract(v2, v1), w));
        }
        
        const denom = 1 / (va + vb + vc);
        const vCoord = vb * denom;
        const wCoord = vc * denom;
        
        return vec3.add(v0, vec3.add(vec3.scale(ab, vCoord), vec3.scale(ac, wCoord)));
    }

    private dot(a: number[], b: number[]): number {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }

    public getGroundHeight(position: number[]): number | null {
        const rayOrigin = [position[0], position[1] + 1000, position[2]];
        const rayDir = [0, -1, 0];
        
        let closestHit: number | null = null;
        
        for (const tri of this.triangles) {
            if (tri.normal[1] < 0.5) continue;
            
            const hit = this.rayTriangleIntersection(rayOrigin, rayDir, tri);
            if (hit !== null) {
                const groundY = rayOrigin[1] + hit * rayDir[1];
                if (closestHit === null || groundY > closestHit) {
                    closestHit = groundY;
                }
            }
        }
        
        return closestHit;
    }

    // Moller–Trumbore
    private rayTriangleIntersection(
        rayOrigin: number[],
        rayDir: number[],
        triangle: Triangle
    ): number | null {
        const EPSILON = 0.0000001;
        const { v0, v1, v2 } = triangle;
        
        const edge1 = vec3.subtract(v1, v0);
        const edge2 = vec3.subtract(v2, v0);
        
        const h = vec3.cross(rayDir, edge2);
        const a = this.dot(edge1, h);
        
        if (a > -EPSILON && a < EPSILON) return null;
        
        const f = 1.0 / a;
        const s = vec3.subtract(rayOrigin, v0);
        const u = f * this.dot(s, h);
        
        if (u < 0.0 || u > 1.0) return null;
        
        const q = vec3.cross(s, edge1);
        const v = f * this.dot(rayDir, q);
        
        if (v < 0.0 || u + v > 1.0) return null;
        
        const t = f * this.dot(edge2, q);
        
        if (t > EPSILON) return t;
        
        return null;
    }

    public getTriangleCount(): number {
        return this.triangles.length;
    }
}
