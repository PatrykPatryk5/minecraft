import React, { useEffect, useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import useGameStore, { chunkKey } from '../store/gameStore';
import { BlockType } from '../core/blockTypes';
import * as THREE from 'three';

const MAX_LIGHTS = 16; // Limit PointLights for performance
const SCAN_RADIUS = 3; // Increased to see lights further away
const SCAN_INTERVAL_MS = 1000; // Scan once per second

interface LightSource {
    x: number;
    y: number;
    z: number;
    color: string;
    intensity: number;
    distSq: number;
    isCampfire: boolean;
}

const TorchLights: React.FC = () => {
    const [lights, setLights] = useState<LightSource[]>([]);
    const lastScanTime = useRef(0);
    const cameraPos = useRef(new THREE.Vector3());

    useFrame((state) => {
        cameraPos.current.copy(state.camera.position);

        const now = performance.now();
        if (now - lastScanTime.current > SCAN_INTERVAL_MS) {
            lastScanTime.current = now;
            scanForLights();
        }
    });

    const scanForLights = () => {
        const store = useGameStore.getState();
        const px = Math.floor(cameraPos.current.x);
        const py = Math.floor(cameraPos.current.y);
        const pz = Math.floor(cameraPos.current.z);

        const pcx = Math.floor(px / 16);
        const pcz = Math.floor(pz / 16);

        const foundLights: LightSource[] = [];

        // Use the store's tracked light sources for extreme efficiency
        for (let dx = -SCAN_RADIUS; dx <= SCAN_RADIUS; dx++) {
            for (let dz = -SCAN_RADIUS; dz <= SCAN_RADIUS; dz++) {
                const cx = pcx + dx;
                const cz = pcz + dz;
                const key = chunkKey(cx, cz);
                const chunk = store.chunks[key];
                const lightIndices = store.lightSources[key];

                if (!chunk || !lightIndices || lightIndices.length === 0) continue;

                for (const idx of lightIndices) {
                    const block = chunk[idx];

                    // Recover coordinates from index
                    const y = idx >> 8;
                    const lz = (idx >> 4) & 0x0F;
                    const lx = idx & 0x0F;

                    const wx = cx * 16 + lx;
                    const wz = cz * 16 + lz;
                    const distSq = (wx - px) ** 2 + (y - py) ** 2 + (wz - pz) ** 2;

                    // Skip lights that are too far
                    if (distSq > (SCAN_RADIUS * 16) ** 2) continue;

                    const isRedstone = block === BlockType.REDSTONE_TORCH || block === BlockType.REDSTONE_LAMP;
                    const isSoul = block === BlockType.SOUL_TORCH || block === BlockType.SOUL_LANTERN;
                    const isLava = block === BlockType.LAVA;
                    const isCampfire = block === BlockType.CAMPFIRE;

                    foundLights.push({
                        x: wx + 0.5,
                        y: y + 0.5,
                        z: wz + 0.5,
                        color: isRedstone ? '#ff3300' : isSoul ? '#11ccff' : isLava ? '#ff6600' : '#ffdd88',
                        intensity: (block === BlockType.TORCH || block === BlockType.LANTERN || block === BlockType.GLOWSTONE || isLava || isCampfire) ? 1.8 : 1.2,
                        distSq,
                        isCampfire
                    });
                }
            }
        }

        // Sort by distance and take the closest M
        foundLights.sort((a, b) => a.distSq - b.distSq);
        const topLights = foundLights.slice(0, MAX_LIGHTS);

        // Update state if changed
        setLights(prev => {
            if (prev.length !== topLights.length) return topLights;
            for (let i = 0; i < prev.length; i++) {
                if (prev[i].x !== topLights[i].x || prev[i].y !== topLights[i].y || prev[i].z !== topLights[i].z) {
                    return topLights;
                }
            }
            return prev;
        });
    };

    return (
        <group>
            {lights.map((l, i) => {
                // Generate pseudo-random offset based on position to desync flicker
                const offset = (l.x * 12.5 + l.y * 3.1 + l.z * 7.8) % 100;
                return (
                    <FlickeringLight
                        key={`${l.x},${l.y},${l.z}`}
                        l={l}
                        offset={offset}
                    />
                );
            })}
        </group>
    );
};

interface FlickeringLightProps {
    l: LightSource;
    offset: number;
}

const FlickeringLight: React.FC<FlickeringLightProps> = ({ l, offset }) => {
    const lightRef = useRef<THREE.PointLight>(null);

    useFrame((state, delta) => {
        if (!lightRef.current) return;
        const t = state.clock.elapsedTime * 4 + offset;
        // Subtle, chaotic flicker using sine wave combination
        const flicker = Math.sin(t) * 0.05 + Math.sin(t * 2.3) * 0.03 + Math.sin(t * 4.1) * 0.02;
        lightRef.current.intensity = Math.max(0.1, (l.intensity * 1.2) + flicker);

        if (l.isCampfire && Math.random() < delta * 15) {
            import('../core/particles').then(({ emitSmoke }) => {
                emitSmoke(l.x, l.y, l.z, 1);
            });
        }
    });

    return (
        <pointLight
            ref={lightRef}
            position={[l.x, l.y, l.z]}
            color={l.color}
            intensity={l.intensity * 1.2}
            distance={l.intensity > 1 ? 20 : 12}
            decay={1}
        />
    );
};

export default TorchLights;
