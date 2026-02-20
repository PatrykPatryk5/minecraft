/**
 * Clouds (Volumetric & Optimized)
 *
 * Generates Minecraft-style 3D blocky clouds.
 * Uses InstancedMesh and simple noise grid. Moves uniformly via Group translation.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';

const CLOUD_HEIGHT = 140;
const CLOUD_SPEED = 1.5;
const CLOUD_GRID_W = 64; // Grid size width
const CLOUD_GRID_D = 64; // Grid size depth
const CLOUD_SCALE = 10;  // Size of one cloud "voxel"
const TOTAL_WIDTH = CLOUD_GRID_W * CLOUD_SCALE;
const TOTAL_DEPTH = CLOUD_GRID_D * CLOUD_SCALE;

const _dummy = new THREE.Object3D();

function simpleNoise(x: number, z: number): number {
    return (
        Math.sin(x * 0.1) * 0.5 +
        Math.sin(z * 0.08) * 0.5 +
        Math.sin((x + z) * 0.15) * 0.25 +
        Math.sin((x - z) * 0.12) * 0.25
    );
}

const Clouds: React.FC = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const wrapRef = useRef<THREE.Group>(null);
    const windOffset = useRef(0);
    const graphics = useGameStore((s) => s.settings.graphics);
    const isVolumetric = graphics !== 'fast';
    const useShadows = graphics !== 'fast';

    const cloudData = useMemo(() => {
        const positions: [number, number, number][] = [];

        for (let x = 0; x < CLOUD_GRID_W; x++) {
            for (let z = 0; z < CLOUD_GRID_D; z++) {
                const n = simpleNoise(x, z);

                if (n > 0.45) {
                    // Base cloud layer
                    positions.push([x * CLOUD_SCALE, 0, z * CLOUD_SCALE]);

                    if (isVolumetric) {
                        // Thicker clouds in the center of the noise peak
                        if (n > 0.75) positions.push([x * CLOUD_SCALE, CLOUD_SCALE * 0.5, z * CLOUD_SCALE]);
                        if (n > 0.75) positions.push([x * CLOUD_SCALE, -CLOUD_SCALE * 0.5, z * CLOUD_SCALE]);
                        if (n > 0.95) positions.push([x * CLOUD_SCALE, CLOUD_SCALE, z * CLOUD_SCALE]);
                    }
                }
            }
        }
        return positions;
    }, [isVolumetric]);

    const instanceCount = cloudData.length;

    const geometry = useMemo(() => {
        const geo = new THREE.BoxGeometry(CLOUD_SCALE, isVolumetric ? CLOUD_SCALE * 0.5 : CLOUD_SCALE * 0.1, CLOUD_SCALE);
        return geo;
    }, [isVolumetric]);

    const material = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#ffffff', // Pure white
        emissive: '#111111', // Prevent them from being pitch black underneath
        transparent: false,
        opacity: 1.0,
        depthWrite: true,
        side: THREE.FrontSide,
        roughness: 1,
    }), [isVolumetric]);

    // Initialize matrices ONCE (must be useEffect so ref is attached)
    React.useEffect(() => {
        if (!meshRef.current) return;
        for (let i = 0; i < cloudData.length; i++) {
            const p = cloudData[i];
            _dummy.position.set(p[0] - TOTAL_WIDTH / 2, p[1], p[2] - TOTAL_DEPTH / 2);
            _dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, _dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [cloudData]);

    useFrame((_, delta) => {
        if (!wrapRef.current) return;

        windOffset.current += delta * CLOUD_SPEED;

        // Wrap around loop
        if (windOffset.current > TOTAL_WIDTH) {
            windOffset.current -= TOTAL_WIDTH;
        }

        const playerPos = useGameStore.getState().playerPos;

        // Snap the parent group to the player's general area, minus the wind wrapping offset.
        // This gives the illusion of infinite clouds without moving the instances themselves.
        const snapX = Math.floor(playerPos[0] / TOTAL_WIDTH) * TOTAL_WIDTH;
        const snapZ = Math.floor(playerPos[2] / TOTAL_DEPTH) * TOTAL_DEPTH;

        wrapRef.current.position.set(
            snapX + windOffset.current,
            CLOUD_HEIGHT,
            snapZ
        );
    });

    return (
        <group ref={wrapRef}>
            <instancedMesh
                ref={meshRef}
                args={[geometry, material, instanceCount]}
                frustumCulled={false} // Important since we translate the parent group
                castShadow={useShadows}
                receiveShadow={useShadows}
            />
        </group>
    );
};

export default Clouds;
