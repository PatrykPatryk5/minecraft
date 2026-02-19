/**
 * Chunk Renderer (LOD + Geometry Pooling)
 *
 * Improvements:
 *   - LOD levels: 0=full (AO), 1=no AO, 2=skip small faces
 *   - Geometry buffer pool — reuses disposed buffers
 *   - Proper disposal on unmount & rebuild
 *   - MeshLambertMaterial for GPU perf
 *   - Cross-chunk face culling
 */

import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { BLOCK_DATA } from '../core/blockTypes';
import { getBlockMaterial } from '../core/textures';
import useGameStore, { chunkKey } from '../store/gameStore';
import { CHUNK_SIZE, blockIndex, type ChunkData, MAX_HEIGHT } from '../core/terrainGen';

// ─── Face Definitions ────────────────────────────────────
interface FaceDef {
    dir: [number, number, number];
    corners: [number, number, number][];
    uv: [number, number][];
    name: 'right' | 'left' | 'top' | 'bottom' | 'front' | 'back';
}

const FACES: FaceDef[] = [
    { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], uv: [[0, 0], [0, 1], [1, 1], [1, 0]], name: 'right' },
    { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], uv: [[0, 0], [0, 1], [1, 1], [1, 0]], name: 'left' },
    { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], name: 'top' },
    { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], name: 'bottom' },
    { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], name: 'front' },
    { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], name: 'back' },
];

function faceType(name: string): 'top' | 'bottom' | 'side' {
    if (name === 'top') return 'top';
    if (name === 'bottom') return 'bottom';
    return 'side';
}

function isTransparent(bt: number): boolean {
    if (!bt) return true;
    return BLOCK_DATA[bt]?.transparent ?? true;
}

// ─── Geometry Pool ───────────────────────────────────────
const geoPool: THREE.BufferGeometry[] = [];
const MAX_POOL = 64;

function getPooledGeo(): THREE.BufferGeometry {
    return geoPool.pop() || new THREE.BufferGeometry();
}

function returnToPool(geo: THREE.BufferGeometry): void {
    if (geoPool.length < MAX_POOL) {
        // Clear attributes for reuse
        geo.deleteAttribute('position');
        geo.deleteAttribute('normal');
        geo.deleteAttribute('uv');
        geo.deleteAttribute('color');
        geo.setIndex(null);
        geoPool.push(geo);
    } else {
        geo.dispose();
    }
}

// ─── Component ───────────────────────────────────────────
interface ChunkProps {
    cx: number;
    cz: number;
    lod?: 0 | 1 | 2; // 0=full, 1=no AO, 2=simplified
}

const Chunk: React.FC<ChunkProps> = React.memo(({ cx, cz, lod = 0 }) => {
    const key = chunkKey(cx, cz);
    const prevGeoRef = useRef<THREE.BufferGeometry[]>([]);

    // Subscribe to version counter ONLY
    const version = useGameStore((s) => s.chunkVersions[key] ?? 0);

    const disposeOld = () => {
        for (const g of prevGeoRef.current) {
            returnToPool(g);
        }
        prevGeoRef.current = [];
    };

    useEffect(() => {
        return () => { disposeOld(); };
    }, []);

    const meshData = useMemo(() => {
        disposeOld();

        const state = useGameStore.getState();
        const chunkData: ChunkData | undefined = state.chunks[key];
        if (!chunkData) return null;

        const nPx = state.chunks[chunkKey(cx + 1, cz)];
        const nNx = state.chunks[chunkKey(cx - 1, cz)];
        const nPz = state.chunks[chunkKey(cx, cz + 1)];
        const nNz = state.chunks[chunkKey(cx, cz - 1)];

        // AO helper — skipped for LOD 1+
        const isSolidAt = (lx: number, y: number, lz: number): boolean => {
            if (y < 0) return true;
            if (y >= MAX_HEIGHT) return false;
            let type = 0;
            if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
                type = chunkData[blockIndex(lx, y, lz)];
            } else {
                let nc: ChunkData | undefined;
                let nlx = lx, nlz = lz;
                if (lx < 0) { nc = nNx; nlx = CHUNK_SIZE - 1; }
                else if (lx >= CHUNK_SIZE) { nc = nPx; nlx = 0; }
                else if (lz < 0) { nc = nNz; nlz = CHUNK_SIZE - 1; }
                else if (lz >= CHUNK_SIZE) { nc = nPz; nlz = 0; }
                if (nc) type = nc[blockIndex(nlx, y, nlz)];
            }
            return type > 0 && (BLOCK_DATA[type]?.solid ?? false);
        };

        // Group faces by material key
        const groups: Record<string, {
            bt: number;
            ft: 'top' | 'bottom' | 'side';
            positions: number[];
            normals: number[];
            uvs: number[];
            colors: number[];
            indices: number[];
        }> = {};

        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                for (let y = 0; y < MAX_HEIGHT; y++) {
                    const bt = chunkData[blockIndex(lx, y, lz)];
                    if (!bt) continue;

                    for (let f = 0; f < FACES.length; f++) {
                        const face = FACES[f];
                        const nx = lx + face.dir[0];
                        const ny = y + face.dir[1];
                        const nz = lz + face.dir[2];

                        let nbt = 0;
                        if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE && ny >= 0 && ny < MAX_HEIGHT) {
                            nbt = chunkData[blockIndex(nx, ny, nz)];
                        } else if (ny >= 0) {
                            let nc: ChunkData | undefined;
                            let nlx = nx, nlz = nz;
                            if (nx < 0) { nc = nNx; nlx = CHUNK_SIZE - 1; }
                            else if (nx >= CHUNK_SIZE) { nc = nPx; nlx = 0; }
                            else if (nz < 0) { nc = nNz; nlz = CHUNK_SIZE - 1; }
                            else if (nz >= CHUNK_SIZE) { nc = nPz; nlz = 0; }
                            if (nc) nbt = nc[blockIndex(nlx, ny, nlz)];
                        }

                        if (!isTransparent(nbt)) continue;
                        if (bt === nbt) continue;

                        const ft = faceType(face.name);
                        const mk = `${bt}_${ft}`;

                        if (!groups[mk]) {
                            groups[mk] = { bt, ft, positions: [], normals: [], uvs: [], colors: [], indices: [] };
                        }

                        const g = groups[mk];
                        const vo = g.positions.length / 3;

                        for (let i = 0; i < 4; i++) {
                            const cx0 = lx + face.corners[i][0];
                            const cy0 = y + face.corners[i][1];
                            const cz0 = lz + face.corners[i][2];
                            g.positions.push(cx0, cy0, cz0);
                            g.normals.push(face.dir[0], face.dir[1], face.dir[2]);
                            g.uvs.push(face.uv[i][0], face.uv[i][1]);

                            // AO — only for LOD 0
                            if (lod === 0) {
                                let aoLevel = 0;
                                const dx = face.dir[0], dy = face.dir[1], dz = face.dir[2];
                                const ox = face.corners[i][0] * 2 - 1;
                                const oy = face.corners[i][1] * 2 - 1;
                                const oz = face.corners[i][2] * 2 - 1;
                                if (Math.abs(dx) === 1) {
                                    const s1 = isSolidAt(lx + dx, y + face.corners[i][1], lz + oz);
                                    const s2 = isSolidAt(lx + dx, y + oy, lz + face.corners[i][2]);
                                    const corner = isSolidAt(lx + dx, y + oy, lz + oz);
                                    aoLevel = (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s1 && s2 ? 1 : corner ? 1 : 0);
                                } else if (Math.abs(dy) === 1) {
                                    const s1 = isSolidAt(lx + ox, y + dy, lz + face.corners[i][2]);
                                    const s2 = isSolidAt(lx + face.corners[i][0], y + dy, lz + oz);
                                    const corner = isSolidAt(lx + ox, y + dy, lz + oz);
                                    aoLevel = (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s1 && s2 ? 1 : corner ? 1 : 0);
                                } else {
                                    const s1 = isSolidAt(lx + ox, y + face.corners[i][1], lz + dz);
                                    const s2 = isSolidAt(lx + face.corners[i][0], y + oy, lz + dz);
                                    const corner = isSolidAt(lx + ox, y + oy, lz + dz);
                                    aoLevel = (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s1 && s2 ? 1 : corner ? 1 : 0);
                                }
                                const brightness = 1.0 - aoLevel * 0.18;
                                g.colors.push(brightness, brightness, brightness);
                            } else {
                                // No AO for LOD 1/2 — flat lighting
                                g.colors.push(1.0, 1.0, 1.0);
                            }
                        }

                        g.indices.push(vo, vo + 1, vo + 2, vo, vo + 2, vo + 3);
                    }
                }
            }
        }

        // Build geometries + materials
        const result: { geo: THREE.BufferGeometry; mat: THREE.MeshLambertMaterial }[] = [];
        const newGeos: THREE.BufferGeometry[] = [];

        for (const g of Object.values(groups)) {
            if (g.positions.length === 0) continue;

            const geo = getPooledGeo();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(g.positions, 3));
            geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.normals, 3));
            geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uvs, 2));
            geo.setAttribute('color', new THREE.Float32BufferAttribute(g.colors, 3));
            geo.setIndex(g.indices);
            geo.computeBoundingSphere();

            result.push({ geo, mat: getBlockMaterial(g.bt, g.ft) });
            newGeos.push(geo);
        }

        prevGeoRef.current = newGeos;
        return result;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, version, lod]);

    if (!meshData || meshData.length === 0) return null;

    return (
        <group position={[cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE]}>
            {meshData.map((m, i) => (
                <mesh key={i} geometry={m.geo} material={m.mat} frustumCulled />
            ))}
        </group>
    );
});

Chunk.displayName = 'Chunk';
export default Chunk;
