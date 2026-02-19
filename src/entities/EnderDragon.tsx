
import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import useGameStore from '../store/gameStore';
import { Html } from '@react-three/drei';
import { playSound } from '../audio/sounds';

export const EnderDragon: React.FC = () => {
    const ref = useRef<any>(null);
    const [health, setHealth] = useState<number>(200);
    const maxHealth = 200;
    const playerPos = useGameStore(s => s.playerPos);

    // Simple state machine: Circle -> Swoop -> Perch
    const state = useRef<'circle' | 'swoop'>('circle');
    const target = useRef(new Vector3(0, 50, 0));
    const angle = useRef(0);

    useFrame((_, delta) => {
        if (!ref.current || health <= 0) return;

        const dragonPos = ref.current.position;
        angle.current += delta * 0.5;

        if (state.current === 'circle') {
            // Circle around 0,0 at radius 60, height 50
            target.current.set(
                Math.sin(angle.current) * 60,
                50 + Math.sin(angle.current * 2) * 10,
                Math.cos(angle.current) * 60
            );

            // Chance to swoop
            if (Math.random() < 0.005) {
                state.current = 'swoop';
            }
        } else if (state.current === 'swoop') {
            // Swoop at player
            target.current.set(playerPos[0], playerPos[1] + 5, playerPos[2]);
            if (dragonPos.distanceTo(target.current) < 10) {
                state.current = 'circle';
            }
        }

        // Move towards target
        const step = 20 * delta; // Speed
        dragonPos.lerp(target.current, step * 0.05);
        ref.current.lookAt(target.current);

        // Random roar
        if (Math.random() < 0.002) {
            playSound('roar', [dragonPos.x, dragonPos.y, dragonPos.z]);
        }
    });

    const onClick = () => {
        // Take damage
        const newHealth = health - 10;
        setHealth(newHealth);
        if (ref.current) {
            playSound('hurt', [ref.current.position.x, ref.current.position.y, ref.current.position.z]);
        }
        if (newHealth <= 0) {
            useGameStore.getState().setDragonDefeated(true);
            useGameStore.getState().setScreen('credits'); // Win!
        }
    };

    if (health <= 0) return null;

    return (
        <group ref={ref} position={[0, 60, 0]} onClick={onClick}>
            {/* Dragon Body (Simplified boxes) */}
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[4, 4, 12]} />
                <meshStandardMaterial color="#220033" />
            </mesh>
            {/* Head */}
            <mesh position={[0, 2, 8]}>
                <boxGeometry args={[3, 3, 6]} />
                <meshStandardMaterial color="#110022" />
            </mesh>
            {/* Wings */}
            <mesh position={[6, 2, 0]} rotation={[0, 0, -0.2]}>
                <boxGeometry args={[12, 0.5, 8]} />
                <meshStandardMaterial color="#110011" />
            </mesh>
            <mesh position={[-6, 2, 0]} rotation={[0, 0, 0.2]}>
                <boxGeometry args={[12, 0.5, 8]} />
                <meshStandardMaterial color="#110011" />
            </mesh>

            {/* Boss Bar */}
            <Html position={[0, 8, 0]} center>
                <div style={{ width: '200px', height: '20px', background: '#333', border: '2px solid #fff' }}>
                    <div style={{ width: `${(health / maxHealth) * 100}%`, height: '100%', background: '#d0d' }} />
                </div>
                <div style={{ color: 'white', textAlign: 'center', fontFamily: 'Minecraft', textShadow: '2px 2px 0 #000' }}>Ender Dragon</div>
            </Html>
        </group>
    );
};
