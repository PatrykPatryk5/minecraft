/**
 * Voxel Pathfinding / Navigation Mesh Alternative
 *
 * Uses Greedy Best-First Search on the generated terrain to
 * determine where the mob should move next, allowing it to jump
 * 1-block heights and avoid falling into lava.
 */

import { BLOCK_DATA, BlockType } from '../core/blockTypes';
import useGameStore from '../store/gameStore';

export function isSolid(x: number, y: number, z: number): boolean {
    const s = useGameStore.getState();
    const type = s.getBlock(x, y, z);
    if (!type) return false;
    return BLOCK_DATA[type]?.solid ?? false;
}

export function isDanger(x: number, y: number, z: number): boolean {
    const s = useGameStore.getState();
    const type = s.getBlock(x, y, z);
    // Avoid walking into lava or fire
    return type === BlockType.LAVA;
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

    // 8-way adjacent directions
    const dirs = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [1, 1], [-1, -1], [1, -1], [-1, 1]
    ];

    // Sort directions by heuristic (closest to target)
    dirs.sort((a, b) => {
        const distA = Math.hypot((bx + a[0]) - tx, (bz + a[1]) - tz);
        const distB = Math.hypot((bx + b[0]) - tx, (bz + b[1]) - tz);
        return distA - distB;
    });

    for (const [vx, vz] of dirs) {
        const nx = bx + vx;
        const nz = bz + vz;

        // 1. Check flat walk
        const blockedForward = isSolid(nx, by, nz) || isSolid(nx, by + 1, nz);
        const groundBelow = isSolid(nx, by - 1, nz);
        const flatDanger = isDanger(nx, by, nz) || isDanger(nx, by - 1, nz);

        if (!blockedForward && groundBelow && !flatDanger) {
            return { x: nx + 0.5, y: by, z: nz + 0.5, jump: false };
        }

        // 2. Check 1-block jump
        if (blockedForward) {
            // Need headroom above start and new block
            const headroomStart = !isSolid(bx, by + 2, bz);
            const headroomNext = !isSolid(nx, by + 1, nz) && !isSolid(nx, by + 2, nz);
            const stepUpSolid = isSolid(nx, by, nz);

            if (headroomStart && headroomNext && stepUpSolid && !isDanger(nx, by + 1, nz)) {
                return { x: nx + 0.5, y: by + 1, z: nz + 0.5, jump: true };
            }
        }

        // 3. Check fall (up to 3 blocks)
        if (!blockedForward && !groundBelow) {
            for (let fall = 1; fall <= 3; fall++) {
                const fGround = isSolid(nx, by - fall - 1, nz);
                const fClear = !isSolid(nx, by - fall, nz) && !isSolid(nx, by - fall + 1, nz);
                if (fGround && fClear && !isDanger(nx, by - fall, nz) && !isDanger(nx, by - fall - 1, nz)) {
                    return { x: nx + 0.5, y: by - fall, z: nz + 0.5, jump: false };
                }
            }
        }
    }

    // Stuck or path blocked
    return null;
}
