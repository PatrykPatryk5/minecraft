/**
 * Terrain Generator (Performance-Optimized)
 *
 * Multi-octave simplex noise with biomes, caves, ores, trees, flowers.
 * MAX_HEIGHT = 256 (optimized from 320 - less blocks = better perf)
 * No negative Y range (saves ~40% block data per chunk)
 */

import { createNoise2D, createNoise3D } from 'simplex-noise';
import seedrandom from 'seedrandom';
import { BlockType } from './blockTypes';

// ─── Constants ───────────────────────────────────────────
export const CHUNK_SIZE = 16;
export const MAX_HEIGHT = 256;
export const SEA_LEVEL = 62;

// ─── Deterministic RNG ───────────────────────────────────
let currentSeed = Math.floor(Math.random() * 2147483647);
let n2 = createNoise2D(seedrandom(currentSeed.toString()));
let n3 = createNoise3D(seedrandom(currentSeed.toString()));

/** Initialize terrain with a specific seed. Must be called before any chunks are generated. */
export function initSeed(seed: number): void {
    currentSeed = seed;
    n2 = createNoise2D(seedrandom(seed.toString()));
    n3 = createNoise3D(seedrandom(seed.toString()));
}

/** Get the current world seed */
export function getCurrentSeed(): number {
    return currentSeed;
}

// ─── Noise Helpers ───────────────────────────────────────
function octave2D(x: number, z: number, octaves: number, persistence: number, scale: number): number {
    let val = 0, amp = 1, freq = scale, max = 0;
    for (let i = 0; i < octaves; i++) {
        val += n2(x * freq, z * freq) * amp;
        max += amp;
        amp *= persistence;
        freq *= 2;
    }
    return val / max;
}

// ─── Biomes ──────────────────────────────────────────────
export type Biome = 'plains' | 'forest' | 'desert' | 'mountains' | 'snowy' | 'swamp' | 'jungle' | 'taiga';

function getBiome(x: number, z: number): Biome {
    const temp = octave2D(x + 5000, z + 5000, 2, 0.5, 0.003);
    const moist = octave2D(x + 10000, z + 10000, 2, 0.5, 0.004);
    const cont = octave2D(x + 20000, z + 20000, 2, 0.5, 0.002);
    if (temp > 0.35) return moist > 0.1 ? 'jungle' : 'desert';
    if (temp < -0.35) return moist > 0 ? 'taiga' : 'snowy';
    if (cont > 0.2) return 'mountains';
    if (moist > 0.2 && temp < 0.1) return 'swamp';
    if (moist > 0.05) return 'forest';
    return 'plains';
}

// ─── Terrain Height ──────────────────────────────────────
function getHeight(x: number, z: number): number {
    const biome = getBiome(x, z);
    const cont = octave2D(x, z, 5, 0.5, 0.005);   // Reduced from 6 octaves
    const detail = octave2D(x + 1000, z + 1000, 3, 0.5, 0.02); // Reduced from 4

    let h: number;
    switch (biome) {
        case 'mountains': h = 70 + cont * 45 + detail * 12 + Math.abs(octave2D(x, z, 2, 0.6, 0.01)) * 25; break;
        case 'desert': h = 63 + cont * 8 + detail * 3; break;
        case 'snowy': h = 66 + cont * 20 + detail * 8; break;
        case 'forest': h = 64 + cont * 15 + detail * 6; break;
        case 'swamp': h = 61 + cont * 4 + detail * 2; break;
        case 'jungle': h = 66 + cont * 16 + detail * 7; break;
        case 'taiga': h = 65 + cont * 18 + detail * 7; break;
        default: h = 64 + cont * 10 + detail * 4; break;
    }
    return Math.max(1, Math.min(200, h)) | 0;
}

// ─── Caves ───────────────────────────────────────────────
function isCave(x: number, y: number, z: number): boolean {
    if (y < 5 || y > 100) return false;
    const c1 = n3(x * 0.04, y * 0.04, z * 0.04);
    const c2 = n3(x * 0.08 + 500, y * 0.08, z * 0.08 + 500);
    if (c1 > 0.42 && c2 > 0.28) return true;
    // Cheese caves (larger caverns at depth)
    if (y < 40 && y > 8) {
        const cheese = n3(x * 0.015 + 2000, y * 0.02, z * 0.015 + 2000);
        if (cheese > 0.55) return true;
    }
    return false;
}

// ─── Ores ────────────────────────────────────────────────
function getOre(x: number, y: number, z: number): number | null {
    const o = n3(x * 0.1, y * 0.1, z * 0.1);
    const o2 = n3(x * 0.15 + 300, y * 0.15, z * 0.15 + 300);
    if (y < 16 && o > 0.74) return BlockType.DIAMOND;
    if (y < 32 && o2 > 0.78) return BlockType.EMERALD_ORE;
    if (y < 32 && o > 0.7) return BlockType.GOLD_ORE;
    if (y < 16 && o2 > 0.65) return BlockType.REDSTONE_ORE;
    if (y < 30 && o > 0.72 && o2 > 0.5) return BlockType.LAPIS_ORE;
    if (y < 64 && o > 0.65) return BlockType.IRON_ORE;
    if (y < 128 && o > 0.6) return BlockType.COAL_ORE;
    return null;
}

// ─── Chunk Data Type ─────────────────────────────
// Flat Uint16Array: index = y * 256 + lz * 16 + lx
// Size = MAX_HEIGHT * CHUNK_SIZE * CHUNK_SIZE = 256 * 16 * 16 = 65536
export const CHUNK_VOLUME = MAX_HEIGHT * CHUNK_SIZE * CHUNK_SIZE;
export type ChunkData = Uint16Array;

/** Fast block index: y * 256 + lz * 16 + lx */
export function blockIndex(lx: number, y: number, lz: number): number {
    return (y << 8) | (lz << 4) | lx; // equivalent to y*256 + lz*16 + lx
}

/** Legacy string key (kept for backwards compat) */
export function bkey(lx: number, y: number, lz: number): string {
    return `${lx},${y},${lz}`;
}

export function generateChunk(cx: number, cz: number): ChunkData {
    const blocks = new Uint16Array(CHUNK_VOLUME);
    const wx0 = cx * CHUNK_SIZE;
    const wz0 = cz * CHUNK_SIZE;
    const trees: { x: number; y: number; z: number; biome: Biome }[] = [];

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            const wx = wx0 + lx;
            const wz = wz0 + lz;
            const h = getHeight(wx, wz);
            const biome = getBiome(wx, wz);

            for (let y = 0; y <= h; y++) {
                if (isCave(wx, y, wz) && y > 1) continue;

                let bt: number;
                if (y === 0) {
                    bt = BlockType.BEDROCK;
                } else if (y <= 3 && n3(wx * 0.5, y * 0.5, wz * 0.5) > 0.3) {
                    bt = BlockType.BEDROCK;
                } else if (y === h) {
                    switch (biome) {
                        case 'desert': bt = BlockType.SAND; break;
                        case 'snowy': bt = BlockType.SNOW; break;
                        case 'swamp': bt = BlockType.DIRT; break;
                        default: bt = BlockType.GRASS; break;
                    }
                } else if (y > h - 4) {
                    bt = biome === 'desert' ? BlockType.SAND : BlockType.DIRT;
                } else {
                    bt = getOre(wx, y, wz) ?? BlockType.STONE;
                }
                blocks[blockIndex(lx, y, lz)] = bt;
            }

            // Water
            for (let y = h + 1; y <= SEA_LEVEL; y++) {
                const idx = blockIndex(lx, y, lz);
                if (!blocks[idx]) blocks[idx] = BlockType.WATER;
            }

            // Underground lava pools (Y 1-10, in caves)
            for (let y = 1; y <= 10; y++) {
                const idx = blockIndex(lx, y, lz);
                if (blocks[idx] === 0 && isCave(wx, y, wz)) {
                    blocks[idx] = BlockType.LAVA;
                }
            }

            // Sandstone under desert
            if (biome === 'desert') {
                for (let y = h - 4; y > h - 8 && y > 0; y--) {
                    const idx = blockIndex(lx, y, lz);
                    if (blocks[idx] === BlockType.STONE) {
                        blocks[idx] = BlockType.SANDSTONE;
                    }
                }
            }

            // Flora
            if (h > SEA_LEVEL) {
                const fn = n2(wx * 0.8, wz * 0.8);
                if ((biome === 'plains' || biome === 'forest') && fn > 0.3 && (wx + wz) % 3 === 0) {
                    blocks[blockIndex(lx, h + 1, lz)] = BlockType.TALL_GRASS;
                }
                if (biome === 'plains' && fn > 0.5 && (wx * wz) % 7 === 0) {
                    blocks[blockIndex(lx, h + 1, lz)] = (wx + wz) % 2 === 0 ? BlockType.FLOWER_RED : BlockType.FLOWER_YELLOW;
                }
                if (biome === 'desert' && fn > 0.6 && lx > 2 && lx < 13 && lz > 2 && lz < 13) {
                    const ch = 1 + ((wx * 7 + wz * 13) % 3);
                    for (let dy = 0; dy < ch; dy++) blocks[blockIndex(lx, h + 1 + dy, lz)] = BlockType.CACTUS;
                }
                if (biome === 'plains' && fn > 0.72 && (wx * wz) % 31 === 0) {
                    blocks[blockIndex(lx, h + 1, lz)] = BlockType.PUMPKIN;
                }
            }

            // Trees
            if (
                (biome === 'forest' || biome === 'plains' || biome === 'swamp' || biome === 'jungle' || biome === 'taiga') &&
                h > SEA_LEVEL && lx > 2 && lx < 13 && lz > 2 && lz < 13
            ) {
                const tn = n2(wx * 0.5, wz * 0.5);
                let threshold: number;
                switch (biome) {
                    case 'jungle': threshold = 0.15; break;
                    case 'forest': threshold = 0.25; break;
                    case 'taiga': threshold = 0.3; break;
                    case 'swamp': threshold = 0.5; break;
                    default: threshold = 0.6;
                }
                if (tn > threshold) trees.push({ x: lx, y: h + 1, z: lz, biome });
            }
        }
    }

    // Generate trees
    for (const t of trees) {
        placeTree(t.x, t.y, t.z, t.biome, (x, y, z, bt) => {
            const idx = blockIndex(x, y, z);
            // Safety check for chunk bounds
            if (!blocks[idx]) blocks[idx] = bt;
        });
    }

    // Dungeons
    // ~5% chance per chunk
    const dn = n2(cx * 1.5, cz * 1.5);
    if (dn > 0.8) {
        // pseudo-random position inside chunk
        const px = Math.floor(Math.abs(n2(cx, cz)) * 8) + 4; // 4 to 11
        const pz = Math.floor(Math.abs(n2(cz, cx)) * 8) + 4; // 4 to 11
        const py = Math.floor(Math.abs(n3(cx, cz, 0)) * 30) + 10; // Y 10 to 40

        // Build 7x7x5 room
        for (let dy = 0; dy < 5; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
                for (let dz = -3; dz <= 3; dz++) {
                    const nx = px + dx;
                    const nz = pz + dz;
                    // Keep entirely within this chunk to avoid tricky cross-chunk gen
                    if (nx < 0 || nx > 15 || nz < 0 || nz > 15) continue;

                    const ny = py + dy;
                    const idx = blockIndex(nx, ny, nz);

                    if (dy === 0 || dy === 4 || dx === -3 || dx === 3 || dz === -3 || dz === 3) {
                        // Shell
                        if (blocks[idx] !== BlockType.BEDROCK) {
                            // Deterministicish choice between mossy and normal cobble
                            const isMossy = n3(cx * 10 + nx, ny, cz * 10 + nz) > 0;
                            blocks[idx] = isMossy ? BlockType.MOSSY_COBBLE : BlockType.COBBLE;
                        }
                    } else {
                        // Interior empty
                        blocks[idx] = BlockType.AIR;
                    }
                }
            }
        }

        // Place chest
        blocks[blockIndex(px, py + 1, pz)] = BlockType.CHEST;
    }

    return blocks;
}

/**
 * Places a tree at the given LOCAL coordinates (0-15).
 * callback(x, y, z, blockType) is called for each block.
 * Coordinates passed to callback are LOCAL to the chunk if using local input, 
 * or WORLD if using world input. It's up to the caller.
 * 
 * NOTE: For cross-chunk trees, this simple implementation clips at 0-15 if caller enforces it.
 */
export function placeTree(
    x: number, y: number, z: number,
    biome: Biome,
    setBlock: (x: number, y: number, z: number, bt: number) => void
) {
    const wx0 = x; // Just for noise seed if needed, but we use consistent random here?
    // Actually, we use a deterministic RNG based on position usually.
    // For now, let's use a simple pseudo-random based on coords to decide height/shape.

    // Simple hash for consistency
    const seed = (x * 374761393) ^ (y * 668265263) ^ (z * 915061699);
    const rnd = () => {
        let t = Math.sin(seed) * 10000;
        return t - Math.floor(t);
    };

    const logType = biome === 'taiga' ? BlockType.SPRUCE :
        biome === 'jungle' ? BlockType.BIRCH_LOG : BlockType.OAK_LOG;

    // Height
    const isJungle = biome === 'jungle';
    const isTaiga = biome === 'taiga';
    const baseH = isJungle ? 6 : 4;
    const varH = isJungle ? 5 : 3;
    const trunkH = baseH + Math.floor(rnd() * varH); // Use deterministic height

    // Trunk
    for (let dy = 0; dy < trunkH; dy++) {
        setBlock(x, y + dy, z, logType);
    }

    // Leaves
    const leafStart = trunkH - 2;
    for (let dy = leafStart; dy < trunkH + 2; dy++) {
        const r = isTaiga ? Math.max(0, 3 - (dy - leafStart)) : (dy >= trunkH ? 1 : 2);
        for (let dx = -r; dx <= r; dx++) {
            for (let dz = -r; dz <= r; dz++) {
                if (dx === 0 && dz === 0 && dy < trunkH) continue; // Don't replace trunk
                if (Math.abs(dx) === r && Math.abs(dz) === r && r > 1 && !isTaiga) {
                    if ((rnd() + dx * dz * 0.1) % 1 > 0.5) continue; // Random corners
                }

                // We pass relative coords to the callback. Caller handles bounds.
                setBlock(x + dx, y + dy, z + dz, BlockType.LEAVES);
            }
        }
    }
}

/** Get safe spawn height */
export function getSpawnHeight(x: number, z: number): number {
    return getHeight(x, z) + 2;
}

// ─── End Dimension Generator ─────────────────────────────
// (Moved to dimensionGen.ts for cleanliness)
