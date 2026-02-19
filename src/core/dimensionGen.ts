/**
 * Dimension Terrain Generators — Nether & End
 *
 * Nether: netherrack caves with ceiling + floor, lava oceans at y=31,
 *         soul sand patches, glowstone clusters on ceiling
 * End:    floating end stone islands, obsidian pillars, main island
 */

import { createNoise2D, createNoise3D } from 'simplex-noise';
import { BlockType } from './blockTypes';
import { CHUNK_SIZE, MAX_HEIGHT } from './terrainGen';

// Inline blockIndex for performance
function blockIndex(x: number, y: number, z: number): number {
    return (x * MAX_HEIGHT * CHUNK_SIZE) + (y * CHUNK_SIZE) + z;
}

// Seeded random for deterministic generation
function seededRandom(x: number, z: number): number {
    let h = (x * 374761393 + z * 668265263 + 1376312589) & 0x7fffffff;
    h = ((h >> 13) ^ h) * 1274126177;
    h = ((h >> 16) ^ h);
    return (h & 0x7fffffff) / 0x7fffffff;
}

/**
 * Generate a Nether chunk
 * - Bedrock ceiling at y=127
 * - Netherrack from y=0-127 with caves carved out
 * - Lava ocean at y=31
 * - Soul sand on floor, glowstone on ceiling
 * - Nether fortress fragments (nether bricks)
 */
export function generateNetherChunk(cx: number, cz: number): Uint8Array {
    const data = new Uint8Array(CHUNK_SIZE * MAX_HEIGHT * CHUNK_SIZE);
    const noise2d = createNoise2D(() => seededRandom(cx * 100, cz * 100));
    const noise3d = createNoise3D(() => seededRandom(cx * 200 + 1, cz * 200 + 1));

    const CEILING = 127;
    const LAVA_LEVEL = 31;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            const wx = cx * CHUNK_SIZE + lx;
            const wz = cz * CHUNK_SIZE + lz;

            // Floor and ceiling height variation
            const floorNoise = noise2d(wx * 0.02, wz * 0.02);
            const ceilNoise = noise2d(wx * 0.015 + 100, wz * 0.015 + 100);
            const floor = 4 + Math.floor((floorNoise + 1) * 8);
            const ceil = CEILING - Math.floor((ceilNoise + 1) * 15);

            for (let y = 0; y < MAX_HEIGHT; y++) {
                if (y > CEILING + 1) break; // Nothing above ceiling

                if (y === 0 || y >= CEILING) {
                    data[blockIndex(lx, y, lz)] = BlockType.BEDROCK;
                    continue;
                }

                // 3D cave noise
                const caveVal = noise3d(wx * 0.05, y * 0.08, wz * 0.05);
                const isCave = caveVal > 0.1;

                if (y <= floor || y >= ceil) {
                    // Solid regions
                    if (isCave && y > LAVA_LEVEL + 2 && y < ceil - 2) {
                        // Cave area — nothing (air)
                    } else {
                        // Netherrack base
                        data[blockIndex(lx, y, lz)] = BlockType.NETHERRACK;

                        // Soul sand patches near floor
                        if (y === floor && seededRandom(wx + y, wz) > 0.6) {
                            data[blockIndex(lx, y, lz)] = BlockType.SOUL_SAND;
                        }

                        // Glowstone on ceiling
                        if (y >= ceil - 3 && seededRandom(wx * 3, wz * 3 + y) > 0.92) {
                            data[blockIndex(lx, y, lz)] = BlockType.GLOWSTONE;
                        }

                        // Nether brick fortress fragments
                        if (y > LAVA_LEVEL + 5 && y < ceil - 5) {
                            const fortNoise = noise2d(wx * 0.005 + 500, wz * 0.005 + 500);
                            if (fortNoise > 0.7 && seededRandom(wx * 5, wz * 5 + y) > 0.85) {
                                data[blockIndex(lx, y, lz)] = BlockType.NETHER_BRICKS;
                            }
                        }
                    }
                } else if (y <= LAVA_LEVEL) {
                    // Lava ocean
                    data[blockIndex(lx, y, lz)] = BlockType.LAVA;
                }
            }
        }
    }

    return data;
}

/**
 * Generate an End chunk
 * - Main island around 0,0 (radius ~80 blocks)
 * - Small floating islands farther out
 * - Obsidian pillars on main island
 * - End stone base material
 */
export function generateEndChunk(cx: number, cz: number): Uint8Array {
    const data = new Uint8Array(CHUNK_SIZE * MAX_HEIGHT * CHUNK_SIZE);
    const noise2d = createNoise2D(() => seededRandom(cx * 300, cz * 300));

    const END_Y = 64;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            const wx = cx * CHUNK_SIZE + lx;
            const wz = cz * CHUNK_SIZE + lz;

            const distFromCenter = Math.sqrt(wx * wx + wz * wz);

            // Main island (radius ~80)
            if (distFromCenter < 80) {
                const edgeFalloff = Math.max(0, 1 - distFromCenter / 80);
                const heightVar = noise2d(wx * 0.03, wz * 0.03) * 6;
                const islandTopY = END_Y + Math.floor(edgeFalloff * 12 + heightVar);
                const islandBotY = END_Y - Math.floor(edgeFalloff * 8);

                for (let y = Math.max(0, islandBotY); y <= Math.min(islandTopY, MAX_HEIGHT - 1); y++) {
                    data[blockIndex(lx, y, lz)] = BlockType.END_STONE;
                }
            }
            // Outer floating islands
            else if (distFromCenter > 200 && distFromCenter < 500) {
                const islandNoise = noise2d(wx * 0.008, wz * 0.008);
                if (islandNoise > 0.5) {
                    const strength = Math.floor((islandNoise - 0.5) * 20);
                    const baseY = END_Y + Math.floor(noise2d(wx * 0.02 + 50, wz * 0.02 + 50) * 20);
                    for (let y = baseY; y < baseY + strength && y < MAX_HEIGHT; y++) {
                        if (y >= 0) {
                            data[blockIndex(lx, y, lz)] = BlockType.END_STONE;
                        }
                    }
                }
            }

            // Obsidian pillars on main island (very rare per-block)
            if (distFromCenter < 40) {
                const pillarChance = seededRandom(Math.floor(wx / 3) * 7, Math.floor(wz / 3) * 7);
                if (pillarChance > 0.998) {
                    const pillarHeight = 30 + Math.floor(seededRandom(wx, wz * 2) * 50);
                    for (let y = END_Y; y < Math.min(END_Y + pillarHeight, MAX_HEIGHT); y++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            for (let dz = -1; dz <= 1; dz++) {
                                const px = lx + dx;
                                const pz = lz + dz;
                                if (px >= 0 && px < CHUNK_SIZE && pz >= 0 && pz < CHUNK_SIZE) {
                                    data[blockIndex(px, y, pz)] = BlockType.OBSIDIAN;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    return data;
}
