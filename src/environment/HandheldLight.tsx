/**
 * HandheldLight — Dynamic light emitting from held items
 *
 * When the player holds an emissive item (torch, glowstone, lantern, etc.),
 * a PointLight follows the player position, illuminating nearby blocks.
 */

import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';
import { BlockType } from '../core/blockTypes';

// Items that emit light when held
const EMISSIVE_ITEMS: Record<number, { color: string; intensity: number; distance: number }> = {
    [BlockType.TORCH]: { color: '#ffdd88', intensity: 1.4, distance: 18 },
    [BlockType.GLOWSTONE]: { color: '#ffee55', intensity: 1.6, distance: 20 },
    [BlockType.LANTERN]: { color: '#ffdd88', intensity: 1.5, distance: 18 },
    [BlockType.SOUL_TORCH]: { color: '#11ccff', intensity: 1.2, distance: 16 },
    [BlockType.SOUL_LANTERN]: { color: '#11ccff', intensity: 1.3, distance: 16 },
    [BlockType.REDSTONE_TORCH]: { color: '#ff3300', intensity: 0.8, distance: 10 },
    [BlockType.LAVA]: { color: '#ff6600', intensity: 1.5, distance: 18 },
    [BlockType.MAGMA_BLOCK]: { color: '#ff4400', intensity: 0.6, distance: 8 },
    [BlockType.FIRE]: { color: '#ffaa22', intensity: 1.2, distance: 14 },
};

const HandheldLight: React.FC = () => {
    const lightRef = useRef<THREE.PointLight>(null);
    const currentIntensity = useRef(0);
    const { camera } = useThree();

    useFrame((_, delta) => {
        if (!lightRef.current) return;

        const s = useGameStore.getState();
        if (s.screen !== 'playing' || s.activeOverlay !== 'none') {
            lightRef.current.intensity = 0;
            return;
        }

        const held = s.getSelectedBlock();
        const emissive = held ? EMISSIVE_ITEMS[held] : null;

        // Target intensity (0 when not holding emissive item)
        const targetIntensity = emissive ? emissive.intensity : 0;

        // Smooth transition
        currentIntensity.current += (targetIntensity - currentIntensity.current) * Math.min(1, delta * 8);

        if (currentIntensity.current < 0.01) {
            lightRef.current.intensity = 0;
            lightRef.current.visible = false;
            return;
        }

        lightRef.current.visible = true;

        // Follow player camera position (slightly below and in front)
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);

        lightRef.current.position.set(
            camera.position.x + forward.x * 0.3,
            camera.position.y - 0.3,
            camera.position.z + forward.z * 0.3
        );

        // Subtle flicker for held torch
        const t = performance.now() * 0.004;
        const flicker = Math.sin(t) * 0.04 + Math.sin(t * 2.7) * 0.02 + Math.sin(t * 5.1) * 0.01;

        lightRef.current.intensity = currentIntensity.current + flicker;
        lightRef.current.color.set(emissive?.color ?? '#ffdd88');
        lightRef.current.distance = emissive?.distance ?? 16;
    });

    return (
        <pointLight
            ref={lightRef}
            intensity={0}
            distance={16}
            decay={1.5}
            color="#ffdd88"
        />
    );
};

export default HandheldLight;
