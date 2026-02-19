import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';

interface PlayerModelProps {
    id: string;
}

export const PlayerModel: React.FC<PlayerModelProps> = ({ id }) => {
    const group = useRef<THREE.Group>(null);
    const headRef = useRef<THREE.Mesh>(null);
    const leftArmRef = useRef<THREE.Group>(null);
    const rightArmRef = useRef<THREE.Group>(null);
    const leftLegRef = useRef<THREE.Group>(null);
    const rightLegRef = useRef<THREE.Group>(null);

    const prevPos = useRef(new THREE.Vector3());
    const currentPos = useRef(new THREE.Vector3());
    const walkTime = useRef(0);

    // Initial positioning
    useFrame((_, delta) => {
        const state = useGameStore.getState();
        const playerState = state.connectedPlayers[id];

        // Hide if they are not in the same dimension
        if (!playerState || playerState.dimension !== state.dimension) {
            if (group.current) group.current.visible = false;
            return;
        } else if (group.current) {
            group.current.visible = true;
        }

        const [tx, ty, tz] = playerState.pos;
        const [ryw, rxp] = playerState.rot || [0, 0];

        // Smooth position interpolation
        const targetPos = new THREE.Vector3(tx, ty - 1.5, tz); // Adjusted height so feet at ground

        // How far are we from target?
        const distToTarget = currentPos.current.distanceTo(targetPos);

        // If we are extremely far (e.g. initial spawn teleport), snap immediately
        if (distToTarget > 10) {
            currentPos.current.copy(targetPos);
        } else {
            // LERPing the position continuously
            currentPos.current.lerp(targetPos, 0.4);
        }

        // Handle walk animation based on distance moved THIS frame
        const moveDist = prevPos.current.distanceTo(currentPos.current);
        if (moveDist > 0.01) {
            walkTime.current += moveDist * 10; // Animation speed
        } else {
            walkTime.current *= 0.8; // Idle decay
        }
        prevPos.current.copy(currentPos.current);

        if (group.current) {
            group.current.position.copy(currentPos.current);
            // Face the player's yaw
            group.current.rotation.y = ryw;

            // Head pitch
            if (headRef.current) {
                headRef.current.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rxp));
            }

            // Limb swing animations
            const swingX = Math.sin(walkTime.current) * 0.8;

            if (leftArmRef.current) leftArmRef.current.rotation.x = -swingX;
            if (rightArmRef.current) rightArmRef.current.rotation.x = swingX;
            if (leftLegRef.current) leftLegRef.current.rotation.x = swingX;
            if (rightLegRef.current) rightLegRef.current.rotation.x = -swingX;
        }
    });

    const playerName = useGameStore(s => s.connectedPlayers[id]?.name || 'Unknown');

    // Materials - Steve style colors
    const materialSkin = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffccaa' }), []); // Skin
    const materialShirt = useMemo(() => new THREE.MeshStandardMaterial({ color: '#00aaaa' }), []); // Teal shirt
    const materialPants = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4444bb' }), []); // Blue pants
    const materialShoes = useMemo(() => new THREE.MeshStandardMaterial({ color: '#555555' }), []); // Gray shoes

    return (
        <group ref={group}>
            {/* Name Tag */}
            <Text
                position={[0, 2.2, 0]}
                fontSize={0.25}
                color="white"
                outlineWidth={0.02}
                outlineColor="black"
                anchorX="center"
                anchorY="middle"
            >
                {playerName}
            </Text>

            {/* Head: 8x8x8 px */}
            <mesh ref={headRef} position={[0, 1.75, 0]} castShadow>
                <boxGeometry args={[0.5, 0.5, 0.5]} />
                <primitive object={materialSkin} attach="material" />
            </mesh>

            {/* Body: 8x12x4 px */}
            <mesh position={[0, 1.125, 0]} castShadow>
                <boxGeometry args={[0.5, 0.75, 0.25]} />
                <primitive object={materialShirt} attach="material" />
            </mesh>

            {/* Left Arm: 4x12x4 px */}
            <group ref={leftArmRef} position={[0.375, 1.5, 0]}>
                <mesh position={[0, -0.375, 0]} castShadow>
                    <boxGeometry args={[0.25, 0.75, 0.25]} />
                    {/* Top half shirt, bottom half skin */}
                    <primitive object={materialSkin} attach="material" />
                </mesh>
            </group>

            {/* Right Arm: 4x12x4 px */}
            <group ref={rightArmRef} position={[-0.375, 1.5, 0]}>
                <mesh position={[0, -0.375, 0]} castShadow>
                    <boxGeometry args={[0.25, 0.75, 0.25]} />
                    <primitive object={materialSkin} attach="material" />
                </mesh>
            </group>

            {/* Left Leg: 4x12x4 px */}
            <group ref={leftLegRef} position={[0.125, 0.75, 0]}>
                <mesh position={[0, -0.375, 0]} castShadow>
                    <boxGeometry args={[0.25, 0.75, 0.25]} />
                    <primitive object={materialPants} attach="material" />
                </mesh>
            </group>

            {/* Right Leg: 4x12x4 px */}
            <group ref={rightLegRef} position={[-0.125, 0.75, 0]}>
                <mesh position={[0, -0.375, 0]} castShadow>
                    <boxGeometry args={[0.25, 0.75, 0.25]} />
                    <primitive object={materialPants} attach="material" />
                </mesh>
            </group>
        </group>
    );
};
