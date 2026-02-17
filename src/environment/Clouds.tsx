/**
 * Clouds (Optimized — InstancedMesh)
 *
 * Uses a single InstancedMesh instead of 30 separate meshes.
 * Reduces draw calls from 30 to 1.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';

const CLOUD_HEIGHT = 128;
const CLOUD_COUNT = 25;
const CLOUD_SPREAD = 300;

const _dummy = new THREE.Object3D();

const Clouds: React.FC = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const windOffset = useRef(0);

    // Generate cloud transforms once
    const cloudData = useMemo(() => {
        const data: { pos: [number, number, number]; scale: [number, number, number] }[] = [];
        for (let i = 0; i < CLOUD_COUNT; i++) {
            data.push({
                pos: [
                    (Math.random() - 0.5) * CLOUD_SPREAD,
                    CLOUD_HEIGHT + Math.random() * 10,
                    (Math.random() - 0.5) * CLOUD_SPREAD,
                ],
                scale: [
                    4 + Math.random() * 12,
                    1 + Math.random() * 2,
                    4 + Math.random() * 8,
                ],
            });
        }
        return data;
    }, []);

    const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
    const material = useMemo(() => new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
    }), []);

    // Update instanced transforms each frame + wind
    useFrame((_, delta) => {
        if (!meshRef.current) return;

        windOffset.current += delta * 2;
        if (windOffset.current > CLOUD_SPREAD / 2) windOffset.current = -CLOUD_SPREAD / 2;

        const playerPos = useGameStore.getState().playerPos;

        for (let i = 0; i < CLOUD_COUNT; i++) {
            const c = cloudData[i];
            _dummy.position.set(
                c.pos[0] + windOffset.current,
                c.pos[1],
                c.pos[2] + playerPos[2],
            );
            _dummy.scale.set(c.scale[0], c.scale[1], c.scale[2]);
            _dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, _dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[geometry, material, CLOUD_COUNT]} frustumCulled={false} />
    );
};

export default Clouds;
