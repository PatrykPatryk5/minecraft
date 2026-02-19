/**
 * Terrain Generator (Performance-Optimized)
 *
 * Multi-octave simplex noise with biomes, caves, ores, trees, flowers.
 * MAX_HEIGHT = 256 (optimized from 320 - less blocks = better perf)
 * No negative Y range (saves ~40% block data per chunk)
 */

import { createNoise2D, createNoise3D } from 'simplex-noise';
import { BlockType } from './blockTypes';

// ─── Constants ───────────────────────────────────────────
export const CHUNK_SIZE = 16;
export const MAX_HEIGHT = 256;
export const SEA_LEVEL = 62;

// ─── Deterministic RNG ───────────────────────────────────
function mulberry32(a: number): () => number {
    return () => {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

let currentSeed = Math.floor(Math.random() * 2147483647);
let n2 = createNoise2D(mulberry32(currentSeed));
let n3 = createNoise3D(mulberry32(currentSeed));

/** Initialize terrain with a specific seed. Must be called before any chunks are generated. */
export function initSeed(seed: number): void {
    currentSeed = seed;
    n2 = createNoise2D(mulberry32(seed));
    n3 = createNoise3D(mulberry32(seed));
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

// ─── Main Generator ─────────────────────────────────────
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
        const logType = t.biome === 'taiga' ? BlockType.SPRUCE :
            t.biome === 'jungle' ? BlockType.BIRCH_LOG : BlockType.OAK_LOG;
        const trunkH = t.biome === 'jungle' ? 6 + ((Math.abs(n2(wx0 + t.x, wz0 + t.z) * 3)) | 0) :
            4 + ((Math.abs(n2(wx0 + t.x, wz0 + t.z) * 3)) | 0);
        for (let dy = 0; dy < trunkH; dy++) {
            blocks[blockIndex(t.x, t.y + dy, t.z)] = logType;
        }
        const leafStart = trunkH - 2;
        const isCone = t.biome === 'taiga';
        for (let dy = leafStart; dy < trunkH + 2; dy++) {
            const r = isCone ? Math.max(0, 3 - (dy - leafStart)) : (dy >= trunkH ? 1 : 2);
            for (let dx = -r; dx <= r; dx++) {
                for (let dz = -r; dz <= r; dz++) {
                    if (dx === 0 && dz === 0 && dy < trunkH) continue;
                    if (Math.abs(dx) === r && Math.abs(dz) === r && r > 1) continue;
                    const lx2 = t.x + dx, lz2 = t.z + dz;
                    if (lx2 >= 0 && lx2 < CHUNK_SIZE && lz2 >= 0 && lz2 < CHUNK_SIZE) {
                        const idx = blockIndex(lx2, t.y + dy, lz2);
                        if (!blocks[idx]) blocks[idx] = BlockType.LEAVES;
                    }
                }
            }
        }
    }

    return blocks;
}

/** Get safe spawn height */
export function getSpawnHeight(x: number, z: number): number {
    return getHeight(x, z) + 2;
}
