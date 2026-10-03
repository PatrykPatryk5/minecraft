import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { getAtlasTexture } from '../core/textures';
import { RigidBody } from '@react-three/rapier';
import useGameStore, { chunkKey } from '../store/gameStore';
import { CHUNK_SIZE, blockIndex, type ChunkData, MAX_HEIGHT } from '../core/terrainGen';
import { getWorkerPool } from '../core/workerPool';
import { AnimatedChest } from '../environment/AnimatedChest';
import { createTerrainMaterial } from './terrainMaterial';

// ─── Geometry Pool ───────────────────────────────────────
const geoPool: THREE.BufferGeometry[] = [];
const MAX_POOL = 512;

function getPooledGeo(): THREE.BufferGeometry {
    const geo = geoPool.pop() || new THREE.BufferGeometry();
    geo.uuid = THREE.MathUtils.generateUUID();
    return geo;
}

function returnToPool(geo: THREE.BufferGeometry): void {
    // Release renderer-side vertex/index buffers before reusing this JS object.
    // Clearing attributes alone leaves the previous GPU allocations attached
    // to Three.js's geometry cache until the object is disposed.
    geo.dispose();
    if (geoPool.length < MAX_POOL) {
        geo.deleteAttribute('position');
        geo.deleteAttribute('normal');
        geo.deleteAttribute('uv');
        geo.deleteAttribute('color');
        geo.deleteAttribute('isFlora');
        geo.deleteAttribute('isLiquid');
        geo.setIndex(null);
        geoPool.push(geo);
    }
}

// ─── Component ───────────────────────────────────────────

interface ChunkProps {
    cx: number;
    cz: number;
    lod?: 0 | 1 | 2; // 0=full, 1=no AO, 2=simplified
    hasPhysics?: boolean;
    key?: string;
}

const Chunk: React.FC<ChunkProps> = React.memo(({ cx, cz, lod = 0, hasPhysics = false }) => {
    const key = chunkKey(cx, cz);
    const version = useGameStore((s) => s.chunkVersions[key] ?? 0);

    // Subscribe to neighbor versions so borders (liquid connections, AO) update correctly
    const v_nPx = useGameStore((s) => s.chunkVersions[chunkKey(cx + 1, cz)] ?? -1);
    const v_nNx = useGameStore((s) => s.chunkVersions[chunkKey(cx - 1, cz)] ?? -1);
    const v_nPz = useGameStore((s) => s.chunkVersions[cx + ',' + (cz + 1)] ?? -1);
    const v_nNz = useGameStore((s) => s.chunkVersions[cx + ',' + (cz - 1)] ?? -1);

    const useShadows = useGameStore((s) => s.settings.graphics === 'fancy' || s.settings.graphics === 'fabulous');

    const [meshData, setMeshData] = React.useState<{ solidGeo: THREE.BufferGeometry | null, waterGeo: THREE.BufferGeometry | null, atlas: THREE.Texture, chests: { x: number, y: number, z: number }[] } | null>(null);

    const activeLod = lod;

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
        let retryTimer: ReturnType<typeof setTimeout> | null = null;

        const buildMesh = async () => {
            try {
                const state = useGameStore.getState();
                const chunkData: ChunkData | undefined = state.chunks[key];
                if (!chunkData) {
                    if (active) setMeshData(null);
                    return;
                }

                const pool = getWorkerPool();
                if (!pool?.isReady()) {
                    if (active && retryTimer == null) {
                        retryTimer = setTimeout(() => {
                            retryTimer = null;
                            if (active) buildMesh();
                        }, 50);
                    }
                    return;
                }

                const nPx = state.chunks[chunkKey(cx + 1, cz)];
                const nNx = state.chunks[chunkKey(cx - 1, cz)];
                const nPz = state.chunks[chunkKey(cx, cz + 1)];
                const nNz = state.chunks[chunkKey(cx, cz - 1)];

                // Ensure atlas is ready
                const atlas = getAtlasTexture();

                // Request meshing from worker
                const result = await pool.submitMesh(cx, cz, chunkData, [nPx, nNx, nPz, nNz], activeLod);
                if (!active || !result) return;

                const createGeo = (data: any) => {
                    if (!data.positions || data.positions.length === 0) return null;
                    const g = getPooledGeo();
                    g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
                    g.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
                    g.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
                    g.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
                    if (data.isFlora && data.isFlora.length > 0) {
                        g.setAttribute('isFlora', new THREE.BufferAttribute(data.isFlora, 1));
                    }
                    if (data.isLiquid && data.isLiquid.length > 0) {
                        g.setAttribute('isLiquid', new THREE.BufferAttribute(data.isLiquid, 1));
                    }
                    g.setIndex(new THREE.BufferAttribute(data.indices, 1));
                    const halfWidth = CHUNK_SIZE / 2;
                    const halfHeight = result.maxY / 2;
                    g.boundingSphere = new THREE.Sphere(
                        new THREE.Vector3(halfWidth, halfHeight, halfWidth),
                        Math.sqrt(halfWidth * halfWidth * 2 + halfHeight * halfHeight),
                    );
                    return g;
                };

                const solidGeo = createGeo(result.solid);
                const waterGeo = createGeo(result.water);

                setMeshData({ solidGeo, waterGeo, atlas, chests: result.chests || [] });
            } catch (err) {
                console.error("Meshing error:", err);
            }
        };

        buildMesh();

        return () => {
            active = false;
            if (retryTimer) {
                clearTimeout(retryTimer);
                retryTimer = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, version, v_nPx, v_nNx, v_nPz, v_nNz, lod, cx, cz]);

    const solidMaterial = useMemo(() => createTerrainMaterial(getAtlasTexture()), []);
    const waterMaterial = useMemo(() => createTerrainMaterial(getAtlasTexture(), true), []);

    if (!meshData) return null;

    const renderSolidMesh = () => (
        <mesh geometry={meshData.solidGeo!} frustumCulled={true} castShadow={useShadows && lod <= 1} receiveShadow={useShadows}>
            <primitive object={solidMaterial} attach="material" />
        </mesh>
    );

    return (
        <group position={[cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE]}>
            {meshData.solidGeo && (
                hasPhysics ? (
                    <RigidBody key={meshData.solidGeo.uuid} type="fixed" colliders="trimesh">
                        {renderSolidMesh()}
                    </RigidBody>
                ) : renderSolidMesh()
            )}
            {meshData.waterGeo && (
                <mesh geometry={meshData.waterGeo} frustumCulled={true} renderOrder={1} receiveShadow={useShadows}>
                    <primitive object={waterMaterial} attach="material" />
                </mesh>
            )}

            {/* Dynamic Entities (Chests) */}
            {meshData.chests && meshData.chests.map(chest => (
                <AnimatedChest
                    key={`chest-${chest.x}-${chest.y}-${chest.z}`}
                    x={chest.x}
                    y={chest.y}
                    z={chest.z}
                    worldX={cx * CHUNK_SIZE + chest.x}
                    worldY={chest.y}
                    worldZ={cz * CHUNK_SIZE + chest.z}
                />
            ))}
        </group>
    );
});

Chunk.displayName = 'Chunk';
export default Chunk;
