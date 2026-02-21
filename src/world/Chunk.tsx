import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BLOCK_DATA, BlockType } from '../core/blockTypes';
import { getBlockMaterial, getAtlasTexture, getAtlasUV } from '../core/textures';
import { RigidBody } from '@react-three/rapier';
import useGameStore, { chunkKey } from '../store/gameStore';
import { CHUNK_SIZE, blockIndex, type ChunkData, MAX_HEIGHT } from '../core/terrainGen';
import { globalTerrainUniforms } from '../core/constants';
import { getWorkerPool } from '../core/workerPool';

// ─── Geometry Pool ───────────────────────────────────────
const geoPool: THREE.BufferGeometry[] = [];
const MAX_POOL = 512;

function getPooledGeo(): THREE.BufferGeometry {
    const geo = geoPool.pop() || new THREE.BufferGeometry();
    geo.uuid = THREE.MathUtils.generateUUID();
    return geo;
}

function returnToPool(geo: THREE.BufferGeometry): void {
    if (geoPool.length < MAX_POOL) {
        geo.deleteAttribute('position');
        geo.deleteAttribute('normal');
        geo.deleteAttribute('uv');
        geo.deleteAttribute('color');
        geo.deleteAttribute('isFlora');
        geo.deleteAttribute('isLiquid');
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

    const useShadows = useGameStore((s) => s.settings.graphics !== 'fast');
    const [meshData, setMeshData] = React.useState<{ solidGeo: THREE.BufferGeometry | null, waterGeo: THREE.BufferGeometry | null, atlas: THREE.Texture } | null>(null);

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
                const result = await pool.submitMesh(cx, cz, chunkData, [nPx, nNx, nPz, nNz], lod);
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
                    g.computeBoundingSphere();
                    return g;
                };

                const solidGeo = createGeo(result.solid);
                const waterGeo = createGeo(result.water);

                setMeshData({ solidGeo, waterGeo, atlas });
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

    if (!meshData) return null;

    const renderSolidMesh = () => (
        <mesh geometry={meshData.solidGeo!} frustumCulled castShadow={useShadows && lod <= 1} receiveShadow={useShadows}>
            <meshStandardMaterial
                map={meshData.atlas}
                vertexColors
                alphaTest={0.5}
                alphaToCoverage={true}
                transparent={false}
                roughness={0.9}
                metalness={0.05}
                onBeforeCompile={(shader) => {
                    shader.uniforms.uTime = globalTerrainUniforms.uTime;
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
                        varying float vShade;
                        `
                    );

                    // Add displacement and directional shading math
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

                        // Minecraft-like directional shading + Top Highlight
                        vShade = 1.0;
                        if (normal.y > 0.5) {
                           vShade = 1.05; // Slightly brighter top
                        } else if (normal.y < -0.5) {
                           vShade = 0.5; // Darker bottom
                        } else if (abs(normal.z) > 0.5) {
                           vShade = 0.8; // North/South
                        } else if (abs(normal.x) > 0.5) {
                           vShade = 0.6; // East/West
                        }
                        `
                    );

                    shader.fragmentShader = shader.fragmentShader.replace(
                        '#include <common>',
                        `
                        #include <common>
                        varying float vShade;
                        `
                    );

                    shader.fragmentShader = shader.fragmentShader.replace(
                        '#include <color_fragment>',
                        `
                         #include <color_fragment>
                         diffuseColor.rgb *= vShade;
                         diffuseColor.rgb = pow(diffuseColor.rgb, vec3(1.05)); // Subtle contrast punch
                         `
                    );
                }}
            />
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
                            shader.uniforms.uTime = globalTerrainUniforms.uTime;
                            shader.uniforms.uChunkOffset = { value: new THREE.Vector2(cx * CHUNK_SIZE, cz * CHUNK_SIZE) };
                            shader.vertexShader = shader.vertexShader.replace(
                                '#include <common>',
                                `
                                #include <common>
                                attribute float isLiquid;
                                uniform float uTime;
                                uniform vec2 uChunkOffset;
                                varying float vShade;
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

                                // Minecraft-like directional shading for water
                                vShade = 1.0;
                                if (normal.y > 0.5) {
                                   vShade = 1.0;
                                } else if (normal.y < -0.5) {
                                   vShade = 0.6;
                                } else if (abs(normal.z) > 0.5) {
                                   vShade = 0.85;
                                } else if (abs(normal.x) > 0.5) {
                                   vShade = 0.75;
                                }
                                `
                            );

                            shader.fragmentShader = shader.fragmentShader.replace(
                                '#include <common>',
                                `
                                #include <common>
                                varying float vShade;
                                `
                            );

                            shader.fragmentShader = shader.fragmentShader.replace(
                                '#include <color_fragment>',
                                `
                                #include <color_fragment>
                                diffuseColor.rgb *= vShade;
                                // Add a subtle water-like shimmer
                                diffuseColor.rgb += vec3(0.02, 0.04, 0.08) * vShade;
                                `
                            );
                        }}
                    />
                </mesh>
            )}
        </group>
    );
});

Chunk.displayName = 'Chunk';
export default Chunk;
