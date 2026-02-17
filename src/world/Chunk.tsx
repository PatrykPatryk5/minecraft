/**
 * Chunk Renderer (Performance-Optimized)
 *
 * - Geometry disposal on unmount & rebuild (prevents memory leak = browser crash)
 * - MeshLambertMaterial for fast GPU rendering
 * - Frustum culling via Three.js built-in
 * - Uses refs to avoid React selector instability
 * - Tracks geometry references for proper cleanup
 */

import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { BLOCK_DATA } from '../core/blockTypes';
import { getBlockMaterial } from '../core/textures';
import useGameStore, { chunkKey, blockKey } from '../store/gameStore';
import { CHUNK_SIZE, type ChunkData } from '../core/terrainGen';

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

// ─── Component ───────────────────────────────────────────
interface ChunkProps {
    cx: number;
    cz: number;
}

const Chunk: React.FC<ChunkProps> = React.memo(({ cx, cz }) => {
    const key = chunkKey(cx, cz);
    const prevGeoRef = useRef<THREE.BufferGeometry[]>([]);

    // Subscribe to version counter ONLY
    const version = useGameStore((s) => s.chunkVersions[key] ?? 0);

    // Dispose old geometries when rebuilding or unmounting
    const disposeOld = () => {
        for (const g of prevGeoRef.current) {
            g.dispose();
        }
        prevGeoRef.current = [];
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disposeOld();
        };
    }, []);

    const meshData = useMemo(() => {
        // Dispose previous geometries
        disposeOld();

        const state = useGameStore.getState();
        const chunkData: ChunkData | undefined = state.chunks[key];
        if (!chunkData) return null;

        // Read neighbor chunks for cross-chunk face culling
        const nPx = state.chunks[chunkKey(cx + 1, cz)];
        const nNx = state.chunks[chunkKey(cx - 1, cz)];
        const nPz = state.chunks[chunkKey(cx, cz + 1)];
        const nNz = state.chunks[chunkKey(cx, cz - 1)];

        // Group faces by material key
        const groups: Record<string, {
            bt: number;
            ft: 'top' | 'bottom' | 'side';
            positions: number[];
            normals: number[];
            uvs: number[];
            indices: number[];
        }> = {};

        const entries = Object.entries(chunkData);
        for (let e = 0; e < entries.length; e++) {
            const [bk, bt] = entries[e];
            if (!bt) continue;

            const parts = bk.split(',');
            const lx = +parts[0], y = +parts[1], lz = +parts[2];

            for (let f = 0; f < FACES.length; f++) {
                const face = FACES[f];
                const nx = lx + face.dir[0];
                const ny = y + face.dir[1];
                const nz = lz + face.dir[2];

                // Determine neighbor block type
                let nbt = 0;
                if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE && ny >= 0) {
                    nbt = chunkData[blockKey(nx, ny, nz)] ?? 0;
                } else if (ny >= 0) {
                    let nc: ChunkData | undefined;
                    let nlx = nx, nlz = nz;
                    if (nx < 0) { nc = nNx; nlx = CHUNK_SIZE - 1; }
                    else if (nx >= CHUNK_SIZE) { nc = nPx; nlx = 0; }
                    else if (nz < 0) { nc = nNz; nlz = CHUNK_SIZE - 1; }
                    else if (nz >= CHUNK_SIZE) { nc = nPz; nlz = 0; }
                    if (nc) nbt = nc[blockKey(nlx, ny, nlz)] ?? 0;
                }

                if (!isTransparent(nbt)) continue;
                if (bt === nbt) continue;

                const ft = faceType(face.name);
                const mk = `${bt}_${ft}`;

                if (!groups[mk]) {
                    groups[mk] = { bt, ft, positions: [], normals: [], uvs: [], indices: [] };
                }

                const g = groups[mk];
                const vo = g.positions.length / 3;

                for (let i = 0; i < 4; i++) {
                    g.positions.push(lx + face.corners[i][0], y + face.corners[i][1], lz + face.corners[i][2]);
                    g.normals.push(face.dir[0], face.dir[1], face.dir[2]);
                    g.uvs.push(face.uv[i][0], face.uv[i][1]);
                }

                g.indices.push(vo, vo + 1, vo + 2, vo, vo + 2, vo + 3);
            }
        }

        // Build geometries + materials
        const result: { geo: THREE.BufferGeometry; mat: THREE.MeshLambertMaterial }[] = [];
        const newGeos: THREE.BufferGeometry[] = [];

        for (const g of Object.values(groups)) {
            if (g.positions.length === 0) continue;

            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(g.positions, 3));
            geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.normals, 3));
            geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uvs, 2));
            geo.setIndex(g.indices);
            geo.computeBoundingSphere();

            result.push({ geo, mat: getBlockMaterial(g.bt, g.ft) });
            newGeos.push(geo);
        }

        prevGeoRef.current = newGeos;
        return result;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, version]);

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
