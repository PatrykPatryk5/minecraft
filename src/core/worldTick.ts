
import useGameStore from '../store/gameStore';
import { BlockType } from './blockTypes';
import { growCrop, updateFarmland, growSapling } from './farmingSystem';
import { CHUNK_SIZE, CHUNK_VOLUME } from './terrainGen';

/**
 * Optimized Random Tick
 * 
 * Instead of scanning world coords (slow), we pick random indices in chunks.
 * We only convert to world coords if we hit a block that actually needs ticking.
 */
export const tickWorld = () => {
    const s = useGameStore.getState();
    let keys = Object.keys(s.chunks);
    // Optimization: If keys count is huge, we might want to cache it, 
    // but Object.keys on 2000 props is ~0.1ms. The loop is the heavy part.
    // However, we can bail early if nothing loaded.
    if (keys.length === 0) return;

    const SIMULATION_DISTANCE = 6;
    const playerPos = s.playerPos;
    const pcx = Math.floor(playerPos[0] / CHUNK_SIZE);
    const pcz = Math.floor(playerPos[2] / CHUNK_SIZE);

    const activeKeys = keys.filter(key => {
        const parts = key.split(',');
        const distSq = (parseInt(parts[0]) - pcx) ** 2 + (parseInt(parts[1]) - pcz) ** 2;
        return distSq <= SIMULATION_DISTANCE * SIMULATION_DISTANCE;
    });

    if (activeKeys.length === 0) return;

    // Budget: Attempt to tick roughly this many blocks per frame total.
    const TICK_BUDGET = 150; // Optimized budget for strict simulation distance
    const attemptsPerChunk = Math.ceil(TICK_BUDGET / Math.max(1, activeKeys.length));

    for (const key of activeKeys) {
        const chunk = s.chunks[key];
        const [cx, cz] = key.split(',').map(Number); // Parse only once per chunk if needed? 
        // Actually, parsing per chunk is fine.

        for (let i = 0; i < attemptsPerChunk; i++) {
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
                // 1% chance to grow per random tick
                if (Math.random() < 0.05) growSapling(wx, ly, wz);
            } else if (block >= BlockType.WHEAT_0 && block < BlockType.WHEAT_7) {
                // Crop growth
                growCrop(wx, ly, wz);
            }
        }
    }
};
