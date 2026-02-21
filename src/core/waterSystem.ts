/**
 * Water System — Simple BFS-based water spreading
 *
 * When water is placed or an adjacent block is removed, water flows
 * outward up to 7 blocks from the source, and downward indefinitely.
 * Simplified: treats all water as full blocks (no partial levels).
 */

import useGameStore, { chunkKey } from '../store/gameStore';
import { BlockType, BLOCK_DATA } from './blockTypes';
import { blockIndex } from './terrainGen';

const MAX_SPREAD = 7;
const SPREAD_DELAY = 100; // ms between spread ticks

interface SpreadEntry {
    x: number;
    y: number;
    z: number;
    distance: number;
}

/**
 * Trigger water spread from a position.
 * Call this when a water block is placed or a block adjacent to water is removed.
 */
export function spreadWater(sx: number, sy: number, sz: number): void {
    const s = useGameStore.getState();

    // Only spread from water source blocks
    if (s.getBlock(sx, sy, sz) !== BlockType.WATER) return;

    const queue: SpreadEntry[] = [{ x: sx, y: sy, z: sz, distance: 0 }];
    const visited = new Set<string>();
    visited.add(`${sx},${sy},${sz}`);

    let tickDelay = 0;

    while (queue.length > 0) {
        const current = queue.shift()!;
        const { x, y, z, distance } = current;

        if (distance > MAX_SPREAD) continue;

        // Try to flow downward first (infinite distance down)
        const belowType = s.getBlock(x, y - 1, z);
        if (y > 0 && canWaterReplace(belowType)) {
            const key = `${x},${y - 1},${z}`;
            if (!visited.has(key)) {
                visited.add(key);
                schedulePlace(x, y - 1, z, tickDelay);
                tickDelay += SPREAD_DELAY;
                queue.push({ x, y: y - 1, z, distance: 0 }); // Reset distance when flowing down
            }
        }

        // Flow horizontal (limited by MAX_SPREAD)
        if (distance < MAX_SPREAD) {
            const neighbors = [
                [x + 1, y, z],
                [x - 1, y, z],
                [x, y, z + 1],
                [x, y, z - 1],
            ];

            for (const [nx, ny, nz] of neighbors) {
                const key = `${nx},${ny},${nz}`;
                if (visited.has(key)) continue;

                const type = s.getBlock(nx, ny, nz);
                if (canWaterReplace(type)) {
                    visited.add(key);
                    schedulePlace(nx, ny, nz, tickDelay);
                    tickDelay += SPREAD_DELAY;
                    queue.push({ x: nx, y: ny, z: nz, distance: distance + 1 });
                }
            }
        }
    }
}

/**
 * Called when a block is removed near water — check if surrounding water should flow in
 */
export function checkWaterFill(x: number, y: number, z: number): void {
    const s = useGameStore.getState();

    // Check neighbors that can flow into this empty block (sides and above)
    const neighbors = [
        [x + 1, y, z], [x - 1, y, z],
        [x, y + 1, z],
        [x, y, z + 1], [x, y, z - 1],
    ];

    for (const [nx, ny, nz] of neighbors) {
        if (s.getBlock(nx, ny, nz) === BlockType.WATER) {
            // Water found adjacent — schedule fill
            setTimeout(() => {
                const current = useGameStore.getState().getBlock(x, y, z);
                if (canWaterReplace(current)) {
                    useGameStore.getState().addBlock(x, y, z, BlockType.WATER);
                    // Continue spreading from this new water block
                    spreadWater(x, y, z);
                }
            }, SPREAD_DELAY);
            break; // Only need to trigger once
        }
    }
}

/**
 * Called when a new chunk is generated/loaded.
 * Checks the borders (x=0, x=15, z=0, z=15) to see if water should flow in from neighbors.
 */
export function checkChunkBorders(cx: number, cz: number): void {
    const s = useGameStore.getState();
    const currentChunk = s.chunks[chunkKey(cx, cz)];
    if (!currentChunk) return;

    const worldX = cx * 16;
    const worldZ = cz * 16;
    const spreadSeeds: Array<[number, number, number]> = [];
    let changed = false;

    const trySetWater = (
        chunk: Uint16Array,
        lx: number,
        y: number,
        lz: number,
        wx: number,
        wz: number
    ) => {
        const idx = blockIndex(lx, y, lz);
        const raw = chunk[idx];
        const id = raw & 0x0FFF;
        if (!canWaterReplace(id)) return;
        chunk[idx] = (raw & 0xF000) | BlockType.WATER;
        spreadSeeds.push([wx, y, wz]);
        changed = true;
    };

    const syncFace = (
        nbChunk: Uint16Array | undefined,
        localX: number | null,
        localZ: number | null,
        nbX: number | null,
        nbZ: number | null,
        dirX: number,
        dirZ: number
    ) => {
        if (!nbChunk) return;

        if (localX !== null && nbX !== null) {
            // east/west face
            for (let y = 0; y < 256; y++) {
                for (let z = 0; z < 16; z++) {
                    const localIdx = blockIndex(localX, y, z);
                    const nbIdx = blockIndex(nbX, y, z);
                    const localId = currentChunk[localIdx] & 0x0FFF;
                    const nbId = nbChunk[nbIdx] & 0x0FFF;

                    if (nbId === BlockType.WATER && canWaterReplace(localId)) {
                        trySetWater(currentChunk, localX, y, z, worldX + localX, worldZ + z);
                    } else if (localId === BlockType.WATER && canWaterReplace(nbId)) {
                        trySetWater(nbChunk, nbX, y, z, worldX + localX + dirX, worldZ + z + dirZ);
                    }
                }
            }
        } else if (localZ !== null && nbZ !== null) {
            // north/south face
            for (let y = 0; y < 256; y++) {
                for (let x = 0; x < 16; x++) {
                    const localIdx = blockIndex(x, y, localZ);
                    const nbIdx = blockIndex(x, y, nbZ);
                    const localId = currentChunk[localIdx] & 0x0FFF;
                    const nbId = nbChunk[nbIdx] & 0x0FFF;

                    if (nbId === BlockType.WATER && canWaterReplace(localId)) {
                        trySetWater(currentChunk, x, y, localZ, worldX + x, worldZ + localZ);
                    } else if (localId === BlockType.WATER && canWaterReplace(nbId)) {
                        trySetWater(nbChunk, x, y, nbZ, worldX + x + dirX, worldZ + localZ + dirZ);
                    }
                }
            }
        }
    };

    syncFace(s.chunks[chunkKey(cx - 1, cz)], 0, null, 15, null, -1, 0);
    syncFace(s.chunks[chunkKey(cx + 1, cz)], 15, null, 0, null, 1, 0);
    syncFace(s.chunks[chunkKey(cx, cz - 1)], null, 0, null, 15, 0, -1);
    syncFace(s.chunks[chunkKey(cx, cz + 1)], null, 15, null, 0, 0, 1);

    if (!changed) return;

    // Refresh local and adjacent chunk meshes once after a bulk sync.
    s.bumpVersion(cx, cz);
    if (s.chunks[chunkKey(cx - 1, cz)]) s.bumpVersion(cx - 1, cz);
    if (s.chunks[chunkKey(cx + 1, cz)]) s.bumpVersion(cx + 1, cz);
    if (s.chunks[chunkKey(cx, cz - 1)]) s.bumpVersion(cx, cz - 1);
    if (s.chunks[chunkKey(cx, cz + 1)]) s.bumpVersion(cx, cz + 1);

    // Continue local flow from a capped seed list to avoid spikes.
    const maxSeeds = Math.min(12, spreadSeeds.length);
    for (let i = 0; i < maxSeeds; i++) {
        const [x, y, z] = spreadSeeds[i];
        setTimeout(() => spreadWater(x, y, z), SPREAD_DELAY);
    }
}

function canWaterReplace(blockType: number): boolean {
    if (blockType === BlockType.AIR) return true;
    if (blockType === BlockType.WATER) return false; // Already water
    const data = BLOCK_DATA[blockType];
    if (!data) return false;
    return !data.solid && blockType !== BlockType.WATER;
}

function schedulePlace(x: number, y: number, z: number, delay: number): void {
    setTimeout(() => {
        const s = useGameStore.getState();
        const current = s.getBlock(x, y, z);
        if (canWaterReplace(current)) {
            s.addBlock(x, y, z, BlockType.WATER);
        }
    }, delay);
}

