/**
 * Animated Water & Lava Surfaces
 *
 * Renders water and lava with animated waves.
 * Uses MeshStandardMaterial (WebGPU-compatible) instead of raw GLSL ShaderMaterial.
 * Wave animation is driven per-frame via vertex position attribute updates.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore, { chunkKey } from '../store/gameStore';
import { BlockType } from '../core/blockTypes';
import { CHUNK_SIZE, SEA_LEVEL, blockIndex, MAX_HEIGHT } from '../core/terrainGen';

/** Shared, reusable water material — transparent blue */
const waterMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.15, 0.3, 0.6),
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
    roughness: 0.2,
    metalness: 0.1,
});

/** Shared, reusable lava material — emissive orange */
const lavaMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.8, 0.33, 0.04),
    emissive: new THREE.Color(0.6, 0.15, 0.02),
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthWrite: false,
    roughness: 0.9,
    metalness: 0,
});

const WaterSurface: React.FC = () => {
    const waterMeshRef = useRef<THREE.Mesh>(null);
    const lavaMeshRef = useRef<THREE.Mesh>(null);
    const renderDistance = useGameStore((s) => s.renderDistance);
    const timeRef = useRef(0);

    useFrame((_, delta) => {
        timeRef.current += delta;
        const t = timeRef.current;

        // Animate water vertex positions (wave effect)
        if (waterMeshRef.current) {
            const geo = waterMeshRef.current.geometry;
            const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
            const baseY = geo.userData.baseY as Float32Array | undefined;
            if (posAttr && baseY) {
                const arr = posAttr.array as Float32Array;
                for (let i = 0; i < posAttr.count; i++) {
                    const x = arr[i * 3];
                    const z = arr[i * 3 + 2];
                    const wave = Math.sin(x * 2.0 + t * 1.5) * 0.04 +
                                 Math.cos(z * 2.0 + t * 1.2) * 0.03;
                    arr[i * 3 + 1] = baseY[i] + wave;
                }
                posAttr.needsUpdate = true;
            }
        }

        // Animate lava vertex positions (slower, viscous waves)
        if (lavaMeshRef.current) {
            const geo = lavaMeshRef.current.geometry;
            const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
            const baseY = geo.userData.baseY as Float32Array | undefined;
            if (posAttr && baseY) {
                const arr = posAttr.array as Float32Array;
                for (let i = 0; i < posAttr.count; i++) {
                    const x = arr[i * 3];
                    const z = arr[i * 3 + 2];
                    const wave = Math.sin(x * 1.2 + t * 0.5) * 0.02 +
                                 Math.cos(z * 1.0 + t * 0.4) * 0.015;
                    arr[i * 3 + 1] = baseY[i] + wave;
                }
                posAttr.needsUpdate = true;
            }
            // Animate lava emissive pulsing
            const pulse = Math.sin(t * 0.8) * 0.15 + 0.65;
            lavaMaterial.emissiveIntensity = pulse;
        }
    });

    // Track global chunk version to trigger updates
    const chunkVersionSum = useGameStore(s => Object.values(s.chunkVersions).reduce((a, b) => a + b, 0));

    // Build water geometry — scan for water blocks at any Y level
    const waterGeo = useMemo(() => {
        const state = useGameStore.getState();
        const pp = state.playerPos;
        const pcx = Math.floor(pp[0] / CHUNK_SIZE), pcz = Math.floor(pp[2] / CHUNK_SIZE);
        const rd = state.renderDistance;
        const pos: number[] = [], uv: number[] = [], idx: number[] = [];
        const waterY = new Set<string>(); // track unique positions

        for (let dx = -rd; dx <= rd; dx++) for (let dz = -rd; dz <= rd; dz++) {
            if (dx * dx + dz * dz > rd * rd) continue;
            const cx = pcx + dx, cz = pcz + dz;
            const chunk = state.chunks[chunkKey(cx, cz)];
            if (!chunk) continue;

            for (let lx = 0; lx < CHUNK_SIZE; lx++) for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                // Scan FULL height for water (up to MAX_HEIGHT)
                // Optimization: Start from top down could be faster for surface finding, 
                // but water can be underground too.
                for (let ly = MAX_HEIGHT - 1; ly >= 1; ly--) {
                    const bt = chunk[blockIndex(lx, ly, lz)];
                    if (bt === BlockType.WATER) {
                        // Check above
                        const above = ly < MAX_HEIGHT - 1 ? chunk[blockIndex(lx, ly + 1, lz)] : 0;
                        if (above === BlockType.AIR || above === 0 || above === undefined) {
                            const wx = cx * CHUNK_SIZE + lx, wz = cz * CHUNK_SIZE + lz;
                            // Visual height: 0.9 (standard Minecraft water level)
                            const wy = ly + 0.9;

                            const key = `${wx},${ly},${wz}`;
                            if (waterY.has(key)) continue;
                            waterY.add(key);

                            const vo = pos.length / 3;
                            pos.push(wx, wy, wz, wx + 1, wy, wz,
                                wx + 1, wy, wz + 1, wx, wy, wz + 1);
                            uv.push(0, 0, 1, 0, 1, 1, 0, 1);
                            idx.push(vo, vo + 1, vo + 2, vo, vo + 2, vo + 3);
                        }
                    }
                }
            }
        }
        const geo = new THREE.BufferGeometry();
        if (pos.length > 0) {
            geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
            geo.setIndex(idx);
            // Store original Y values for wave animation baseline
            const posArr = geo.getAttribute('position').array as Float32Array;
            const baseY = new Float32Array(posArr.length / 3);
            for (let i = 0; i < baseY.length; i++) baseY[i] = posArr[i * 3 + 1];
            geo.userData.baseY = baseY;
        }
        return geo;
    }, [renderDistance, chunkVersionSum]);

    // Build lava geometry — scan for lava blocks at any Y level
    const lavaGeo = useMemo(() => {
        const state = useGameStore.getState();
        const pp = state.playerPos;
        const pcx = Math.floor(pp[0] / CHUNK_SIZE), pcz = Math.floor(pp[2] / CHUNK_SIZE);
        const rd = state.renderDistance;
        const pos: number[] = [], uv: number[] = [], idx: number[] = [];
        const lavaY = new Set<string>(); // track unique positions

        for (let dx = -rd; dx <= rd; dx++) for (let dz = -rd; dz <= rd; dz++) {
            if (dx * dx + dz * dz > rd * rd) continue;
            const cx = pcx + dx, cz = pcz + dz;
            const chunk = state.chunks[chunkKey(cx, cz)];
            if (!chunk) continue;
            for (let lx = 0; lx < CHUNK_SIZE; lx++) for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                for (let ly = 1; ly < Math.min(MAX_HEIGHT, 64); ly++) {
                    if (chunk[blockIndex(lx, ly, lz)] === BlockType.LAVA) {
                        // Only render top face if above is air
                        const above = ly < MAX_HEIGHT - 1 ? chunk[blockIndex(lx, ly + 1, lz)] : 0;
                        if (above === BlockType.AIR || above === 0) {
                            const wx = cx * CHUNK_SIZE + lx, wz = cz * CHUNK_SIZE + lz;
                            const key = `${wx},${ly},${wz}`;
                            if (lavaY.has(key)) continue;
                            lavaY.add(key);
                            const vo = pos.length / 3;
                            pos.push(wx, ly + 0.85, wz, wx + 1, ly + 0.85, wz,
                                wx + 1, ly + 0.85, wz + 1, wx, ly + 0.85, wz + 1);
                            uv.push(0, 0, 1, 0, 1, 1, 0, 1);
                            idx.push(vo, vo + 1, vo + 2, vo, vo + 2, vo + 3);
                        }
                    }
                }
            }
        }
        const geo = new THREE.BufferGeometry();
        if (pos.length > 0) {
            geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
            geo.setIndex(idx);
            // Store original Y values for wave animation baseline
            const posArr = geo.getAttribute('position').array as Float32Array;
            const baseY = new Float32Array(posArr.length / 3);
            for (let i = 0; i < baseY.length; i++) baseY[i] = posArr[i * 3 + 1];
            geo.userData.baseY = baseY;
        }
        return geo;
    }, [renderDistance]);

    return (
        <>
            <mesh ref={waterMeshRef} geometry={waterGeo} material={waterMaterial} />
            <mesh ref={lavaMeshRef} geometry={lavaGeo} material={lavaMaterial} />
        </>
    );
};

export default WaterSurface;
