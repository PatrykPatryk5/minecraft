import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';
import { playSound } from '../audio/sounds';

interface AnimatedChestProps {
    x: number;
    y: number;
    z: number;
    worldX: number;
    worldY: number;
    worldZ: number;
}

export const AnimatedChest: React.FC<AnimatedChestProps> = ({ x, y, z, worldX, worldY, worldZ }) => {
    const isOpen = useGameStore(s => s.chests[`${worldX},${worldY},${worldZ}`]?.isOpen || false);
    const lidRef = useRef<THREE.Group>(null);
    const targetAngle = isOpen ? -Math.PI / 2.5 : 0; // Lid opens ~70 degrees
    const currentAngle = useRef(0);

    // Play sound on state change
    useEffect(() => {
        if (isOpen) {
            playSound('open');
        } else {
            playSound('close');
        }
    }, [isOpen]);

    useFrame((_, delta) => {
        if (!lidRef.current) return;

        // Smoothly interpolate the lid angle
        currentAngle.current = THREE.MathUtils.damp(
            currentAngle.current,
            targetAngle,
            12, // Lambda (speed)
            Math.min(delta, 0.1)
        );

        lidRef.current.rotation.x = currentAngle.current;
    });

    return (
        <group position={[x + 0.5, y, z + 0.5]}>
            {/* Chest Base */}
            <mesh position={[0, 0.25, 0]}>
                <boxGeometry args={[0.875, 0.5, 0.875]} />
                {/* You can map standard texture coordinates here, for now using basic colors to match standard texture gen */}
                <meshStandardMaterial color="#6a4a2a" roughness={1} />
            </mesh>

            {/* Chest Lid (Hinged at the back) */}
            <group position={[0, 0.5, -0.4375]} ref={lidRef}>
                <mesh position={[0, 0.25, 0.4375]}>
                    <boxGeometry args={[0.875, 0.3, 0.875]} />
                    <meshStandardMaterial color="#8a5a2a" roughness={1} />
                </mesh>

                {/* Metal Lock */}
                <mesh position={[0, 0.15, 0.875 - 0.05]}>
                    <boxGeometry args={[0.125, 0.25, 0.0625]} />
                    <meshStandardMaterial color="#aaa" metalness={0.8} />
                </mesh>
            </group>
        </group>
    );
};
