
import useGameStore from '../store/gameStore';
import { BlockType } from './blockTypes';
import { growCrop, updateFarmland, growSapling } from './farmingSystem';
import { CHUNK_SIZE, CHUNK_VOLUME } from './terrainGen';

const SIMULATION_DISTANCE = 6;
const ACTIVE_CACHE_MS = 250;
const RANDOM_TICKS_PER_CHUNK = 3;

interface ActiveChunkEntry {
    key: string;
    cx: number;
    cz: number;
}

let cachedActiveChunks: ActiveChunkEntry[] = [];
let cacheExpiryTime = 0;
let cachedPlayerChunkKey = '';
let cachedChunkCount = 0;

function rebuildActiveChunks(
    chunkKeys: string[],
    playerChunkX: number,
    playerChunkZ: number,
    now: number
) {
    const maxDistSq = SIMULATION_DISTANCE * SIMULATION_DISTANCE;
    cachedActiveChunks = [];

    for (const key of chunkKeys) {
        const parts = key.split(',');
        const cx = parseInt(parts[0], 10);
        const cz = parseInt(parts[1], 10);
        const dx = cx - playerChunkX;
        const dz = cz - playerChunkZ;

        if (dx * dx + dz * dz <= maxDistSq) {
            cachedActiveChunks.push({ key, cx, cz });
        }
    }

    cachedPlayerChunkKey = `${playerChunkX},${playerChunkZ}`;
    cachedChunkCount = chunkKeys.length;
    cacheExpiryTime = now + ACTIVE_CACHE_MS;
}

/**
 * Optimized Random Tick
 * 
 * Instead of scanning world coords (slow), we pick random indices in chunks.
 * We only convert to world coords if we hit a block that actually needs ticking.
 */
export const tickWorld = () => {
    const s = useGameStore.getState();
    const keys = Object.keys(s.chunks);
    if (keys.length === 0) {
        cachedActiveChunks = [];
        cachedChunkCount = 0;
        cachedPlayerChunkKey = '';
        cacheExpiryTime = 0;
        return;
    }

    const playerPos = s.playerPos;
    const pcx = Math.floor(playerPos[0] / CHUNK_SIZE);
    const pcz = Math.floor(playerPos[2] / CHUNK_SIZE);
    const currentPlayerChunkKey = `${pcx},${pcz}`;
    const now = performance.now();

    if (
        now >= cacheExpiryTime ||
        currentPlayerChunkKey !== cachedPlayerChunkKey ||
        keys.length !== cachedChunkCount
    ) {
        rebuildActiveChunks(keys, pcx, pcz, now);
    }

    if (cachedActiveChunks.length === 0) return;

    for (const { key, cx, cz } of cachedActiveChunks) {
        const chunk = s.chunks[key];
        if (!chunk) continue;

        for (let i = 0; i < RANDOM_TICKS_PER_CHUNK; i++) {
            // Pick random index directly from flat array
            const randIdx = Math.floor(Math.random() * CHUNK_VOLUME);
            const block = chunk[randIdx];

            // Fast exit for non-ticking blocks (Air, Stone, etc)
            if (block === BlockType.AIR || block === BlockType.STONE || block === BlockType.DIRT || block === BlockType.WATER) continue;

            const needsTick = (
                block === BlockType.GRASS ||
                block === BlockType.FARMLAND ||
                block === BlockType.OAK_SAPLING ||
                (block >= BlockType.WHEAT_0 && block < BlockType.WHEAT_7)
            );

            if (!needsTick) continue;

            // Reconstruct coordinates only when needed
            // index = (y << 8) | (lz << 4) | lx
            // y = index >> 8
            // lz = (index >> 4) & 0xF
            // lx = index & 0xF
            const ly = randIdx >> 8;
            const lz = (randIdx >> 4) & 0xF;
            const lx = randIdx & 0xF;
            const wx = cx * CHUNK_SIZE + lx;
            const wz = cz * CHUNK_SIZE + lz;

            // Logic
            if (block === BlockType.GRASS) {
                // Grass Spread / Death
                if (s.getBlock(wx, ly + 1, wz) !== BlockType.AIR) {
                    s.addBlock(wx, ly, wz, BlockType.DIRT);
                } else {
                    // Spread to dirt
                    // (Simplified: just check one random neighbor)
                    const dx = Math.floor(Math.random() * 3) - 1;
                    const dz = Math.floor(Math.random() * 3) - 1;
                    const dy = Math.floor(Math.random() * 3) - 1;
                    if (s.getBlock(wx + dx, ly + dy, wz + dz) === BlockType.DIRT &&
                        s.getBlock(wx + dx, ly + dy + 1, wz + dz) === BlockType.AIR) {
                        s.addBlock(wx + dx, ly + dy, wz + dz, BlockType.GRASS);
                    }
                }
            } else if (block === BlockType.FARMLAND) {
                updateFarmland(wx, ly, wz);
            } else if (block === BlockType.OAK_SAPLING) {
                // Chance to grow on random tick
                if (Math.random() < 0.05) growSapling(wx, ly, wz);
            } else if (block >= BlockType.WHEAT_0 && block < BlockType.WHEAT_7) {
                // Crop growth
                growCrop(wx, ly, wz);
            }
        }
    }
};
