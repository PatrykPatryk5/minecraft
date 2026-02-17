/**
 * Terrain Generation Web Worker
 *
 * Runs chunk generation in a separate thread so the main
 * thread never freezes. Receives {cx, cz} requests and
 * returns generated ChunkData.
 */

import { createNoise2D, createNoise3D } from 'simplex-noise';

// ─── Constants ───────────────────────────────────────────
const CHUNK_SIZE = 16;
const MAX_HEIGHT = 256;
const SEA_LEVEL = 62;

// Block IDs (mirrors blockTypes.ts)
const BT = {
    AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 5, OAK_LOG: 6,
    LEAVES: 7, WATER: 8, BEDROCK: 9, DIAMOND: 10, COAL_ORE: 11,
    IRON_ORE: 12, SPRUCE: 18, GOLD_ORE: 19, SANDSTONE: 25,
    TALL_GRASS: 30, CACTUS: 31, PUMPKIN: 33, SNOW: 16,
    FLOWER_RED: 28, FLOWER_YELLOW: 29, EMERALD_ORE: 47,
    LAPIS_ORE: 49, REDSTONE_ORE: 51, BIRCH_LOG: 53,
};

// ─── Deterministic RNG ───────────────────────────────────
function mulberry32(a: number): () => number {
    return () => {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const WORLD_SEED = 42069;
const rng = mulberry32(WORLD_SEED);
const n2 = createNoise2D(rng);
const n3 = createNoise3D(rng);

function bkey(lx: number, y: number, lz: number): string {
    return `${lx},${y},${lz}`;
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

type Biome = 'plains' | 'forest' | 'desert' | 'mountains' | 'snowy' | 'swamp' | 'jungle' | 'taiga';

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

function getHeight(x: number, z: number): number {
    const biome = getBiome(x, z);
    const cont = octave2D(x, z, 5, 0.5, 0.005);
    const detail = octave2D(x + 1000, z + 1000, 3, 0.5, 0.02);
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

function isCave(x: number, y: number, z: number): boolean {
    if (y < 5 || y > 100) return false;
    const c1 = n3(x * 0.04, y * 0.04, z * 0.04);
    const c2 = n3(x * 0.08 + 500, y * 0.08, z * 0.08 + 500);
    if (c1 > 0.42 && c2 > 0.28) return true;
    if (y < 40 && y > 8) {
        const cheese = n3(x * 0.015 + 2000, y * 0.02, z * 0.015 + 2000);
        if (cheese > 0.55) return true;
    }
    return false;
}

function getOre(x: number, y: number, z: number): number | null {
    const o = n3(x * 0.1, y * 0.1, z * 0.1);
    const o2 = n3(x * 0.15 + 300, y * 0.15, z * 0.15 + 300);
    if (y < 16 && o > 0.74) return BT.DIAMOND;
    if (y < 32 && o2 > 0.78) return BT.EMERALD_ORE;
    if (y < 32 && o > 0.7) return BT.GOLD_ORE;
    if (y < 16 && o2 > 0.65) return BT.REDSTONE_ORE;
    if (y < 30 && o > 0.72 && o2 > 0.5) return BT.LAPIS_ORE;
    if (y < 64 && o > 0.65) return BT.IRON_ORE;
    if (y < 128 && o > 0.6) return BT.COAL_ORE;
    return null;
}

function generateChunk(cx: number, cz: number): Record<string, number> {
    const blocks: Record<string, number> = {};
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
                if (y === 0) bt = BT.BEDROCK;
                else if (y <= 3 && n3(wx * 0.5, y * 0.5, wz * 0.5) > 0.3) bt = BT.BEDROCK;
                else if (y === h) {
                    switch (biome) {
                        case 'desert': bt = BT.SAND; break;
                        case 'snowy': bt = BT.SNOW; break;
                        case 'swamp': bt = BT.DIRT; break;
                        default: bt = BT.GRASS; break;
                    }
                } else if (y > h - 4) bt = biome === 'desert' ? BT.SAND : BT.DIRT;
                else bt = getOre(wx, y, wz) ?? BT.STONE;
                blocks[bkey(lx, y, lz)] = bt;
            }

            for (let y = h + 1; y <= SEA_LEVEL; y++) {
                if (!blocks[bkey(lx, y, lz)]) blocks[bkey(lx, y, lz)] = BT.WATER;
            }

            if (biome === 'desert') {
                for (let y = h - 4; y > h - 8 && y > 0; y--) {
                    if (blocks[bkey(lx, y, lz)] === BT.STONE) blocks[bkey(lx, y, lz)] = BT.SANDSTONE;
                }
            }

            if (h > SEA_LEVEL) {
                const fn = n2(wx * 0.8, wz * 0.8);
                if ((biome === 'plains' || biome === 'forest') && fn > 0.3 && (wx + wz) % 3 === 0)
                    blocks[bkey(lx, h + 1, lz)] = BT.TALL_GRASS;
                if (biome === 'plains' && fn > 0.5 && (wx * wz) % 7 === 0)
                    blocks[bkey(lx, h + 1, lz)] = (wx + wz) % 2 === 0 ? BT.FLOWER_RED : BT.FLOWER_YELLOW;
                if (biome === 'desert' && fn > 0.6 && lx > 2 && lx < 13 && lz > 2 && lz < 13) {
                    const ch = 1 + ((wx * 7 + wz * 13) % 3);
                    for (let dy = 0; dy < ch; dy++) blocks[bkey(lx, h + 1 + dy, lz)] = BT.CACTUS;
                }
                if (biome === 'plains' && fn > 0.72 && (wx * wz) % 31 === 0)
                    blocks[bkey(lx, h + 1, lz)] = BT.PUMPKIN;
            }

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

    for (const t of trees) {
        const logType = t.biome === 'taiga' ? BT.SPRUCE : t.biome === 'jungle' ? BT.BIRCH_LOG : BT.OAK_LOG;
        const trunkH = t.biome === 'jungle' ? 6 + ((Math.abs(n2(wx0 + t.x, wz0 + t.z) * 3)) | 0) :
            4 + ((Math.abs(n2(wx0 + t.x, wz0 + t.z) * 3)) | 0);
        for (let dy = 0; dy < trunkH; dy++) blocks[bkey(t.x, t.y + dy, t.z)] = logType;
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
                        const k = bkey(lx2, t.y + dy, lz2);
                        if (!blocks[k]) blocks[k] = BT.LEAVES;
                    }
                }
            }
        }
    }

    return blocks;
}

// ─── Worker message handler ──────────────────────────────
self.onmessage = (e: MessageEvent) => {
    const { cx, cz, id } = e.data;
    const data = generateChunk(cx, cz);
    (self as any).postMessage({ cx, cz, id, data });
};
