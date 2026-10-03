/**
 * Voxel Pathfinding / Navigation Mesh Alternative
 *
 * Uses Greedy Best-First Search on the generated terrain to
 * determine where the mob should move next, allowing it to jump
 * 1-block heights and avoid falling into lava.
 */

import { BLOCK_DATA, BlockType } from '../core/blockTypes';
import useGameStore from '../store/gameStore';

const DIRECTIONS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [-1, -1], [1, -1], [-1, 1],
] as const;
// Sorted in place for each synchronous query to avoid allocating direction
// tuples and a temporary array every time an entity asks for its next step.
const directionOrder = Uint8Array.from({ length: DIRECTIONS.length }, (_, i) => i);
const directionScores = new Float64Array(DIRECTIONS.length);

type WorldState = ReturnType<typeof useGameStore.getState>;

function solidInWorld(s: WorldState, x: number, y: number, z: number): boolean {
    const type = s.getBlock(x, y, z);
    return type !== 0 && (BLOCK_DATA[type]?.solid ?? false);
}

function dangerInWorld(s: WorldState, x: number, y: number, z: number): boolean {
    return s.getBlock(x, y, z) === BlockType.LAVA;
}

export function isSolid(x: number, y: number, z: number): boolean {
    return solidInWorld(useGameStore.getState(), x, y, z);
}

export function isDanger(x: number, y: number, z: number): boolean {
    return dangerInWorld(useGameStore.getState(), x, y, z);
}

export interface PathStep {
    x: number;
    y: number;
    z: number;
    jump: boolean;
}

/**
 * Returns the best adjacent block to move to to reach the target.
 */
export function getNextStep(
    startX: number, startY: number, startZ: number,
    targetX: number, targetY: number, targetZ: number
): PathStep | null {

    // Current block center (rounded)
    const bx = Math.floor(startX);
    const by = Math.floor(startY);
    const bz = Math.floor(startZ);

    const tx = Math.floor(targetX);
    const tz = Math.floor(targetZ);

    // If we're already exactly where we want to be, no step needed
    if (bx === tx && bz === tz) return null;

    const s = useGameStore.getState();
    for (let i = 0; i < DIRECTIONS.length; i++) {
        const [vx, vz] = DIRECTIONS[i];
        const dx = bx + vx - tx, dz = bz + vz - tz;
        directionScores[i] = dx * dx + dz * dz;
        directionOrder[i] = i;
    }
    directionOrder.sort((a, b) => directionScores[a] - directionScores[b]);

    for (const directionIndex of directionOrder) {
        const [vx, vz] = DIRECTIONS[directionIndex];
        const nx = bx + vx;
        const nz = bz + vz;

        // A diagonal step crosses both side cells. Checking only the destination
        // lets mobs clip through solid corners and skirt directly across lava.
        if (vx !== 0 && vz !== 0) {
            const blockedX = solidInWorld(s, bx + vx, by, bz) || solidInWorld(s, bx + vx, by + 1, bz);
            const blockedZ = solidInWorld(s, bx, by, bz + vz) || solidInWorld(s, bx, by + 1, bz + vz);
            const dangerousX = dangerInWorld(s, bx + vx, by, bz) || dangerInWorld(s, bx + vx, by - 1, bz);
            const dangerousZ = dangerInWorld(s, bx, by, bz + vz) || dangerInWorld(s, bx, by - 1, bz + vz);
            if (blockedX || blockedZ || dangerousX || dangerousZ) continue;
        }

        // 1. Check flat walk
        const blockedForward = solidInWorld(s, nx, by, nz) || solidInWorld(s, nx, by + 1, nz);
        const groundBelow = solidInWorld(s, nx, by - 1, nz);
        const flatDanger = dangerInWorld(s, nx, by, nz) || dangerInWorld(s, nx, by - 1, nz);

        if (!blockedForward && groundBelow && !flatDanger) {
            return { x: nx + 0.5, y: by, z: nz + 0.5, jump: false };
        }

        // 2. Check 1-block jump
        if (blockedForward) {
            // Need headroom above start and new block
            const headroomStart = !solidInWorld(s, bx, by + 2, bz);
            const headroomNext = !solidInWorld(s, nx, by + 1, nz) && !solidInWorld(s, nx, by + 2, nz);
            const stepUpSolid = solidInWorld(s, nx, by, nz);

            if (headroomStart && headroomNext && stepUpSolid && !dangerInWorld(s, nx, by + 1, nz)) {
                return { x: nx + 0.5, y: by + 1, z: nz + 0.5, jump: true };
            }
        }

        // 3. Check fall (up to 3 blocks)
        if (!blockedForward && !groundBelow) {
            for (let fall = 1; fall <= 3; fall++) {
                const fGround = solidInWorld(s, nx, by - fall - 1, nz);
                const fClear = !solidInWorld(s, nx, by - fall, nz) && !solidInWorld(s, nx, by - fall + 1, nz);
                if (fGround && fClear && !dangerInWorld(s, nx, by - fall, nz) && !dangerInWorld(s, nx, by - fall - 1, nz)) {
                    return { x: nx + 0.5, y: by - fall, z: nz + 0.5, jump: false };
                }
            }
        }
    }

    // Stuck or path blocked
    return null;
}
