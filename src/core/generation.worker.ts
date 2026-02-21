import * as Comlink from 'comlink';
import { generateChunk, initSeed, CHUNK_SIZE, MAX_HEIGHT, blockIndex } from './terrainGen';
import { generateEndChunk, generateNetherChunk } from './dimensionGen';
import { FACES, isTransparent, getAtlasUV, initWorkerUVs, AtlasUV } from './meshingUtils';
import { BLOCK_DATA, BlockType } from './blockTypes';

export class TerrainWorker {
    initSeed(seed: number) {
        initSeed(seed);
    }

    initUVs(uvs: Record<string, AtlasUV>) {
        initWorkerUVs(uvs);
    }

    generate(cx: number, cz: number, dimension: string) {
        let data: Uint16Array;
        if (dimension === 'end') {
            data = generateEndChunk(cx, cz);
        } else if (dimension === 'nether') {
            data = generateNetherChunk(cx, cz);
        } else {
            data = generateChunk(cx, cz);
        }

        return Comlink.transfer(data, [data.buffer]);
    }

    mesh(cx: number, cz: number, chunkData: Uint16Array, neighbors: (Uint16Array | null)[], lod: number) {
        const [nPx, nNx, nPz, nNz] = neighbors;

        // Padded buffer for AO (18x258x18)
        const PH = MAX_HEIGHT + 2;
        const PD = CHUNK_SIZE + 2;
        const padded = new Uint16Array((CHUNK_SIZE + 2) * PH * PD);

        for (let lx = -1; lx <= CHUNK_SIZE; lx++) {
            for (let lz = -1; lz <= CHUNK_SIZE; lz++) {
                const targetChunk = (lx < 0) ? nNx : (lx >= CHUNK_SIZE) ? nPx : (lz < 0) ? nNz : (lz >= CHUNK_SIZE) ? nPz : chunkData;
                if (!targetChunk) continue;
                const nlx = (lx + 16) % 16;
                const nlz = (lz + 16) % 16;
                for (let y = 0; y < MAX_HEIGHT; y++) {
                    padded[(lx + 1) * PH * PD + (y + 1) * PD + (lz + 1)] = targetChunk[blockIndex(nlx, y, nlz)];
                }
            }
        }

        const isSolidAt = (lx: number, y: number, lz: number): boolean => {
            const raw = padded[(lx + 1) * PH * PD + (y + 1) * PD + (lz + 1)];
            const id = raw & 0x0FFF;
            return id > 0 && (BLOCK_DATA[id]?.solid ?? false);
        };

        const solid = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], colors: [] as number[], indices: [] as number[], isFlora: [] as number[], isLiquid: [] as number[] };
        const water = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], colors: [] as number[], indices: [] as number[], isFlora: [] as number[], isLiquid: [] as number[] };
        let solidIdx = 0;
        let waterIdx = 0;

        let maxChunkHeight = 0;
        for (let i = 0; i < chunkData.length; i++) {
            if (chunkData[i] > 0) {
                const y = i >> 8;
                if (y > maxChunkHeight) maxChunkHeight = y;
            }
        }
        maxChunkHeight = Math.min(MAX_HEIGHT - 1, maxChunkHeight + 1);

        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                for (let y = 0; y <= maxChunkHeight; y++) {
                    const raw = chunkData[blockIndex(lx, y, lz)];
                    const bt = raw & 0x0FFF;
                    const power = (raw & 0xF000) >> 12;
                    if (!bt) continue;

                    const isLiquidBlock = bt === BlockType.WATER || bt === BlockType.LAVA;
                    const isWater = bt === BlockType.WATER;
                    const target = isWater ? water : solid;

                    for (let f = 0; f < FACES.length; f++) {
                        const face = FACES[f];
                        const nlx = lx + face.dir[0];
                        const nny = y + face.dir[1];
                        const nlz = lz + face.dir[2];
                        const nbt_raw = padded[(nlx + 1) * PH * PD + (nny + 1) * PD + (nlz + 1)];
                        const nbt = nbt_raw & 0x0FFF;

                        let liquidHeight = 1.0;
                        let neighborLiquidHeight = 1.0;
                        if (isLiquidBlock) {
                            let up_raw = 0;
                            if (y < MAX_HEIGHT - 1) up_raw = chunkData[blockIndex(lx, y + 1, lz)];
                            if ((up_raw & 0x0FFF) !== bt) liquidHeight = 0.88;
                            if (nbt === bt) {
                                const n_up_raw = padded[(nlx + 1) * PH * PD + (nny + 1 + 1) * PD + (nlz + 1)];
                                if ((n_up_raw & 0x0FFF) !== nbt) neighborLiquidHeight = 0.88;
                            }
                        }

                        if (!isTransparent(nbt)) continue;
                        if (lod === 2 && (bt === BlockType.TALL_GRASS || bt === BlockType.FLOWER_RED || bt === BlockType.FLOWER_YELLOW || (bt >= BlockType.WHEAT_0 && bt <= BlockType.WHEAT_7))) continue;
                        if (bt === nbt && bt !== BlockType.LEAVES) {
                            if (isLiquidBlock && liquidHeight > neighborLiquidHeight) { } else continue;
                        }

                        const atlasUV = getAtlasUV(bt, face.name);
                        const baseIdx = isWater ? waterIdx : solidIdx;
                        const cornerAO: number[] = [0, 0, 0, 0];

                        if (lod === 0 && !isWater) {
                            const dx = face.dir[0], dy = face.dir[1], dz = face.dir[2];
                            for (let i = 0; i < 4; i++) {
                                const corner = face.corners[i];
                                const ox = corner[0] * 2 - 1, oy = corner[1] * 2 - 1, oz = corner[2] * 2 - 1;
                                let aoLevel = 0;
                                if (Math.abs(dx) === 1) {
                                    const s1 = isSolidAt(lx + dx, y + corner[1], lz + oz), s2 = isSolidAt(lx + dx, y + oy, lz + corner[2]), c = isSolidAt(lx + dx, y + oy, lz + oz);
                                    aoLevel = (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s1 && s2 ? 1 : c ? 1 : 0);
                                } else if (Math.abs(dy) === 1) {
                                    const s1 = isSolidAt(lx + ox, y + dy, lz + corner[2]), s2 = isSolidAt(lx + corner[0], y + dy, lz + oz), c = isSolidAt(lx + ox, y + dy, lz + oz);
                                    aoLevel = (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s1 && s2 ? 1 : c ? 1 : 0);
                                } else {
                                    const s1 = isSolidAt(lx + ox, y + corner[1], lz + dz), s2 = isSolidAt(lx + corner[0], y + oy, lz + dz), c = isSolidAt(lx + ox, y + oy, lz + dz);
                                    aoLevel = (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s1 && s2 ? 1 : c ? 1 : 0);
                                }
                                cornerAO[i] = aoLevel;
                            }
                        }

                        for (let i = 0; i < 4; i++) {
                            const corner = face.corners[i];
                            let cy0 = y + corner[1];
                            if (corner[1] === 1 && liquidHeight < 1.0) cy0 = y + liquidHeight;
                            target.positions.push(lx + corner[0], cy0, lz + corner[2]);
                            target.normals.push(face.dir[0], face.dir[1], face.dir[2]);
                            target.uvs.push(atlasUV.u + face.uv[i][0] * atlasUV.su, atlasUV.v + face.uv[i][1] * atlasUV.sv);
                            let br = 1.0;
                            if (lod === 0 && !isWater) {
                                br = 1.0 - cornerAO[i] * 0.2;
                                // Prevent very dark corner artifacts on grass tops.
                                if (bt === BlockType.GRASS && face.name === 'top') br = Math.max(br, 0.78);
                                else br = Math.max(br, 0.42);
                            }
                            let r = br, g = br, b = br;
                            if (bt === BlockType.REDSTONE_WIRE) {
                                const intensity = 0.3 + (power / 15) * 0.7;
                                r *= intensity; g *= (intensity * 0.1); b *= (intensity * 0.1);
                            } else if (bt === BlockType.REDSTONE_LAMP && power > 0) {
                                r *= 1.4; g *= 1.2; b *= 0.8;
                            } else if (bt === BlockType.REDSTONE_TORCH && power > 0) {
                                r *= 1.5; g *= 0.3; b *= 0.3;
                            }
                            target.colors.push(r, g, b);
                            const isFloraBlock = bt === BlockType.LEAVES || bt === BlockType.TALL_GRASS || bt === BlockType.FLOWER_RED || bt === BlockType.FLOWER_YELLOW || (bt >= BlockType.WHEAT_0 && bt <= BlockType.WHEAT_7);
                            const isTopVert = corner[1] > 0;
                            target.isFlora.push(isFloraBlock ? (bt === BlockType.LEAVES ? 0.3 : (isTopVert ? 1.0 : 0.0)) : 0);
                            target.isLiquid.push(isLiquidBlock && isTopVert && liquidHeight < 1.0 ? 1.0 : 0.0);
                        }

                        if (lod === 0 && !isWater && (cornerAO[0] + cornerAO[2] > cornerAO[1] + cornerAO[3])) {
                            target.indices.push(baseIdx + 1, baseIdx + 2, baseIdx + 3, baseIdx + 1, baseIdx + 3, baseIdx);
                        } else {
                            target.indices.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
                        }
                        if (isWater) waterIdx += 4; else solidIdx += 4;
                    }
                }
            }
        }

        const result = { solid, water };
        const transferables: Transferable[] = [];
        const addTrans = (obj: any) => {
            for (const k in obj) {
                if (Array.isArray(obj[k])) {
                    const arr = new Float32Array(obj[k]);
                    if (k === 'indices') {
                        const iarr = new Uint32Array(obj[k]);
                        obj[k] = iarr;
                        transferables.push(iarr.buffer);
                    } else {
                        obj[k] = arr;
                        transferables.push(arr.buffer);
                    }
                }
            }
        };
        addTrans(result.solid);
        addTrans(result.water);

        return Comlink.transfer(result, transferables);
    }
}

Comlink.expose(new TerrainWorker());
