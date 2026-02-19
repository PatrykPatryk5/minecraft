
import useGameStore, { blockKey } from '../store/gameStore';
import { BlockType } from './blockTypes';
import { CHUNK_SIZE, MAX_HEIGHT, blockIndex, placeTree } from './terrainGen';

// ─── Constants ───────────────────────────────────────────
const HYDRATION_RANGE = 4;

// ─── Farming Actions ─────────────────────────────────────

/**
 * Tills dirt/grass into farmland.
 * @returns true if successful
 */
export const tillBlock = (x: number, y: number, z: number): boolean => {
    const s = useGameStore.getState();
    const block = s.getBlock(x, y, z);
    const above = s.getBlock(x, y + 1, z);

    if ((block === BlockType.DIRT || block === BlockType.GRASS) && above === BlockType.AIR) {
        s.addBlock(x, y, z, BlockType.FARMLAND);
        // Initial hydration check
        updateFarmland(x, y, z);
        return true;
    }
    return false;
};

/**
 * Plants seeds on farmland.
 */
export const plantSeed = (x: number, y: number, z: number): boolean => {
    const s = useGameStore.getState();
    const block = s.getBlock(x, y, z);
    const below = s.getBlock(x, y - 1, z);

    if (block === BlockType.AIR && below === BlockType.FARMLAND) {
        s.addBlock(x, y, z, BlockType.WHEAT_0);
        return true;
    }
    return false;
};

/**
 * Checks for water within range and hydrates farmland.
 * (In this simplified version, Farmland doesn't have a "wet" metadata state visually yet,
 * but let's assume we might change texture or just use logic).
 * 
 * Logic: If water is near, it is hydrated.
 * Actually, MC stores hydration level (0-7).
 * For now, we just proceed.
 */
export const updateFarmland = (x: number, y: number, z: number) => {
    // Check 4 blocks radius for water
    // ... logic placeholder
    // In a real implementation we would update block metadata/state.
    // Here we can just assume it IS hydrated if near water during growth tick.
};

/**
 * Tries to grow a crop at x,y,z
 */
export const growCrop = (x: number, y: number, z: number) => {
    const s = useGameStore.getState();
    const block = s.getBlock(x, y, z);

    // Check if it's a crop stage 0-6
    if (block >= BlockType.WHEAT_0 && block < BlockType.WHEAT_7) {
        // Hydration check: look for water efficiently
        let hydrated = false;
        // Simple optimization: check only same level +1/-1 y?
        // MC: Water at same level or 1 block up, within 4 blocks horizontal.
        const r = 4;
        const cy = y - 1; // Farmland is below crop

        // Scan for water
        search:
        for (let dx = -r; dx <= r; dx++) {
            for (let dz = -r; dz <= r; dz++) {
                const b = s.getBlock(x + dx, cy, z + dz);
                const bUp = s.getBlock(x + dx, cy + 1, z + dz);
                if (b === BlockType.WATER || bUp === BlockType.WATER) {
                    hydrated = true;
                    break search;
                }
            }
        }

        // Hydrated crops grow faster (higher chance)
        // Values: 10% base, 50% if hydrated?
        const chance = hydrated ? 0.4 : 0.05;

        if (Math.random() < chance) {
            s.addBlock(x, y, z, block + 1);
        }
    }
};



/**
 * Grows a sapling into a tree.
 */
export const growSapling = (x: number, y: number, z: number) => {
    const s = useGameStore.getState();
    const block = s.getBlock(x, y, z);

    if (block === BlockType.OAK_SAPLING) {
        // Use shared tree generation logic
        // 'forest' biome produces Oak trees
        placeTree(x, y, z, 'forest', (tx, ty, tz, bt) => {
            // Only replace air or the sapling itself
            const existing = s.getBlock(tx, ty, tz);
            if (existing === BlockType.AIR || (tx === x && ty === y && tz === z)) {
                s.addBlock(tx, ty, tz, bt);
            }
        });
    }
};

/**
 * Applies Bone Meal to a block.
 * Returns true if successful (consumed).
 */
export const applyBoneMeal = (x: number, y: number, z: number): boolean => {
    const s = useGameStore.getState();
    const block = s.getBlock(x, y, z);

    // Grow crops
    if (block >= BlockType.WHEAT_0 && block < BlockType.WHEAT_7) {
        // Instant grow to max or +random stages?
        // MC: Random 2-5 stages.
        let next = block + Math.floor(Math.random() * 3) + 2;
        if (next > BlockType.WHEAT_7) next = BlockType.WHEAT_7;

        s.addBlock(x, y, z, next);
        return true;
    }

    // Grow saplings
    if (block === BlockType.OAK_SAPLING) {
        // 45% chance to grow
        if (Math.random() < 0.45) {
            growSapling(x, y, z);
        }
        return true; // Consumed even if it doesn't grow immediate (MC logic)
    }

    return false;
};
