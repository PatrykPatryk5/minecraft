/**
 * Arrows Entity Manager
 * 
 * Handles the physics, collision, and rendering of arrow projectiles.
 */

import React, { useRef } from 'react';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';
import { attackMob } from '../mobs/MobSystem';
import { playSound } from '../audio/sounds';

const MOB_HIT_CHECK_INTERVAL = 1 / 30;

const Arrow: React.FC<{ id: string; initialPos: [number, number, number]; initialVel: [number, number, number] }> = ({ id, initialPos, initialVel }) => {
    const rbRef = useRef<RapierRigidBody>(null);
    const stuck = useRef(false);
    const age = useRef(0);
    const meshRef = useRef<THREE.Mesh>(null);
    const hitCheckTimer = useRef(0);
    const direction = useRef(new THREE.Vector3());
    const up = useRef(new THREE.Vector3(0, 1, 0));
    const rotation = useRef(new THREE.Quaternion());

    useFrame((_, delta) => {
        if (stuck.current) return;

        age.current += delta;
        if (age.current > 60) { // Despawn after 60s
            useGameStore.getState().removeArrow(id);
            return;
        }

        if (rbRef.current) {
            const pos = rbRef.current.translation();
            const vel = rbRef.current.linvel();

            // Speed must be significant to damage
            const speedSq = vel.x * vel.x + vel.y * vel.y + vel.z * vel.z;
            if (speedSq > 5) {
                hitCheckTimer.current += delta;
                if (hitCheckTimer.current >= MOB_HIT_CHECK_INTERVAL) {
                    hitCheckTimer.current %= MOB_HIT_CHECK_INTERVAL;
                    const dir = direction.current.set(vel.x, vel.y, vel.z).normalize();
                    const hit = attackMob(pos.x, pos.y, pos.z, [dir.x, dir.y, dir.z], 6);
                    if (hit) {
                        useGameStore.getState().removeArrow(id);
                        return;
                    }
                }
            }

            // Update rotation to match velocity
            if (meshRef.current && speedSq > 0.1) {
                direction.current.set(vel.x, vel.y, vel.z).normalize();
                rotation.current.setFromUnitVectors(up.current, direction.current);
                meshRef.current.quaternion.copy(rotation.current);
            }
        }
    });

    return (
        <RigidBody
            ref={rbRef}
            type="dynamic"
            position={initialPos}
            linearVelocity={initialVel}
            colliders="ball" // Small sphere collider for the tip
            onCollisionEnter={() => {
                if (stuck.current) return;
                stuck.current = true;
                rbRef.current?.setBodyType(0, true); // FIXED / STATIC
                playSound('step');
            }}
            ccd={true}
            gravityScale={1.5} // Faster drop for better arc
        >
            <mesh ref={meshRef} castShadow>
                <cylinderGeometry args={[0.02, 0.02, 0.7, 8]} />
                <meshStandardMaterial color="#8b5a2b" />
                {/* Feathers */}
                <mesh position={[0, -0.3, 0]}>
                    <boxGeometry args={[0.1, 0.1, 0.01]} />
                    <meshStandardMaterial color="white" />
                </mesh>
            </mesh>
        </RigidBody>
    );
};

const ArrowsManager: React.FC = () => {
    const arrows = useGameStore((s) => s.arrows);
    return (
        <>
            {Object.values(arrows).map((a) => (
                <Arrow key={a.id} id={a.id} initialPos={a.pos} initialVel={a.velocity} />
            ))}
        </>
    );
};

export default ArrowsManager;
