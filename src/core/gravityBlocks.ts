/**
 * Gravity Block System — Sand & Gravel Physics
 *
 * When a block below sand/gravel is removed, the sand/gravel falls down
 * until it hits a solid block. Works like Minecraft's falling sand entities.
 *
 * Called after block removal to check if any gravity blocks above need to fall.
 */

import useGameStore from '../store/gameStore';
import { BlockType, BLOCK_DATA } from './blockTypes';
import { CHUNK_SIZE, MAX_HEIGHT } from './terrainGen';

// Blocks affected by gravity
const GRAVITY_BLOCKS = new Set([BlockType.SAND, BlockType.GRAVEL]);

/** Check and process gravity blocks above a removed block */
export function checkGravityAbove(x: number, y: number, z: number): void {
    const s = useGameStore.getState();

    // Check blocks above (up to 256)
    for (let checkY = y + 1; checkY < MAX_HEIGHT; checkY++) {
        const block = s.getBlock(x, checkY, z);
        if (!block || !GRAVITY_BLOCKS.has(block)) break; // stop at first non-gravity block

        // This gravity block needs to fall — find where it lands
        let landY = y;
        for (let fy = checkY - 1; fy >= 0; fy--) {
            const below = s.getBlock(x, fy, z);
            if (below && BLOCK_DATA[below]?.solid) {
                landY = fy + 1;
                break;
            }
            if (fy === 0) landY = 0;
        }

        // Move block from checkY to landY
        if (landY !== checkY) {
            s.removeBlock(x, checkY, z);
            s.addBlock(x, landY, z, block);
            bumpChunks(x, z);
        }
    }
}

/** Called whenever a specific gravity block might need to fall (e.g. just placed) */
export function checkGravityBlock(x: number, y: number, z: number): void {
    const s = useGameStore.getState();
    const block = s.getBlock(x, y, z);

    if (!block || !GRAVITY_BLOCKS.has(block)) return;

    let landY = y;
    for (let fy = y - 1; fy >= 0; fy--) {
        const below = s.getBlock(x, fy, z);
        if (below && BLOCK_DATA[below]?.solid) {
            landY = fy + 1;
            break;
        }
        if (fy === 0) landY = 0;
    }

    if (landY !== y) {
        s.removeBlock(x, y, z);
        s.addBlock(x, landY, z, block);
        bumpChunks(x, z);
    }
}

/** Called when any block is removed — check gravity for neighbors too */
export function processGravity(x: number, y: number, z: number): void {
    // Check directly above
    checkGravityAbove(x, y, z);
}

function bumpChunks(x: number, z: number): void {
    const s = useGameStore.getState();
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    s.bumpVersion(cx, cz);
    // Also bump adjacent chunks if on boundary
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    if (lx === 0) s.bumpVersion(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) s.bumpVersion(cx + 1, cz);
    if (lz === 0) s.bumpVersion(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) s.bumpVersion(cx, cz + 1);
}
