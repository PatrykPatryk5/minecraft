import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';
import { playSound } from '../audio/sounds';

interface EndCrystalProps {
    id: number;
    position: [number, number, number];
    onDestroy: (id: number) => void;
}

export const EndCrystal: React.FC<EndCrystalProps> = ({ id, position, onDestroy }) => {
    const groupRef = useRef<THREE.Group>(null);
    const outerRef = useRef<THREE.Mesh>(null);
    const innerRef = useRef<THREE.Mesh>(null);
    const [destroyed, setDestroyed] = useState(false);

    useFrame((_, delta) => {
        if (destroyed || !groupRef.current || !outerRef.current || !innerRef.current) return;

        // Bobbing up and down
        const time = performance.now() * 0.002;
        groupRef.current.position.y = position[1] + Math.sin(time) * 0.5 + 0.5;

        // Spinning
        outerRef.current.rotation.y += delta;
        outerRef.current.rotation.x += delta * 0.5;

        innerRef.current.rotation.y -= delta * 1.5;
        innerRef.current.rotation.z -= delta * 0.8;
    });

    const onClick = (e: any) => {
        e.stopPropagation(); // prevent block breaking behind it
        if (!destroyed) {
            setDestroyed(true);
            playSound('explode', position);
            // Explode damages player/terrain? For simplicity, just pop.
            // Using MobSystem's explode if we wanted to damage things, but a simpler approach is fine.
            onDestroy(id);
        }
    };

    if (destroyed) return null;

    return (
        <group ref={groupRef} position={new THREE.Vector3(...position)} onClick={onClick}>
            {/* Fire base? Or just the crystal */}
            <mesh ref={outerRef}>
                <boxGeometry args={[1.5, 1.5, 1.5]} />
                <meshStandardMaterial color="#ffaaaa" transparent opacity={0.5} emissive="#ff5555" wireframe />
            </mesh>
            <mesh ref={innerRef}>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="#ff55ff" emissive="#ff00ff" />
            </mesh>
        </group>
    );
};
