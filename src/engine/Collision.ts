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

interface SpatialCell {
    triangles: Triangle[];
}

export class CollisionSystem {
    private triangles: Triangle[] = [];
    private playerRadius: number;
    private playerHeight: number;
    private eyeHeight: number;
    
    // angulo maximo para ser considerado um chão
    private minGroundNormalY: number = 0.7; // cos(45°) ~ 0.707 - angulo max de ~45 graus
    private maxSlopeAngle: number = Math.acos(0.7); // ~45 graus em radianos

    // particionamento espacial 
    private spatialGrid: Map<string, SpatialCell> = new Map();
    private cellSize: number = 8;
    private gridMin: number[] = [0, 0, 0];
    private gridMax: number[] = [0, 0, 0];

    private readonly _tempVec1: number[] = [0, 0, 0];
    private readonly _tempVec2: number[] = [0, 0, 0];
    private readonly _tempVec3: number[] = [0, 0, 0];
    private readonly _queriedCells: Set<string> = new Set();
    private readonly _nearbyTriangles: Triangle[] = [];

    constructor(playerRadius: number = 0.3, playerHeight: number = 1.8, eyeHeight: number = 1.6) {
        this.playerRadius = playerRadius;
        this.playerHeight = playerHeight;
        this.eyeHeight = eyeHeight;
    }

    public loadMeshCollision(mesh: Mesh): void {
        this.triangles = [];
        this.spatialGrid.clear();
        
        const vertices = mesh.vertexData;
        const indices = mesh.indexData;
        
        // Cada vértice tem 8 floats: 3 pos + 2 uv + 3 normal
        const stride = 8;

        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        
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
            
            const tri: Triangle = { v0, v1, v2, normal };
            this.triangles.push(tri);

            const triMinX = Math.min(v0[0], v1[0], v2[0]);
            const triMinY = Math.min(v0[1], v1[1], v2[1]);
            const triMinZ = Math.min(v0[2], v1[2], v2[2]);
            const triMaxX = Math.max(v0[0], v1[0], v2[0]);
            const triMaxY = Math.max(v0[1], v1[1], v2[1]);
            const triMaxZ = Math.max(v0[2], v1[2], v2[2]);

            minX = Math.min(minX, triMinX);
            minY = Math.min(minY, triMinY);
            minZ = Math.min(minZ, triMinZ);
            maxX = Math.max(maxX, triMaxX);
            maxY = Math.max(maxY, triMaxY);
            maxZ = Math.max(maxZ, triMaxZ);
        }

        this.gridMin = [minX, minY, minZ];
        this.gridMax = [maxX, maxY, maxZ];

        for (const tri of this.triangles) {
            this.insertTriangleIntoGrid(tri);
        }
        
        console.log(`CollisionSystem: Carregados ${this.triangles.length} triângulos para colisão (grid cells: ${this.spatialGrid.size})`);
    }

    private getCellKey(x: number, y: number, z: number): string {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        const cz = Math.floor(z / this.cellSize);
        return `${cx},${cy},${cz}`;
    }

    private insertTriangleIntoGrid(tri: Triangle): void {
        const { v0, v1, v2 } = tri;
        const minX = Math.min(v0[0], v1[0], v2[0]);
        const minY = Math.min(v0[1], v1[1], v2[1]);
        const minZ = Math.min(v0[2], v1[2], v2[2]);
        const maxX = Math.max(v0[0], v1[0], v2[0]);
        const maxY = Math.max(v0[1], v1[1], v2[1]);
        const maxZ = Math.max(v0[2], v1[2], v2[2]);

        const startX = Math.floor(minX / this.cellSize);
        const startY = Math.floor(minY / this.cellSize);
        const startZ = Math.floor(minZ / this.cellSize);
        const endX = Math.floor(maxX / this.cellSize);
        const endY = Math.floor(maxY / this.cellSize);
        const endZ = Math.floor(maxZ / this.cellSize);

        for (let cx = startX; cx <= endX; cx++) {
            for (let cy = startY; cy <= endY; cy++) {
                for (let cz = startZ; cz <= endZ; cz++) {
                    const key = `${cx},${cy},${cz}`;
                    let cell = this.spatialGrid.get(key);
                    if (!cell) {
                        cell = { triangles: [] };
                        this.spatialGrid.set(key, cell);
                    }
                    cell.triangles.push(tri);
                }
            }
        }
    }

    private getNearbyTriangles(position: number[], radius: number): Triangle[] {
        this._nearbyTriangles.length = 0;
        this._queriedCells.clear();

        const minX = Math.floor((position[0] - radius) / this.cellSize);
        const minY = Math.floor((position[1] - radius) / this.cellSize);
        const minZ = Math.floor((position[2] - radius) / this.cellSize);
        const maxX = Math.floor((position[0] + radius) / this.cellSize);
        const maxY = Math.floor((position[1] + radius) / this.cellSize);
        const maxZ = Math.floor((position[2] + radius) / this.cellSize);

        for (let cx = minX; cx <= maxX; cx++) {
            for (let cy = minY; cy <= maxY; cy++) {
                for (let cz = minZ; cz <= maxZ; cz++) {
                    const key = `${cx},${cy},${cz}`;
                    if (this._queriedCells.has(key)) continue;
                    this._queriedCells.add(key);
                    
                    const cell = this.spatialGrid.get(key);
                    if (cell) {
                        for (const tri of cell.triangles) {
                            if (this._nearbyTriangles.indexOf(tri) === -1) {
                                this._nearbyTriangles.push(tri);
                            }
                        }
                    }
                }
            }
        }

        return this._nearbyTriangles;
    }

    public resolveCollision(oldPos: number[], newPos: number[]): number[] {
        let resultPos = [...newPos];

        const groundHeight = this.getGroundHeightFast(resultPos);
        if (groundHeight !== null) {
            const minY = groundHeight + this.eyeHeight + 0.05;
            if (resultPos[1] < minY) {
                resultPos[1] = minY;
            }
        }
        
        const feetY = resultPos[1] - this.eyeHeight;
        const sphereCenterY = feetY + this.playerHeight / 2;
        
        const playerSphere = {
            center: [resultPos[0], sphereCenterY, resultPos[2]],
            radius: this.playerRadius
        };

        const queryRadius = this.playerRadius + this.playerHeight;
        const nearbyTris = this.getNearbyTriangles(resultPos, queryRadius);

        for (let iteration = 0; iteration < 3; iteration++) {
            let hadCollision = false;
            
            for (const tri of nearbyTris) {
                const collision = this.sphereTriangleCollision(playerSphere, tri);
                
                if (collision.collided) {
                    hadCollision = true;

                    const isWalkable = tri.normal[1] >= this.minGroundNormalY;
                    
                    let pushNormal = collision.normal;
                    
                    const normalDot = this.dot(collision.normal, tri.normal);
                    if (normalDot < 0.5) {
                        pushNormal = collision.normal;
                    }
                    
                    if (isWalkable) {
                        const pushVector = vec3.scale(pushNormal, collision.depth + 0.01);
                        resultPos[0] += pushVector[0];
                        resultPos[1] += pushVector[1];
                        resultPos[2] += pushVector[2];
                    } else {
                        const horizontalLen = Math.sqrt(pushNormal[0] * pushNormal[0] + pushNormal[2] * pushNormal[2]);
                        
                        if (horizontalLen > 0.001) {
                            const horizontalNormal = [pushNormal[0] / horizontalLen, 0, pushNormal[2] / horizontalLen];
                            const pushVector = vec3.scale(horizontalNormal, collision.depth + 0.01);
                            resultPos[0] += pushVector[0];
                            resultPos[2] += pushVector[2];
                        }
                    }
                    
                    const newFeetY = resultPos[1] - this.eyeHeight;
                    const newSphereCenterY = newFeetY + this.playerHeight / 2;
                    playerSphere.center = [resultPos[0], newSphereCenterY, resultPos[2]];
                }
            }
            
            if (!hadCollision) break;
        }
        
        const finalGroundHeight = this.getGroundHeight(resultPos);
        if (finalGroundHeight !== null) {
            const minY = finalGroundHeight + this.eyeHeight;
            if (resultPos[1] < minY) {
                resultPos[1] = minY;
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

    private getGroundHeightFast(position: number[]): number | null {
        const rayDir = [0, -1, 0];
        let closestHit: number | null = null;
        
        const searchRadius = this.playerRadius + 2;
        const nearbyTris = this.getNearbyTriangles(
            [position[0], position[1] - this.playerHeight, position[2]], 
            searchRadius + this.playerHeight
        );
        
        for (const tri of nearbyTris) {
            if (tri.normal[1] < 0.2) continue;
            
            const rayOrigin = [position[0], position[1] + 10, position[2]];
            const hit = this.rayTriangleIntersection(rayOrigin, rayDir, tri);
            if (hit !== null) {
                const groundY = rayOrigin[1] + hit * rayDir[1];
                if (groundY <= position[1] + 0.001) {
                    if (closestHit === null || groundY > closestHit) {
                        closestHit = groundY;
                    }
                }
            }
        }

        const infiniteGroundY = 0;
        if (infiniteGroundY <= position[1] + 0.001) {
            if (closestHit === null || infiniteGroundY > closestHit) {
                closestHit = infiniteGroundY;
            }
        }
        
        return closestHit;
    }

    public getGroundHeight(position: number[]): number | null {
        return this.getGroundHeightFast(position);
    }

    public getGroundInfo(position: number[]): { height: number, normal: number[], isWalkable: boolean } | null {
        const rayDir = [0, -1, 0];
        let closestHit: { height: number, normal: number[], isWalkable: boolean } | null = null;
        let closestDist = Infinity;
        
        const searchRadius = this.playerRadius + 2;
        const nearbyTris = this.getNearbyTriangles(
            [position[0], position[1] - this.playerHeight, position[2]], 
            searchRadius + this.playerHeight
        );
        
        for (const tri of nearbyTris) {
            // ignora normais muito pequenas (triângulos degenerados)
            const normalLen = Math.sqrt(tri.normal[0] * tri.normal[0] + tri.normal[1] * tri.normal[1] + tri.normal[2] * tri.normal[2]);
            if (normalLen < 0.001) continue;
            
            if (tri.normal[1] < 0.1) continue;
            
            const rayOrigin = [position[0], position[1] + 10, position[2]];
            const hit = this.rayTriangleIntersection(rayOrigin, rayDir, tri);
            if (hit !== null) {
                const groundY = rayOrigin[1] + hit * rayDir[1];
                if (groundY <= position[1] + 0.001) {
                    const dist = position[1] - groundY;
                    if (dist < closestDist) {
                        closestDist = dist;
                        const isWalkable = tri.normal[1] >= this.minGroundNormalY;
                        closestHit = {
                            height: groundY,
                            normal: [...tri.normal],
                            isWalkable
                        };
                    }
                }
            }
        }

        const infiniteGroundY = 0;
        if (infiniteGroundY <= position[1] + 0.001) {
            const dist = position[1] - infiniteGroundY;
            if (closestHit === null || dist < closestDist) {
                closestHit = {
                    height: infiniteGroundY,
                    normal: [0, 1, 0],
                    isWalkable: true
                };
            }
        }
        
        return closestHit;
    }

    public getMinGroundNormalY(): number {
        return this.minGroundNormalY;
    }

    public getMaxSlopeAngle(): number {
        return this.maxSlopeAngle;
    }

    public raycast(origin: number[], direction: number[], maxDistance: number = 2000): { point: number[], distance: number, normal: number[] } | null {
        const dir = vec3.normalize(direction);
        let bestT = maxDistance;
        let bestHit: { point: number[], distance: number, normal: number[] } | null = null;

        for (const tri of this.triangles) {
            const t = this.rayTriangleIntersection(origin, dir, tri);
            if (t !== null && t > 0 && t < bestT) {
                bestT = t;
                const point = [
                    origin[0] + dir[0] * t,
                    origin[1] + dir[1] * t,
                    origin[2] + dir[2] * t,
                ];
                bestHit = { point, distance: t, normal: tri.normal };
            }
        }

        const EPS = 1e-5;
        if (Math.abs(dir[1]) > EPS) {
            const tPlane = (0 - origin[1]) / dir[1];
            if (tPlane > 0 && tPlane < bestT && tPlane < maxDistance) {
                bestT = tPlane;
                const point = [
                    origin[0] + dir[0] * tPlane,
                    origin[1] + dir[1] * tPlane,
                    origin[2] + dir[2] * tPlane,
                ];
                bestHit = { point, distance: tPlane, normal: [0, 1, 0] };
            }
        }

        return bestHit;
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
