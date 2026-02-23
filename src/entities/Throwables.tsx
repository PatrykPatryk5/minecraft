/**
 * Throwables Entity Manager
 * 
 * Handles Eyes of Ender (flying towards stronghold) and Ender Pearls (teleportation).
 */

import React, { useRef, useState } from 'react';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';
import { playSound } from '../audio/sounds';

const EyeOfEnder: React.FC<{ id: string; initialPos: [number, number, number]; target: [number, number] }> = ({ id, initialPos, target }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const [pos, setPos] = useState(new THREE.Vector3(...initialPos));
    const age = useRef(0);
    const targetVec = new THREE.Vector3(target[0], pos.y + 20, target[1]); // Fly up and towards target

    useFrame((_, delta) => {
        age.current += delta;
        if (age.current > 15) { // Despawn after 15s
            useGameStore.getState().removeEyeOfEnder(id);
            return;
        }

        // Float towards target
        const dir = new THREE.Vector3().subVectors(targetVec, pos).normalize();
        const speed = 10;
        pos.add(dir.multiplyScalar(speed * delta));

        if (meshRef.current) {
            meshRef.current.position.copy(pos);
            meshRef.current.rotation.y += delta * 5;
        }

        // Despawn/Drop logic: after 3 seconds, it either "breaks" or "drops"
        if (age.current > 3 && age.current < 3.1) {
            if (Math.random() > 0.8) {
                // Break (disappear)
                useGameStore.getState().removeEyeOfEnder(id);
            } else {
                // Stay for a bit then "drop" (disappear for now, or just remove)
                // In a full implementation, we'd spawn a DroppedItem here.
                useGameStore.getState().removeEyeOfEnder(id);
            }
        }
    });

    return (
        <mesh ref={meshRef}>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshStandardMaterial color="#00cc77" emissive="#004422" />
        </mesh>
    );
};

const EnderPearl: React.FC<{ id: string; initialPos: [number, number, number]; initialVel: [number, number, number] }> = ({ id, initialPos, initialVel }) => {
    const rbRef = useRef<RapierRigidBody>(null);
    const age = useRef(0);

    useFrame((_, delta) => {
        age.current += delta;
        if (age.current > 30) {
            useGameStore.getState().removePearl(id);
        }
    });

    const handleCollision = () => {
        if (rbRef.current) {
            const hitPos = rbRef.current.translation();
            const s = useGameStore.getState();
            // Teleport player
            s.setPlayerPos([hitPos.x, hitPos.y + 1.8, hitPos.z]);
            s.takeDamage(5, { ignoreArmor: true }); // Pearl damage
            playSound('step');
            s.removePearl(id);
        }
    };

    return (
        <RigidBody
            ref={rbRef}
            type="dynamic"
            position={initialPos}
            linearVelocity={initialVel}
            colliders="ball"
            onCollisionEnter={handleCollision}
            gravityScale={1.2}
        >
            <mesh castShadow>
                <sphereGeometry args={[0.15, 8, 8]} />
                <meshStandardMaterial color="#1a7a5e" />
            </mesh>
        </RigidBody>
    );
};

export const ThrowablesManager: React.FC = () => {
    const eyes = useGameStore((s) => s.eyesOfEnder);
    const pearls = useGameStore((s) => s.pearls);

    return (
        <>
            {Object.values(eyes).map((e) => (
                <EyeOfEnder key={e.id} id={e.id} initialPos={e.pos} target={e.target} />
            ))}
            {Object.values(pearls).map((p) => (
                <EnderPearl key={p.id} id={p.id} initialPos={p.pos} initialVel={p.velocity} />
            ))}
        </>
    );
};
