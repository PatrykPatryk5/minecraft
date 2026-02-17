/**
 * Animated Water Surface
 * 
 * Renders visible water chunks with an animated wave shader
 * for a more realistic Minecraft water effect.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore, { chunkKey, blockKey } from '../store/gameStore';
import { BlockType } from '../core/blockTypes';
import { CHUNK_SIZE, SEA_LEVEL } from '../core/terrainGen';

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
    
    // Sparkle effect
    float sparkle = sin(vUv.x * 40.0 + uTime * 3.0) * cos(vUv.y * 40.0 + uTime * 2.5);
    color += vec3(max(0.0, sparkle) * 0.15);
    
    gl_FragColor = vec4(color, alpha);
  }
`;

const WaterSurface: React.FC = () => {
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const renderDistance = useGameStore((s) => s.renderDistance);

    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
    }), []);

    useFrame((_, delta) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value += delta;
        }
    });

    // Build water plane geometry based on loaded chunks
    const geometry = useMemo(() => {
        const state = useGameStore.getState();
        const playerPos = state.playerPos;
        const pcx = Math.floor(playerPos[0] / CHUNK_SIZE);
        const pcz = Math.floor(playerPos[2] / CHUNK_SIZE);
        const rd = state.renderDistance;

        const positions: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];

        for (let dx = -rd; dx <= rd; dx++) {
            for (let dz = -rd; dz <= rd; dz++) {
                if (dx * dx + dz * dz > rd * rd) continue;
                const cx = pcx + dx;
                const cz = pcz + dz;
                const key = chunkKey(cx, cz);
                const chunk = state.chunks[key];
                if (!chunk) continue;

                // Check if chunk has any water at sea level
                let hasWater = false;
                for (let lx = 0; lx < CHUNK_SIZE; lx += 4) {
                    for (let lz = 0; lz < CHUNK_SIZE; lz += 4) {
                        if (chunk[blockKey(lx, SEA_LEVEL, lz)] === BlockType.WATER) {
                            hasWater = true;
                            break;
                        }
                    }
                    if (hasWater) break;
                }

                if (hasWater) {
                    const wx = cx * CHUNK_SIZE;
                    const wz = cz * CHUNK_SIZE;
                    const vo = positions.length / 3;

                    positions.push(wx, SEA_LEVEL + 0.9, wz);
                    positions.push(wx + CHUNK_SIZE, SEA_LEVEL + 0.9, wz);
                    positions.push(wx + CHUNK_SIZE, SEA_LEVEL + 0.9, wz + CHUNK_SIZE);
                    positions.push(wx, SEA_LEVEL + 0.9, wz + CHUNK_SIZE);

                    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
                    indices.push(vo, vo + 1, vo + 2, vo, vo + 2, vo + 3);
                }
            }
        }

        const geo = new THREE.BufferGeometry();
        if (positions.length > 0) {
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            geo.setIndex(indices);
        }
        return geo;
        // Rebuild when render distance changes
    }, [renderDistance]);

    return (
        <mesh geometry={geometry}>
            <shaderMaterial
                ref={materialRef}
                vertexShader={waterVertexShader}
                fragmentShader={waterFragmentShader}
                uniforms={uniforms}
                transparent
                side={THREE.DoubleSide}
                depthWrite={false}
            />
        </mesh>
    );
};

export default WaterSurface;
