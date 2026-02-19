/**
 * Particles System
 * 
 * Block-break particles using Three.js Points.
 * Shows small colored cubes flying out when a block is destroyed.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BLOCK_DATA } from '../core/blockTypes';

interface Particle {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    life: number;
    color: string;
    size?: number;
}

interface ParticleBurst {
    id: number;
    particles: Particle[];
    startTime: number;
}

// Global event emitter for particles
type ParticleListener = (x: number, y: number, z: number, blockType: number) => void;
// We keep the old listener for compatibility, but redirect it
const listeners: ParticleListener[] = [];

// New internal listener for direct bursts
const internalListeners: ((burst: ParticleBurst) => void)[] = [];

function emitInternal(burst: ParticleBurst) {
    for (const l of internalListeners) l(burst);
}

export function emitBlockBreak(x: number, y: number, z: number, blockType: number): void {
    const data = BLOCK_DATA[blockType];
    if (!data) return;

    const color = data.top ?? data.color;
    const particles: Particle[] = [];

    for (let i = 0; i < 8; i++) {
        particles.push({
            position: new THREE.Vector3(
                x + 0.5 + (Math.random() - 0.5) * 0.6,
                y + 0.5 + (Math.random() - 0.5) * 0.6,
                z + 0.5 + (Math.random() - 0.5) * 0.6
            ),
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 4,
                Math.random() * 4 + 2,
                (Math.random() - 0.5) * 4
            ),
            life: 0.5 + Math.random() * 0.5,
            color,
            size: 0.1
        });
    }

    const burst: ParticleBurst = { id: nextId++, particles, startTime: performance.now() };
    emitInternal(burst);
}

// ... (emitExplosion defined below in previous chunk)

let nextId = 0;

const BlockParticles: React.FC = () => {
    const [bursts, setBursts] = useState<ParticleBurst[]>([]);
    const burstsRef = useRef<ParticleBurst[]>([]);

    // Subscribe to particle events
    useEffect(() => {
        const handler = (burst: ParticleBurst) => {
            burstsRef.current = [...burstsRef.current, burst];
            setBursts([...burstsRef.current]);
        };

        internalListeners.push(handler);
        return () => {
            const idx = internalListeners.indexOf(handler);
            if (idx >= 0) internalListeners.splice(idx, 1);
        };
    }, []);

    // Animate particles
    useFrame((_, delta) => {
        let changed = false;
        const remaining: ParticleBurst[] = [];

        for (const burst of burstsRef.current) {
            let alive = false;
            for (const p of burst.particles) {
                if (p.life <= 0) continue;
                p.life -= delta;
                p.velocity.y -= 15 * delta;
                p.position.add(p.velocity.clone().multiplyScalar(delta));
                if (p.life > 0) alive = true;
            }
            if (alive) {
                remaining.push(burst);
            } else {
                changed = true;
            }
        }

        if (changed) {
            burstsRef.current = remaining;
            setBursts(remaining);
        }
    });

    return (
        <>
            {bursts.map((burst) => (
                <group key={burst.id}>
                    {burst.particles
                        .filter((p) => p.life > 0)
                        .map((p, i) => (
                            <mesh key={i} position={p.position}>
                                <boxGeometry args={[p.size || 0.1, p.size || 0.1, p.size || 0.1]} />
                                <meshBasicMaterial color={p.color} transparent opacity={Math.max(0, p.life * 2)} />
                            </mesh>
                        ))}
                </group>
            ))}
        </>
    );
};

export default BlockParticles;

// ─── Explosion Particles ────────────────────────────────
export function emitExplosion(x: number, y: number, z: number): void {
    const particles: Particle[] = [];
    // Fire/Smoke colors
    const colors = ['#ff4400', '#ff8800', '#cccccc', '#444444', '#ffffff'];

    for (let i = 0; i < 100; i++) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        const speed = Math.random() * 8 + 2;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;

        particles.push({
            position: new THREE.Vector3(x, y, z),
            velocity: new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * speed,
                Math.sin(phi) * Math.sin(theta) * speed,
                Math.cos(phi) * speed
            ),
            life: 0.5 + Math.random() * 1.5,
            color,
            size: 0.2 + Math.random() * 0.3
        });
    }

    const burst: ParticleBurst = { id: nextId++, particles, startTime: performance.now() };
    emitInternal(burst);
}


