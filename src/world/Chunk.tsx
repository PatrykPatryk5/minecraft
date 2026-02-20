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
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BLOCK_DATA, BlockType } from '../core/blockTypes';
import { getBlockMaterial, getAtlasTexture, getAtlasUV } from '../core/textures';
import { RigidBody } from '@react-three/rapier';
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

function isTransparent(bt: number): boolean {
    if (!bt) return true;
    return BLOCK_DATA[bt]?.transparent ?? true;
}

// ─── Geometry Pool ───────────────────────────────────────
const geoPool: THREE.BufferGeometry[] = [];
const MAX_POOL = 512;

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

// ─── Meshing Helper (Module Scope to avoid GC) ───────────
interface MeshBuffer {
    positions: number[];
    normals: number[];
    uvs: number[];
    colors: number[];
    indices: number[];
    isFlora: number[];
    isLiquid: number[];
}

const SHARED_GROUPS = new Map<string, MeshBuffer>();

function getSharedBuffer(key: string): MeshBuffer {
    let b = SHARED_GROUPS.get(key);
    if (!b) {
        b = { positions: [], normals: [], uvs: [], colors: [], indices: [], isFlora: [], isLiquid: [] };
        SHARED_GROUPS.set(key, b);
    }
    // Clear for reuse
    b.positions.length = 0;
    b.normals.length = 0;
    b.uvs.length = 0;
    b.colors.length = 0;
    b.indices.length = 0;
    b.isFlora.length = 0;
    b.isLiquid.length = 0;
    return b;
}

// ─── Component ───────────────────────────────────────────
interface ChunkProps {
    cx: number;
    cz: number;
    lod?: 0 | 1 | 2; // 0=full, 1=no AO, 2=simplified
    dist?: number;
}

const Chunk: React.FC<ChunkProps> = React.memo(({ cx, cz, lod = 0, dist = 0 }) => {
    const key = chunkKey(cx, cz);
    const version = useGameStore((s) => s.chunkVersions[key] ?? 0);

    // Subscribe to neighbor versions so borders (liquid connections, AO) update correctly
    const v_nPx = useGameStore((s) => s.chunkVersions[chunkKey(cx + 1, cz)] ?? -1);
    const v_nNx = useGameStore((s) => s.chunkVersions[chunkKey(cx - 1, cz)] ?? -1);
    const v_nPz = useGameStore((s) => s.chunkVersions[cx + ',' + (cz + 1)] ?? -1);
    const v_nNz = useGameStore((s) => s.chunkVersions[cx + ',' + (cz - 1)] ?? -1);

    const useShadows = useGameStore((s) => s.settings.graphics !== 'fast');
    const [meshData, setMeshData] = React.useState<{ solidGeo: THREE.BufferGeometry | null, waterGeo: THREE.BufferGeometry | null, atlas: THREE.Texture } | null>(null);

    const solidShaderRef = useRef<any>(null);
    const waterShaderRef = useRef<any>(null);

    useEffect(() => {
        return () => {
            if (meshData) {
                if (meshData.solidGeo) returnToPool(meshData.solidGeo);
                if (meshData.waterGeo) returnToPool(meshData.waterGeo);
            }
        };
    }, [meshData]);

    useEffect(() => {
        let active = true;

        const buildMesh = async () => {
            // Yield to main thread briefly before heavy work
            await new Promise(r => setTimeout(r, 0));
            if (!active) return;
            const state = useGameStore.getState();
            const chunkData: ChunkData | undefined = state.chunks[key];
            if (!chunkData) {
                if (active) setMeshData(null);
                return;
            }

            // Ensure atlas is ready
            const atlas = getAtlasTexture();

            const nPx = state.chunks[chunkKey(cx + 1, cz)];
            const nNx = state.chunks[chunkKey(cx - 1, cz)];
            const nPz = state.chunks[chunkKey(cx, cz + 1)];
            const nNz = state.chunks[chunkKey(cx, cz - 1)];

            // Data arrays for SOLID mesh
            const solid = {
                pos: [] as number[],
                norm: [] as number[],
                uv: [] as number[],
                color: [] as number[],
                isFlora: [] as number[],
                isLiquid: [] as number[],
                ind: [] as number[]
            };
            let solidIdx = 0;

            // Data arrays for WATER mesh (transparent)
            const water = {
                pos: [] as number[],
                norm: [] as number[],
                uv: [] as number[],
                color: [] as number[],
                isFlora: [] as number[],
                isLiquid: [] as number[],
                ind: [] as number[]
            };
            let waterIdx = 0;

            // AO Helper
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
                        const bt = chunkData[blockIndex(lx, y, lz)];
                        if (!bt) continue;

                        const isLiquidBlock = bt === BlockType.WATER || bt === BlockType.LAVA;
                        const isWater = bt === BlockType.WATER;
                        const target = isWater ? water : solid;

                        for (let f = 0; f < FACES.length; f++) {
                            const face = FACES[f];
                            const nx = lx + face.dir[0];
                            const ny = y + face.dir[1];
                            const nz = lz + face.dir[2];

                            let nbt = 0;
                            if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE && ny >= 0 && ny < MAX_HEIGHT) {
                                nbt = chunkData[blockIndex(nx, ny, nz)];
                            } else if (ny >= 0 && ny < MAX_HEIGHT) {
                                let nc: ChunkData | undefined;
                                let nlx = nx, nlz = nz;
                                if (nx < 0) { nc = nNx; nlx = CHUNK_SIZE - 1; }
                                else if (nx >= CHUNK_SIZE) { nc = nPx; nlx = 0; }
                                else if (nz < 0) { nc = nNz; nlz = CHUNK_SIZE - 1; }
                                else if (nz >= CHUNK_SIZE) { nc = nPz; nlz = 0; }
                                if (nc) nbt = nc[blockIndex(nlx, ny, nlz)];
                            }

                            let liquidHeight = 1.0;
                            let neighborLiquidHeight = 1.0;

                            if (isLiquidBlock) {
                                let up = 0;
                                if (y < MAX_HEIGHT - 1) up = chunkData[blockIndex(lx, y + 1, lz)];
                                if (up !== bt) liquidHeight = 0.88;

                                if (nbt === bt) {
                                    let n_up = 0;
                                    if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE && ny + 1 >= 0 && ny + 1 < MAX_HEIGHT) {
                                        n_up = chunkData[blockIndex(nx, ny + 1, nz)];
                                    } else if (ny + 1 >= 0 && ny + 1 < MAX_HEIGHT) {
                                        let nc: ChunkData | undefined;
                                        let nlx = nx, nlz = nz;
                                        if (nx < 0) { nc = nNx; nlx = CHUNK_SIZE - 1; }
                                        else if (nx >= CHUNK_SIZE) { nc = nPx; nlx = 0; }
                                        else if (nz < 0) { nc = nNz; nlz = CHUNK_SIZE - 1; }
                                        else if (nz >= CHUNK_SIZE) { nc = nPz; nlz = 0; }
                                        if (nc) n_up = nc[blockIndex(nlx, ny + 1, nlz)];
                                    }
                                    if (n_up !== nbt) neighborLiquidHeight = 0.88;
                                }
                            }

                            if (!isTransparent(nbt)) continue;

                            if (bt === nbt && bt !== BlockType.LEAVES) {
                                if (isLiquidBlock && liquidHeight > neighborLiquidHeight) {
                                    // Draw the connecting face because we are taller!
                                } else {
                                    continue;
                                }
                            }

                            const atlasUV = getAtlasUV(bt, face.name);
                            const baseIdx = isWater ? waterIdx : solidIdx;

                            for (let i = 0; i < 4; i++) {
                                const corner = face.corners[i];
                                const cx0 = lx + corner[0];
                                let cy0 = y + corner[1];
                                const cz0 = lz + corner[2];

                                if (corner[1] === 1 && liquidHeight < 1.0) cy0 = y + liquidHeight;

                                target.pos.push(cx0, cy0, cz0);
                                target.norm.push(face.dir[0], face.dir[1], face.dir[2]);

                                const ux = atlasUV.u + face.uv[i][0] * atlasUV.su;
                                const uy = atlasUV.v + face.uv[i][1] * atlasUV.sv;
                                target.uv.push(ux, uy);

                                if (lod === 0 && !isWater) {
                                    let aoLevel = 0;
                                    const dx = face.dir[0], dy = face.dir[1], dz = face.dir[2];
                                    const ox = corner[0] * 2 - 1;
                                    const oy = corner[1] * 2 - 1;
                                    const oz = corner[2] * 2 - 1;

                                    if (Math.abs(dx) === 1) {
                                        const s1 = isSolidAt(lx + dx, y + corner[1], lz + oz);
                                        const s2 = isSolidAt(lx + dx, y + oy, lz + corner[2]);
                                        const c = isSolidAt(lx + dx, y + oy, lz + oz);
                                        aoLevel = (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s1 && s2 ? 1 : c ? 1 : 0);
                                    } else if (Math.abs(dy) === 1) {
                                        const s1 = isSolidAt(lx + ox, y + dy, lz + corner[2]);
                                        const s2 = isSolidAt(lx + corner[0], y + dy, lz + oz);
                                        const c = isSolidAt(lx + ox, y + dy, lz + oz);
                                        aoLevel = (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s1 && s2 ? 1 : c ? 1 : 0);
                                    } else {
                                        const s1 = isSolidAt(lx + ox, y + corner[1], lz + dz);
                                        const s2 = isSolidAt(lx + corner[0], y + oy, lz + dz);
                                        const c = isSolidAt(lx + ox, y + oy, lz + dz);
                                        aoLevel = (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s1 && s2 ? 1 : c ? 1 : 0);
                                    }
                                    const br = 1.0 - aoLevel * 0.24; // Increased AO intensity for better block connections
                                    target.color.push(br, br, br);
                                } else {
                                    target.color.push(1.0, 1.0, 1.0);
                                }

                                const isFloraBlock =
                                    bt === BlockType.LEAVES ||
                                    bt === BlockType.TALL_GRASS ||
                                    bt === BlockType.FLOWER_RED ||
                                    bt === BlockType.FLOWER_YELLOW ||
                                    (bt >= BlockType.WHEAT_0 && bt <= BlockType.WHEAT_7);

                                const isTopVert = corner[1] > 0;
                                const swayLevel = isFloraBlock ? (bt === BlockType.LEAVES ? 0.3 : (isTopVert ? 1.0 : 0.0)) : 0;

                                target.isFlora.push(swayLevel);

                                if (isLiquidBlock && isTopVert && liquidHeight < 1.0) {
                                    target.isLiquid.push(1.0); // Only animate top face if it's open
                                } else {
                                    target.isLiquid.push(0.0);
                                }
                            }

                            target.ind.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
                            if (isWater) waterIdx += 4; else solidIdx += 4;
                        }
                    }
                }
            }

            const createGeo = (data: typeof solid) => {
                if (data.pos.length === 0) return null;
                const g = getPooledGeo();
                g.setAttribute('position', new THREE.Float32BufferAttribute(data.pos, 3));
                g.setAttribute('normal', new THREE.Float32BufferAttribute(data.norm, 3));
                g.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
                g.setAttribute('color', new THREE.Float32BufferAttribute(data.color, 3));
                if ((data as any).isFlora && (data as any).isFlora.length > 0) {
                    g.setAttribute('isFlora', new THREE.Float32BufferAttribute((data as any).isFlora, 1));
                }
                if ((data as any).isLiquid && (data as any).isLiquid.length > 0) {
                    g.setAttribute('isLiquid', new THREE.Float32BufferAttribute((data as any).isLiquid, 1));
                }
                g.setIndex(data.ind);
                g.computeBoundingSphere();
                return g;
            };

            const solidGeo = createGeo(solid);
            const waterGeo = createGeo(water);

            const newGeos: THREE.BufferGeometry[] = [];
            if (solidGeo) newGeos.push(solidGeo);
            if (waterGeo) newGeos.push(waterGeo);

            if (!active) {
                newGeos.forEach(returnToPool);
                return;
            }

            setMeshData({ solidGeo, waterGeo, atlas });
        };

        buildMesh();

        return () => {
            active = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, version, v_nPx, v_nNx, v_nPz, v_nNz, lod, cx, cz]);

    useFrame(({ clock }) => {
        if (solidShaderRef.current) {
            solidShaderRef.current.uniforms.uTime.value = clock.elapsedTime;
        }
        if (waterShaderRef.current) {
            waterShaderRef.current.uniforms.uTime.value = clock.elapsedTime;
        }
    });

    if (!meshData) return null;

    const renderSolidMesh = () => (
        <mesh geometry={meshData.solidGeo!} frustumCulled castShadow={useShadows} receiveShadow={useShadows}>
            <meshStandardMaterial
                map={meshData.atlas}
                vertexColors
                alphaTest={0.1}
                transparent={false}
                roughness={0.9}
                metalness={0.05}
                onBeforeCompile={(shader) => {
                    shader.uniforms.uTime = { value: 0 };
                    shader.uniforms.uChunkOffset = { value: new THREE.Vector2(cx * CHUNK_SIZE, cz * CHUNK_SIZE) };
                    // Add attribute and uniform
                    shader.vertexShader = shader.vertexShader.replace(
                        '#include <common>',
                        `
                        #include <common>
                        attribute float isFlora;
                        attribute float isLiquid;
                        uniform float uTime;
                        uniform vec2 uChunkOffset;
                        `
                    );

                    // Add displacement math
                    shader.vertexShader = shader.vertexShader.replace(
                        '#include <begin_vertex>',
                        `
                        #include <begin_vertex>
                        float worldX = position.x + uChunkOffset.x;
                        float worldZ = position.z + uChunkOffset.y;
                        if (isFlora > 0.0) {
                            float speed = uTime * 2.0;
                            float swayX = sin(worldX * 2.0 + position.y * 3.0 + speed) * 0.08 * isFlora;
                            float swayZ = cos(worldZ * 2.0 + position.y * 3.0 + (speed * 1.2)) * 0.08 * isFlora;
                            transformed.x += swayX;
                            transformed.z += swayZ;
                        }
                        if (isLiquid > 0.0) {
                            float speed = uTime * 1.5;
                            float wave = sin(worldX * 2.0 + worldZ * 2.0 + speed) * 0.06 * isLiquid;
                            transformed.y += wave;
                        }
                        `
                    );
                    solidShaderRef.current = shader;
                }}
            />
        </mesh>
    );

    return (
        <group position={[cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE]}>
            {meshData.solidGeo && (
                dist <= 4 ? (
                    <RigidBody key={meshData.solidGeo.uuid} type="fixed" colliders="trimesh">
                        {renderSolidMesh()}
                    </RigidBody>
                ) : renderSolidMesh()
            )}
            {meshData.waterGeo && (
                <mesh geometry={meshData.waterGeo} frustumCulled renderOrder={1} receiveShadow={useShadows}>
                    <meshStandardMaterial
                        map={meshData.atlas}
                        vertexColors
                        transparent={true}
                        opacity={0.8}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                        roughness={0.1}
                        metalness={0.1}
                        onBeforeCompile={(shader) => {
                            shader.uniforms.uTime = { value: 0 };
                            shader.uniforms.uChunkOffset = { value: new THREE.Vector2(cx * CHUNK_SIZE, cz * CHUNK_SIZE) };
                            shader.vertexShader = shader.vertexShader.replace(
                                '#include <common>',
                                `
                                #include <common>
                                attribute float isLiquid;
                                uniform float uTime;
                                uniform vec2 uChunkOffset;
                                `
                            );

                            shader.vertexShader = shader.vertexShader.replace(
                                '#include <begin_vertex>',
                                `
                                #include <begin_vertex>
                                float worldX = position.x + uChunkOffset.x;
                                float worldZ = position.z + uChunkOffset.y;
                                if (isLiquid > 0.0) {
                                    float speed = uTime * 1.5;
                                    float wave = sin(worldX * 2.0 + worldZ * 2.0 + speed) * 0.06 * isLiquid;
                                    transformed.y += wave;
                                }
                                `
                            );
                            waterShaderRef.current = shader;
                        }}
                    />
                </mesh>
            )}
        </group>
    );
});

Chunk.displayName = 'Chunk';
export default Chunk;
