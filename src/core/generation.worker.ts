import * as Comlink from 'comlink';
import { generateChunk, initSeed, CHUNK_SIZE, MAX_HEIGHT, blockIndex } from './terrainGen';
import { generateEndChunk, generateNetherChunk } from './dimensionGen';
import { FACES, isTransparent, getAtlasUV, initWorkerUVs, AtlasUV } from './meshingUtils';
import { BLOCK_DATA, BlockType } from './blockTypes';

export class TerrainWorker {
    private padded: Uint16Array = new Uint16Array(18 * 270 * 18); // Slightly larger for safety

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
        const step = 1 << lod;

        // Padded buffer for AO (18x258x18)
        const PH = MAX_HEIGHT + 2;
        const PD = CHUNK_SIZE + 2;
        const padded = this.padded;
        padded.fill(0);

        for (let lx = -1; lx <= CHUNK_SIZE; lx++) {
            for (let lz = -1; lz <= CHUNK_SIZE; lz++) {
                const targetChunk = (lx < 0) ? nNx : (lx >= CHUNK_SIZE) ? nPx : (lz < 0) ? nNz : (lz >= CHUNK_SIZE) ? nPz : chunkData;
                if (!targetChunk) continue;
                const nlx = (lx + 16) % 16;
                const nlz = (lz + 16) % 16;
                for (let y = 0; y < MAX_HEIGHT; y++) {
                    const idx = blockIndex(nlx, y, nlz);
                    padded[(lx + 1) * PH * PD + (y + 1) * PD + (lz + 1)] = targetChunk[idx];
                }
            }
        }

        const isSolidAt = (lx: number, y: number, lz: number): boolean => {
            const id = padded[(lx + 1) * PH * PD + (y + 1) * PD + (lz + 1)] & 0x0FFF;
            return id > 0 && (BLOCK_DATA[id]?.solid ?? false);
        };

        const getBlockAt = (x: number, y: number, z: number): number => {
            if (y < 0 || y >= MAX_HEIGHT) return 0x7FFF;
            if (x >= -1 && x <= CHUNK_SIZE && z >= -1 && z <= CHUNK_SIZE) {
                return padded[(x + 1) * PH * PD + (y + 1) * PD + (z + 1)] & 0x0FFF;
            }
            const cx_off = Math.floor(x / CHUNK_SIZE);
            const cz_off = Math.floor(z / CHUNK_SIZE);
            let neighbor: Uint16Array | null = null;
            if (cx_off === 1 && cz_off === 0) neighbor = nPx;
            else if (cx_off === -1 && cz_off === 0) neighbor = nNx;
            else if (cx_off === 0 && cz_off === 1) neighbor = nPz;
            else if (cx_off === 0 && cz_off === -1) neighbor = nNz;
            if (neighbor) {
                const nlx = (x % 16 + 16) % 16;
                const nlz = (z % 16 + 16) % 16;
                return neighbor[blockIndex(nlx, y, nlz)] & 0x0FFF;
            }
            return 0;
        };

        const solid = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], colors: [] as number[], indices: [] as number[], isFlora: [] as number[], isLiquid: [] as number[], lightEmit: [] as number[] };
        const water = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], colors: [] as number[], indices: [] as number[], isFlora: [] as number[], isLiquid: [] as number[], lightEmit: [] as number[] };
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

        for (let lx = 0; lx < CHUNK_SIZE; lx += step) {
            for (let lz = 0; lz < CHUNK_SIZE; lz += step) {
                for (let y = 0; y <= maxChunkHeight; y += step) {
                    const raw = chunkData[blockIndex(lx, y, lz)];
                    const bt = raw & 0x0FFF;
                    if (!bt) continue;

                    const isLiquidBlock = bt === BlockType.WATER || bt === BlockType.LAVA;
                    const target = isLiquidBlock ? water : solid;

                    for (let f = 0; f < FACES.length; f++) {
                        const face = FACES[f];

                        // Visibility check accounting for LOD step
                        const nbt = getBlockAt(lx + face.dir[0] * step, y + face.dir[1] * step, lz + face.dir[2] * step);

                        let visible = false;
                        if (nbt === 0x7FFF) visible = true;
                        else if (isTransparent(nbt)) {
                            // Fix: Hide faces between same liquid types
                            if (isLiquidBlock && (nbt === BlockType.WATER || nbt === BlockType.LAVA)) {
                                visible = false;
                            } else {
                                visible = true;
                            }
                        }

                        if (!visible) continue;

                        // Fast skip for foliage at distance
                        if (lod === 2 && (bt === BlockType.TALL_GRASS || bt === BlockType.FLOWER_RED || bt === BlockType.FLOWER_YELLOW)) continue;

                        const atlasUV = getAtlasUV(bt, face.name);
                        const baseIdx = isLiquidBlock ? waterIdx : solidIdx;
                        const cornerAO: number[] = [0, 0, 0, 0];

                        if (lod === 0 && !isLiquidBlock) {
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

                        const info = BLOCK_DATA[bt];
                        const isLightSource = (info?.light ?? 0) > 0;
                        const isFloraBlock = bt === BlockType.LEAVES || bt === BlockType.TALL_GRASS || bt === BlockType.FLOWER_RED || bt === BlockType.FLOWER_YELLOW;

                        for (let i = 0; i < 4; i++) {
                            const corner = face.corners[i];
                            target.positions.push((lx + corner[0] * step), (y + corner[1] * step), (lz + corner[2] * step));
                            target.normals.push(face.dir[0], face.dir[1], face.dir[2]);
                            target.uvs.push(atlasUV.u + face.uv[i][0] * atlasUV.su, atlasUV.v + face.uv[i][1] * atlasUV.sv);

                            const br = (lod === 0 && !isLiquidBlock) ? (1.0 - cornerAO[i] * 0.2) : 1.0;
                            target.colors.push(br, br, br);
                            target.lightEmit.push(isLightSource ? 1 : 0);
                            target.isFlora.push(isFloraBlock ? 1 : 0);
                            target.isLiquid.push(isLiquidBlock ? 1 : 0);
                        }

                        // Fix: Corrected AO flip condition (inverted previously)
                        if (lod === 0 && !isLiquidBlock && (cornerAO[0] + cornerAO[2] > cornerAO[1] + cornerAO[3])) {
                            target.indices.push(baseIdx + 1, baseIdx + 2, baseIdx + 3, baseIdx + 1, baseIdx + 3, baseIdx + 0);
                        } else {
                            target.indices.push(baseIdx + 0, baseIdx + 1, baseIdx + 2, baseIdx + 0, baseIdx + 2, baseIdx + 3);
                        }
                        if (isLiquidBlock) waterIdx += 4; else solidIdx += 4;
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
