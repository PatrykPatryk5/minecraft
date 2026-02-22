import React, { useEffect, useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import useGameStore, { chunkKey } from '../store/gameStore';
import { BlockType } from '../core/blockTypes';
import * as THREE from 'three';

const MAX_LIGHTS = 16; // Limit PointLights for performance
const SCAN_RADIUS = 2; // Chunks around player
const SCAN_INTERVAL_MS = 1000; // Scan once per second

interface LightSource {
    x: number;
    y: number;
    z: number;
    color: string;
    intensity: number;
    distSq: number;
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

        // Scan nearby chunks
        for (let dx = -SCAN_RADIUS; dx <= SCAN_RADIUS; dx++) {
            for (let dz = -SCAN_RADIUS; dz <= SCAN_RADIUS; dz++) {
                const cx = pcx + dx;
                const cz = pcz + dz;
                const key = chunkKey(cx, cz);
                const chunk = store.chunks[key];

                if (!chunk) continue;

                // Extremely fast native C++ array cull
                const lightSourceIds = [
                    BlockType.TORCH, BlockType.REDSTONE_TORCH, BlockType.GLOWSTONE,
                    BlockType.LANTERN, BlockType.SOUL_LANTERN, BlockType.SOUL_TORCH,
                    BlockType.SEA_LANTERN, BlockType.OCHRE_FROGLIGHT, BlockType.VERDANT_FROGLIGHT,
                    BlockType.PEARLESCENT_FROGLIGHT, BlockType.BEACON, BlockType.REDSTONE_LAMP
                ];
                if (!lightSourceIds.some(id => chunk.includes(id))) continue;

                // Restrict Y range to save scanning time: scan around player's Y ± 32
                const minY = Math.max(0, py - 32);
                const maxY = Math.min(255, py + 32);

                for (let y = minY; y <= maxY; y++) {
                    for (let lx = 0; lx < 16; lx++) {
                        for (let lz = 0; lz < 16; lz++) {
                            const idx = lx + y * 16 + lz * 256; // Fast blockIndex
                            const block = chunk[idx];

                            if (lightSourceIds.includes(block)) {
                                const wx = cx * 16 + lx;
                                const wz = cz * 16 + lz;
                                const distSq = (wx - px) ** 2 + (y - py) ** 2 + (wz - pz) ** 2;

                                const isRedstone = block === BlockType.REDSTONE_TORCH || block === BlockType.REDSTONE_LAMP;
                                const isSoul = block === BlockType.SOUL_TORCH || block === BlockType.SOUL_LANTERN;

                                foundLights.push({
                                    x: wx + 0.5,
                                    y: y + 0.5,
                                    z: wz + 0.5,
                                    color: isRedstone ? '#ff3300' : isSoul ? '#00ccff' : '#ffdd88',
                                    intensity: (block === BlockType.TORCH || block === BlockType.LANTERN || block === BlockType.GLOWSTONE) ? 1.5 : 1.0,
                                    distSq
                                });
                            }
                        }
                    }
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
            return prev; // Same lights
        });
    };

    return (
        <group>
            {lights.map((l, i) => (
                <pointLight
                    key={`${l.x},${l.y},${l.z}`}
                    position={[l.x, l.y, l.z]}
                    color={l.color}
                    intensity={l.intensity}
                    distance={l.intensity > 1 ? 14 : 8}
                    decay={2}
                />
            ))}
        </group>
    );
};

export default TorchLights;
