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
import { playSound } from '../audio/sounds';

const MAX_SPREAD = 7;
const SPREAD_DELAY = 100; // ms between spread ticks
const MAX_WATER_BATCH = 64;

interface SpreadEntry {
    x: number;
    y: number;
    z: number;
    distance: number;
}

interface ScheduledWater {
    x: number;
    y: number;
    z: number;
    dimension: string;
    worldSeed: number;
    dueAt: number;
}

const scheduledWater = new Map<string, ScheduledWater>();
const pendingFillChecks = new Set<string>();
let waterFlushTimer: ReturnType<typeof setTimeout> | null = null;
let waterFlushDueAt = Infinity;

function scheduleWaterFlush(dueAt: number): void {
    if (waterFlushTimer && dueAt >= waterFlushDueAt) return;
    if (waterFlushTimer) clearTimeout(waterFlushTimer);
    waterFlushDueAt = dueAt;
    waterFlushTimer = setTimeout(flushScheduledWater, Math.max(0, dueAt - performance.now()));
}

function flushScheduledWater(): void {
    waterFlushTimer = null;
    waterFlushDueAt = Infinity;
    const now = performance.now();
    const ready: ScheduledWater[] = [];
    let nextDueAt = Infinity;

    for (const [key, placement] of scheduledWater) {
        if (placement.dueAt <= now && ready.length < MAX_WATER_BATCH) {
            ready.push(placement);
            scheduledWater.delete(key);
        } else {
            nextDueAt = Math.min(nextDueAt, placement.dueAt);
        }
    }

    if (ready.length > 0) {
        const state = useGameStore.getState();
        const blocks = ready
            .filter(({ x, y, z, dimension, worldSeed }) =>
                dimension === state.dimension && worldSeed === state.worldSeed && canWaterReplace(state.getBlock(x, y, z)))
            .map(({ x, y, z }) => ({ x, y, z, typeId: BlockType.WATER }));
        if (blocks.length > 0) state.addBlocks(blocks, false, true);
    }

    if (scheduledWater.size > 0) {
        scheduleWaterFlush(nextDueAt === Infinity ? performance.now() : nextDueAt);
    }
}

/**
 * Trigger water spread from a position.
 * Call this when a water block is placed or a block adjacent to water is removed.
 */
export function spreadWater(sx: number, sy: number, sz: number): void {
    const s = useGameStore.getState();
    const dimension = s.dimension;
    const worldSeed = s.worldSeed;

    // Only spread from water source blocks
    if (s.getBlock(sx, sy, sz) !== BlockType.WATER) return;

    const queue: SpreadEntry[] = [{ x: sx, y: sy, z: sz, distance: 0 }];
    const visited = new Set<string>();
    visited.add(`${sx},${sy},${sz}`);

    let queueIndex = 0;
    while (queueIndex < queue.length) {
        const current = queue[queueIndex++];
        const { x, y, z, distance } = current;

        if (distance > MAX_SPREAD) continue;

        // Try to flow downward first (infinite distance down)
        const belowType = s.getBlock(x, y - 1, z);
        if (y > 0 && canWaterReplace(belowType)) {
            const key = `${x},${y - 1},${z}`;
            if (!visited.has(key)) {
                visited.add(key);
                schedulePlace(x, y - 1, z, 0, dimension, worldSeed);
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
                    schedulePlace(nx, ny, nz, (distance + 1) * SPREAD_DELAY, dimension, worldSeed);
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
    const dimension = s.dimension;
    const worldSeed = s.worldSeed;
    const key = `${dimension}|${worldSeed}|${x},${y},${z}`;
    if (pendingFillChecks.has(key)) return;

    // Check neighbors that can flow into this empty block (sides and above)
    const neighbors = [
        [x + 1, y, z], [x - 1, y, z],
        [x, y + 1, z],
        [x, y, z + 1], [x, y, z - 1],
    ];

    for (const [nx, ny, nz] of neighbors) {
        if (s.getBlock(nx, ny, nz) === BlockType.WATER) {
            // Water found adjacent — schedule fill
            pendingFillChecks.add(key);
            setTimeout(() => {
                pendingFillChecks.delete(key);
                const state = useGameStore.getState();
                if (state.dimension !== dimension || state.worldSeed !== worldSeed) return;
                const current = state.getBlock(x, y, z);
                if (canWaterReplace(current)) {
                    state.addBlock(x, y, z, BlockType.WATER);
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
    const dimension = s.dimension;
    const worldSeed = s.worldSeed;
    const currentChunk = s.chunks[chunkKey(cx, cz)];
    if (!currentChunk) return;

    const worldX = cx * 16;
    const worldZ = cz * 16;
    const spreadSeeds: Array<[number, number, number]> = [];
    const changedChunks = new Set<string>();

    const trySetWater = (
        chunk: Uint16Array,
        key: string,
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
        changedChunks.add(key);
    };

    const syncFace = (
        nbChunk: Uint16Array | undefined,
        localX: number | null,
        localZ: number | null,
        nbX: number | null,
        nbZ: number | null,
        nbKey: string,
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
                        trySetWater(currentChunk, chunkKey(cx, cz), localX, y, z, worldX + localX, worldZ + z);
                    } else if (localId === BlockType.WATER && canWaterReplace(nbId)) {
                        trySetWater(nbChunk, nbKey, nbX, y, z, worldX + localX + dirX, worldZ + z + dirZ);
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
                        trySetWater(currentChunk, chunkKey(cx, cz), x, y, localZ, worldX + x, worldZ + localZ);
                    } else if (localId === BlockType.WATER && canWaterReplace(nbId)) {
                        trySetWater(nbChunk, nbKey, x, y, nbZ, worldX + x + dirX, worldZ + localZ + dirZ);
                    }
                }
            }
        }
    };

    syncFace(s.chunks[chunkKey(cx - 1, cz)], 0, null, 15, null, chunkKey(cx - 1, cz), -1, 0);
    syncFace(s.chunks[chunkKey(cx + 1, cz)], 15, null, 0, null, chunkKey(cx + 1, cz), 1, 0);
    syncFace(s.chunks[chunkKey(cx, cz - 1)], null, 0, null, 15, chunkKey(cx, cz - 1), 0, -1);
    syncFace(s.chunks[chunkKey(cx, cz + 1)], null, 15, null, 0, chunkKey(cx, cz + 1), 0, 1);

    if (changedChunks.size === 0) return;

    for (const key of changedChunks) {
        const [changedCx, changedCz] = key.split(',').map(Number);
        s.bumpVersion(changedCx, changedCz);
    }

    // Continue local flow from a capped seed list to avoid spikes.
    const maxSeeds = Math.min(12, spreadSeeds.length);
    for (let i = 0; i < maxSeeds; i++) {
        const [x, y, z] = spreadSeeds[i];
        setTimeout(() => {
            const state = useGameStore.getState();
            if (state.dimension === dimension && state.worldSeed === worldSeed) spreadWater(x, y, z);
        }, SPREAD_DELAY);
    }
}

function canWaterReplace(blockType: number): boolean {
    if (blockType === BlockType.AIR) return true;
    if (blockType === BlockType.WATER) return false; // Already water
    const data = BLOCK_DATA[blockType];
    if (!data) return false;
    return !data.solid && blockType !== BlockType.WATER;
}

/**
 * Places a sponge, absorbing water in a 6 block radius.
 * If water is absorbed, the sponge becomes a wet sponge.
 */
export function placeSponge(x: number, y: number, z: number): void {
    const s = useGameStore.getState();
    const dimension = s.dimension;
    const worldSeed = s.worldSeed;
    const radius = 6;
    let absorbed = false;
    const toRemove: [number, number, number][] = [];

    // Scan standard cube centered around the sponge
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dz = -radius; dz <= radius; dz++) {
                // Manhattan distance check to make it more spherical (authentic sponge behavior)
                if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > radius + 1) continue;

                const bx = x + dx;
                const by = y + dy;
                const bz = z + dz;
                const type = s.getBlock(bx, by, bz);

                if (type === BlockType.WATER) {
                    toRemove.push([bx, by, bz]);
                    absorbed = true;
                }
            }
        }
    }

    // Remove the water and convert to wet sponge
    if (absorbed) {
        if (toRemove.length > 50) {
            // Batch remove for performance if huge
            for (let i = 0; i < toRemove.length; i += 50) {
                setTimeout(() => {
                    const state = useGameStore.getState();
                    if (state.dimension === dimension && state.worldSeed === worldSeed) s.removeBlocks(toRemove.slice(i, i + 50));
                }, Math.floor(i / 50) * 50);
            }
        } else {
            s.removeBlocks(toRemove);
        }

        s.addBlock(x, y, z, BlockType.WET_SPONGE);

        // Play fizz sound
        playSound('fuse'); // generic fizz available

        // Emit particles
        import('../core/particles').then(({ emitBlockBreak }) => {
            emitBlockBreak(x, y + 1, z, BlockType.WATER);
        });
    }
}

function schedulePlace(x: number, y: number, z: number, delay: number, dimension: string, worldSeed: number): void {
    const key = `${dimension}|${worldSeed}|${x},${y},${z}`;
    const dueAt = performance.now() + Math.max(0, delay);
    const existing = scheduledWater.get(key);
    if (existing && existing.dueAt <= dueAt) return;

    scheduledWater.set(key, { x, y, z, dimension, worldSeed, dueAt });
    scheduleWaterFlush(dueAt);
}

