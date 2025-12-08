import { PlayerMovement } from './PlayerMovement';
import { Input } from './Input';
import { CollisionSystem } from './Collision';

interface LadderOptions {
    thickness?: number;
    topExitPadding?: number;
}

interface LadderVolume {
    min: [number, number, number];
    max: [number, number, number];
}

export class LadderSystem {
    private ladders: LadderVolume[] = [];
    private climbSpeed = 4.5;

    public addLadderFromCorners(
        bottomRight: [number, number, number],
        bottomLeft: [number, number, number],
        topLeft: [number, number, number],
        topRight: [number, number, number],
        options: LadderOptions = {}
    ): void {
        const thickness = options.thickness ?? 0.35;
        const topExitPadding = options.topExitPadding ?? 0.25;

        const xs = [bottomRight[0], bottomLeft[0], topLeft[0], topRight[0]];
        const ys = [bottomRight[1], bottomLeft[1], topLeft[1], topRight[1]];
        const zs = [bottomRight[2], bottomLeft[2], topLeft[2], topRight[2]];

        const min: [number, number, number] = [
            Math.min(...xs) - thickness,
            Math.min(...ys),
            Math.min(...zs) - thickness,
        ];

        const max: [number, number, number] = [
            Math.max(...xs) + thickness,
            Math.max(...ys) + topExitPadding,
            Math.max(...zs) + thickness,
        ];

        this.ladders.push({ min, max });
    }

    private findLadder(pos: number[]): LadderVolume | null {
        for (const ladder of this.ladders) {
            if (
                pos[0] >= ladder.min[0] && pos[0] <= ladder.max[0] &&
                pos[1] >= ladder.min[1] - 0.2 && pos[1] <= ladder.max[1] + 0.2 &&
                pos[2] >= ladder.min[2] && pos[2] <= ladder.max[2]
            ) {
                return ladder;
            }
        }
        return null;
    }

    public update(
        deltaTime: number,
        player: PlayerMovement,
        input: Input,
        collision: CollisionSystem
    ): boolean {
        if (input.isKeyPressed('Space')) {
            return false;
        }

        const ladder = this.findLadder(player.position);
        if (!ladder) return false;

        const climbInput = (input.isKeyPressed('KeyW') ? 1 : 0) + (input.isKeyPressed('KeyS') ? -1 : 0);
        const climbVel = this.climbSpeed * climbInput;

        const targetY = Math.min(
            ladder.max[1],
            Math.max(ladder.min[1], player.position[1] + climbVel * deltaTime)
        );

        const targetPos: [number, number, number] = [
            Math.min(ladder.max[0], Math.max(ladder.min[0], player.position[0])),
            targetY,
            Math.min(ladder.max[2], Math.max(ladder.min[2], player.position[2])),
        ];

        const resolved = collision.resolveCollision(player.position, targetPos);
        player.position = resolved;
        player.velocity = [0, climbVel, 0];

        return true;
    }
}
