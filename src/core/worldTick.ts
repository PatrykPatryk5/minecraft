
import useGameStore from '../store/gameStore';
import { BlockType } from './blockTypes';
import { growCrop, updateFarmland } from './farmingSystem';
import { CHUNK_SIZE } from './terrainGen';

/**
 * Random Tick Logic
 * Minecraft updates randomly selected blocks in each chunk.
 * Standard is 3 random ticks per section per tick (20tps).
 * We run at 60fps, so maybe 1 random tick per chunk per frame?
 * Or iterate loaded chunks and pick N blocks.
 */
export const tickWorld = () => {
    const s = useGameStore.getState();
    const chunks = s.chunks;
    const loadedKeys = Object.keys(chunks);

    // Rate limiter: Process 10% of loaded chunks per frame to save CPU
    // Or just pick 5 random chunks.
    for (let i = 0; i < 5; i++) {
        const key = loadedKeys[Math.floor(Math.random() * loadedKeys.length)];
        if (!key) continue;

        const chunk = chunks[key];
        // Pick 3 random blocks in this chunk
        for (let j = 0; j < 3; j++) {
            const lx = Math.floor(Math.random() * CHUNK_SIZE);
            const ly = Math.floor(Math.random() * CHUNK_SIZE); // Height variation
            const lz = Math.floor(Math.random() * CHUNK_SIZE);

            // Convert to world coords (need to parse key "x,z")
            const [cx, cz] = key.split(',').map(Number);
            const wx = cx * CHUNK_SIZE + lx;
            const wz = cz * CHUNK_SIZE + lz;
            const wy = ly + 60; // Bias towards surface? Or random y.

            // Simplify: Just random wx, wy, wz in loaded range? 
            // Better: Iterate chunk data directly? No, complexity.
            // Let's stick to simple randoms.

            // Actually, we need to know the block type at that location.
            // We can use s.getBlock(wx, wy, wz).
            // But probing random air blocks is wasteful.
            // MC optimized this by sections. We don't have sections.
            // Let's optimize: Only meaningful Y levels (surface).
            const sy = Math.floor(Math.random() * 80) + 20; // 20-100 range

            const block = s.getBlock(wx, sy, wz);

            if (block === BlockType.FARMLAND) {
                updateFarmland(wx, sy, wz);
            } else if (block >= BlockType.WHEAT_0 && block < BlockType.WHEAT_7) {
                growCrop(wx, sy, wz);
            } else if (block === BlockType.GRASS && s.getBlock(wx, sy + 1, wz) !== BlockType.AIR) {
                // Grass dies if covered
                s.addBlock(wx, sy, wz, BlockType.DIRT);
            } else if (block === BlockType.DIRT) {
                // Grass spread logic (simplified)
                if (s.getBlock(wx, sy + 1, wz) === BlockType.AIR) {
                    // Check neighbors for grass
                    // ...
                }
            }
        }
    }
};
