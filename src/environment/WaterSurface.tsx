/**
 * Animated Water & Lava Surfaces
 *
 * Renders water and lava with animated wave shaders.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore, { chunkKey } from '../store/gameStore';
import { BlockType } from '../core/blockTypes';
import { CHUNK_SIZE, SEA_LEVEL, blockIndex, MAX_HEIGHT } from '../core/terrainGen';

const waterVertexShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vWave;
  void main() {
    vUv = uv;
    vec3 pos = position;
    vWave = sin(pos.x * 2.0 + uTime * 1.5) * 0.04 +
            cos(pos.z * 2.0 + uTime * 1.2) * 0.03;
    pos.y += vWave;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const waterFragmentShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vWave;
  void main() {
    float alpha = 0.55 + vWave * 2.0;
    vec3 deepBlue = vec3(0.1, 0.2, 0.5);
    vec3 lightBlue = vec3(0.2, 0.4, 0.7);
    vec3 color = mix(deepBlue, lightBlue, vWave * 5.0 + 0.5);
    float sparkle = sin(vUv.x * 40.0 + uTime * 3.0) * cos(vUv.y * 40.0 + uTime * 2.5);
    color += vec3(max(0.0, sparkle) * 0.15);
    gl_FragColor = vec4(color, alpha);
  }
`;

// Lava shaders — slower, more viscous, glowing
const lavaVertexShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vWave;
  void main() {
    vUv = uv;
    vec3 pos = position;
    vWave = sin(pos.x * 1.2 + uTime * 0.5) * 0.02 +
            cos(pos.z * 1.0 + uTime * 0.4) * 0.015;
    pos.y += vWave;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const lavaFragmentShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vWave;
  void main() {
    vec3 darkLava = vec3(0.6, 0.15, 0.02);
    vec3 brightLava = vec3(1.0, 0.5, 0.05);
    float pulse = sin(uTime * 0.8 + vUv.x * 5.0) * 0.5 + 0.5;
    vec3 color = mix(darkLava, brightLava, pulse * 0.6 + vWave * 3.0);
    // Hot spots
    float hot = sin(vUv.x * 20.0 + uTime * 1.5) * cos(vUv.y * 20.0 + uTime * 1.2);
    color += vec3(max(0.0, hot) * 0.25, max(0.0, hot) * 0.1, 0.0);
    gl_FragColor = vec4(color, 0.95);
  }
`;

const WaterSurface: React.FC = () => {
    const waterMatRef = useRef<THREE.ShaderMaterial>(null);
    const lavaMatRef = useRef<THREE.ShaderMaterial>(null);
    const renderDistance = useGameStore((s) => s.renderDistance);

    const waterUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
    const lavaUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

    useFrame((_, delta) => {
        if (waterMatRef.current) waterMatRef.current.uniforms.uTime.value += delta;
        if (lavaMatRef.current) lavaMatRef.current.uniforms.uTime.value += delta;
    });

    // Build water geometry
    const waterGeo = useMemo(() => {
        const state = useGameStore.getState();
        const pp = state.playerPos;
        const pcx = Math.floor(pp[0] / CHUNK_SIZE), pcz = Math.floor(pp[2] / CHUNK_SIZE);
        const rd = state.renderDistance;
        const pos: number[] = [], uv: number[] = [], idx: number[] = [];

        for (let dx = -rd; dx <= rd; dx++) for (let dz = -rd; dz <= rd; dz++) {
            if (dx * dx + dz * dz > rd * rd) continue;
            const cx = pcx + dx, cz = pcz + dz;
            const chunk = state.chunks[chunkKey(cx, cz)];
            if (!chunk) continue;
            let hasWater = false;
            for (let lx = 0; lx < CHUNK_SIZE; lx += 4) {
                for (let lz = 0; lz < CHUNK_SIZE; lz += 4) {
                    if (chunk[blockIndex(lx, SEA_LEVEL, lz)] === BlockType.WATER) { hasWater = true; break; }
                }
                if (hasWater) break;
            }
            if (hasWater) {
                const wx = cx * CHUNK_SIZE, wz = cz * CHUNK_SIZE;
                const vo = pos.length / 3;
                pos.push(wx, SEA_LEVEL + 0.9, wz, wx + CHUNK_SIZE, SEA_LEVEL + 0.9, wz,
                    wx + CHUNK_SIZE, SEA_LEVEL + 0.9, wz + CHUNK_SIZE, wx, SEA_LEVEL + 0.9, wz + CHUNK_SIZE);
                uv.push(0, 0, 1, 0, 1, 1, 0, 1);
                idx.push(vo, vo + 1, vo + 2, vo, vo + 2, vo + 3);
            }
        }
        const geo = new THREE.BufferGeometry();
        if (pos.length > 0) {
            geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
            geo.setIndex(idx);
        }
        return geo;
    }, [renderDistance]);

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
        }
        return geo;
    }, [renderDistance]);

    return (
        <>
            <mesh geometry={waterGeo}>
                <shaderMaterial ref={waterMatRef} vertexShader={waterVertexShader}
                    fragmentShader={waterFragmentShader} uniforms={waterUniforms}
                    transparent side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            <mesh geometry={lavaGeo}>
                <shaderMaterial ref={lavaMatRef} vertexShader={lavaVertexShader}
                    fragmentShader={lavaFragmentShader} uniforms={lavaUniforms}
                    transparent side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
        </>
    );
};

export default WaterSurface;

