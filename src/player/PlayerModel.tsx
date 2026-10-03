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
    const hasPreviousPos = useRef(false);
    const lastUpdate = useRef(0);
    const targetPos = useRef(new THREE.Vector3());
    const posBuffer = useRef<{ pos: [number, number, number], rot: [number, number], ts: number }[]>([]);
    const BUFFER_TIME = 80;

    // Initial positioning
    useFrame((_, delta) => {
        const state = useGameStore.getState();
        const playerState = state.connectedPlayers[id];

        // Hide if they are not in the same dimension
        if (!playerState) {
            if (group.current) group.current.visible = false;
            hasPreviousPos.current = false;
            return;
        }

        const isMatch = !playerState.dimension || playerState.dimension === state.dimension;
        if (!isMatch) {
            if (group.current) group.current.visible = false;
            hasPreviousPos.current = false;
            return;
        } else if (group.current) {
            group.current.visible = true;
        }

        // Buffer incoming state
        const now = performance.now();
        const receivedAt = playerState.receivedAt;
        const hasNewPos = receivedAt !== undefined && receivedAt > lastUpdate.current;

        if (hasNewPos) {
            posBuffer.current.push({
                pos: playerState.pos,
                rot: playerState.rot || [0, 0],
                ts: receivedAt
            });
            lastUpdate.current = receivedAt;
            // Keep buffer small (max 20 entries)
            if (posBuffer.current.length > 20) posBuffer.current.shift();
        }

        // Use this machine's monotonic receive clock. Peer machines may have
        // unrelated wall clocks, so sender timestamps cannot safely drive P2P
        // interpolation without a per-peer clock synchronization exchange.
        const renderTime = now - BUFFER_TIME;

        targetPos.current.set(...playerState.pos);
        let targetRot = playerState.rot || [0, 0];

        const samples = posBuffer.current;
        if (samples.length >= 2) {
            const oldest = samples[0];
            const newest = samples[samples.length - 1];
            if (renderTime <= oldest.ts) {
                targetPos.current.set(...oldest.pos);
                targetRot = oldest.rot;
            } else {
                let upperIndex = 1;
                while (upperIndex < samples.length - 1 && samples[upperIndex].ts < renderTime) upperIndex++;

                const extrapolating = renderTime > newest.ts;
                const p1 = extrapolating ? samples[samples.length - 2] : samples[upperIndex - 1];
                const p2 = extrapolating ? newest : samples[upperIndex];
                const sampleSpan = p2.ts - p1.ts;
                if (sampleSpan > 0) {
                    const dx = p1.pos[0] - p2.pos[0];
                    const dy = p1.pos[1] - p2.pos[1];
                    const dz = p1.pos[2] - p2.pos[2];
                    const teleported = dx * dx + dy * dy + dz * dz > 100;
                    const extra = extrapolating ? Math.min(75, renderTime - newest.ts) / sampleSpan : 0;
                    const alpha = teleported ? 1 : extrapolating ? 1 + extra : (renderTime - p1.ts) / sampleSpan;
                    targetPos.current.set(
                        p1.pos[0] + (p2.pos[0] - p1.pos[0]) * alpha,
                        p1.pos[1] + (p2.pos[1] - p1.pos[1]) * alpha,
                        p1.pos[2] + (p2.pos[2] - p1.pos[2]) * alpha
                    );

                    const wrapAngle = (a: number, b: number, t: number) => {
                        let diff = b - a;
                        while (diff > Math.PI) diff -= Math.PI * 2;
                        while (diff < -Math.PI) diff += Math.PI * 2;
                        return a + diff * t;
                    };
                    targetRot = teleported ? p2.rot : [
                        wrapAngle(p1.rot[0], p2.rot[0], alpha),
                        wrapAngle(p1.rot[1], p2.rot[1], alpha)
                    ];
                }
            }
        }

        // Final position adjustment (Steve's pivot is at 1.5 height)
        targetPos.current.y -= 1.5;

        const [ryw, rxp] = targetRot;

        // The buffered samples already interpolate movement and snap large
        // teleports, so applying another transform step here would add latency.
        currentPos.current.copy(targetPos.current);

        // Handle walk animation based on distance moved THIS frame
        // Use a small epsilon to avoid jittering
        const moveDist = hasPreviousPos.current ? prevPos.current.distanceTo(currentPos.current) : 0;
        const isUnderwater = playerState.isUnderwater;

        if (moveDist > 0.005 && moveDist < 10) {
            const animSpeed = isUnderwater ? 4 : 10;
            walkTime.current += moveDist * animSpeed;
        } else if (moveDist >= 10) {
            // A teleport or dimension return should not create a huge first
            // step that sends the limb phase into imprecise large values.
            walkTime.current = 0;
        } else {
            walkTime.current *= 0.85; // Faster decay for smoother stop
        }
        prevPos.current.copy(currentPos.current);
        hasPreviousPos.current = true;

        if (group.current) {
            group.current.position.copy(currentPos.current);
            // Face the player's yaw (LERPed)
            const targetYaw = ryw;
            let diff = targetYaw - group.current.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            group.current.rotation.y += diff * 0.3;

            // Head pitch (LERPed)
            if (headRef.current) {
                const targetPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rxp));
                headRef.current.rotation.x += (targetPitch - headRef.current.rotation.x) * 0.3;
            }

            // Limb swing animations
            const swingX = Math.sin(walkTime.current) * (isUnderwater ? 0.4 : 0.8);
            const swingY = isUnderwater ? Math.cos(walkTime.current * 0.5) * 0.1 : 0; // Subtle floating bob in water

            // Action animations (swing/hit)
            let actionSwing = 0;
            const lastAction = playerState.lastAction;
            if (lastAction && Date.now() - lastAction.time < 300) {
                const progress = (Date.now() - lastAction.time) / 300;
                if (lastAction.type === 'swing' || lastAction.type === 'hit') {
                    actionSwing = Math.sin(progress * Math.PI) * 1.5;
                } else if (lastAction.type === 'eat') {
                    // Quick bobbing head for eating
                    if (headRef.current) headRef.current.rotation.x += Math.sin(progress * Math.PI * 4) * 0.2;
                }
            }

            if (leftArmRef.current) {
                leftArmRef.current.rotation.x = -swingX;
                leftArmRef.current.position.y = 1.5 + swingY;
            }
            if (rightArmRef.current) {
                rightArmRef.current.rotation.x = swingX - actionSwing;
                rightArmRef.current.position.y = 1.5 + swingY;
            }
            if (leftLegRef.current) leftLegRef.current.rotation.x = swingX;
            if (rightLegRef.current) rightLegRef.current.rotation.x = -swingX;
        }
    });

    const playerName = useGameStore(s => s.connectedPlayers[id]?.name || 'Unknown');
    const playerHealth = useGameStore(s => s.connectedPlayers[id]?.health ?? 20);

    const healthColor = useMemo(() => {
        if (playerHealth > 15) return '#00ff00';
        if (playerHealth > 5) return '#ffff00';
        return '#ff0000';
    }, [playerHealth]);

    // Materials - Steve style colors
    const materialSkin = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffccaa' }), []); // Skin
    const materialShirt = useMemo(() => new THREE.MeshStandardMaterial({ color: '#00aaaa' }), []); // Teal shirt
    const materialPants = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4444bb' }), []); // Blue pants
    const materialShoes = useMemo(() => new THREE.MeshStandardMaterial({ color: '#555555' }), []); // Gray shoes

    return (
        <group ref={group}>
            {/* Health Bar */}
            <group position={[0, 2.45, 0]}>
                <mesh position={[0, 0, -0.01]}>
                    <planeGeometry args={[0.5, 0.05]} />
                    <meshBasicMaterial color="#333" />
                </mesh>
                <mesh position={[(playerHealth / 20 - 1) * 0.25, 0, 0]}>
                    <planeGeometry args={[(playerHealth / 20) * 0.5, 0.05]} />
                    <meshBasicMaterial color={healthColor} />
                </mesh>
            </group>

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
