export interface DeadZone {
    points: number[][];
    minY: number;
    maxY: number;
    name?: string | undefined;
}

export class DeadZoneSystem {
    private deadZones: DeadZone[] = [];
    private spawnPoint: number[] = [0, 2, 0];
    private lastTriggerTime: number = 0;
    private triggerCooldown: number = 500; // ms entre triggers para evitar spam

    constructor() {}

    public setSpawnPoint(x: number, y: number, z: number): void {
        this.spawnPoint = [x, y, z];
    }

    public getSpawnPoint(): number[] {
        return [...this.spawnPoint];
    }

    public addDeadZone(points: number[][], minY: number, maxY?: number, name?: string): void {
        if (points.length < 3) {
            console.warn('DeadZoneSystem: Uma zona precisa de pelo menos 3 pontos');
            return;
        }

        let finalMinY: number;
        let finalMaxY: number;

        if (maxY === undefined) {
            let avgY = 0;
            for (const p of points) {
                avgY += p[1];
            }
            avgY /= points.length;
            finalMinY = avgY - minY;
            finalMaxY = avgY + minY;
        } else {
            finalMinY = minY;
            finalMaxY = maxY;
        }

        const deadZone: DeadZone = {
            points: points.map(p => [...p]),
            minY: finalMinY,
            maxY: finalMaxY,
            name
        };

        this.deadZones.push(deadZone);
        console.log(`DeadZoneSystem: Adicionada zona '${name || 'unnamed'}' com ${points.length} pontos (Y: ${finalMinY.toFixed(2)} - ${finalMaxY.toFixed(2)})`);
    }

    public addDeadZoneBox(min: number[], max: number[], name?: string): void {
        const points = [
            [min[0], min[1], min[2]],
            [max[0], min[1], min[2]],
            [max[0], min[1], max[2]],
            [min[0], min[1], max[2]]
        ];

        const deadZone: DeadZone = {
            points,
            minY: min[1],
            maxY: max[1],
            name
        };

        this.deadZones.push(deadZone);
        console.log(`DeadZoneSystem: Adicionada zona box '${name || 'unnamed'}'`);
    }

    public addKillFloor(height: number, name?: string): void {
        const size = 10000;
        const points = [
            [-size, height, -size],
            [size, height, -size],
            [size, height, size],
            [-size, height, size]
        ];

        const deadZone: DeadZone = {
            points,
            minY: -Infinity,
            maxY: height,
            name: name || 'kill_floor'
        };

        this.deadZones.push(deadZone);
        console.log(`DeadZoneSystem: Adicionado kill floor em Y=${height}`);
    }

    public checkPlayerInDeadZone(position: number[]): boolean {
        const now = performance.now();
        if (now - this.lastTriggerTime < this.triggerCooldown) {
            return false;
        }

        for (const zone of this.deadZones) {
            if (this.isPointInDeadZone(position, zone)) {
                this.lastTriggerTime = now;
                console.log(`DeadZoneSystem: Jogador entrou na zona '${zone.name || 'unnamed'}'`);
                return true;
            }
        }

        return false;
    }

    private isPointInDeadZone(point: number[], zone: DeadZone): boolean {
        if (point[1] < zone.minY || point[1] > zone.maxY) {
            return false;
        }

        return this.isPointInPolygon(point[0], point[2], zone.points);
    }

    private isPointInPolygon(x: number, z: number, polygon: number[][]): boolean {
        let inside = false;
        const n = polygon.length;

        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = polygon[i][0], zi = polygon[i][2];
            const xj = polygon[j][0], zj = polygon[j][2];

            if (((zi > z) !== (zj > z)) &&
                (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) {
                inside = !inside;
            }
        }

        return inside;
    }

    public clear(): void {
        this.deadZones = [];
    }

    public getZoneCount(): number {
        return this.deadZones.length;
    }

    public getZonesInfo(): { name: string, pointCount: number, minY: number, maxY: number }[] {
        return this.deadZones.map(zone => ({
            name: zone.name || 'unnamed',
            pointCount: zone.points.length,
            minY: zone.minY,
            maxY: zone.maxY
        }));
    }
}

export function createXmasDeadZones(spawnPoint: number[]): DeadZoneSystem {
    const system = new DeadZoneSystem();
    system.setSpawnPoint(spawnPoint[0], spawnPoint[1], spawnPoint[2]);

    const xmasMainZone = [
        [5.675, 5.619, -6.023],
        [4.248, 5.630, -7.662],
        [3.173, 5.630, -6.980],
        [1.660, 5.630, -9.938],
        [0.861, 5.630, -12.522],
        [0.599, 5.630, -15.590],
        [0.979, 5.630, -18.353],
        [1.765, 5.630, -21.093],
        [3.349, 5.630, -23.813],
        [5.159, 5.630, -25.991],
        [6.852, 5.630, -27.378],
        [2.905, 5.634, -33.301],
        [0.242, 5.634, -30.582],
        [-2.697, 5.634, -27.372],
        [-4.592, 5.634, -23.374],
        [-5.678, 5.634, -19.733],
        [-6.411, 5.634, -15.313],
        [-5.949, 5.634, -10.953],
        [-4.719, 5.634, -7.062],
        [-2.669, 5.634, -3.032],
        [-3.577, 5.603, -2.425],
        [-1.696, 5.603, -0.596],
        [0.085, 5.603, -0.228]
    ];

    system.addDeadZone(xmasMainZone, -5.0, 27.7, 'xmas_main_deadzone');
    
    system.addKillFloor(-10, 'global_kill_floor');

    return system;
}
