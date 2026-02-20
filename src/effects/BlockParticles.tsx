/**
 * Particles System
 * 
 * Block-break particles using Three.js InstancedMesh for maximum performance.
 * Bypasses React state completely during animation.
 */

import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BLOCK_DATA } from '../core/blockTypes';

interface Particle {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    life: number;
    color: THREE.Color;
    size: number;
    active: boolean;
}

const MAX_PARTICLES = 2000;
// Static array to avoid garbage collection
const particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    life: 0,
    color: new THREE.Color(),
    size: 0.1,
    active: false,
}));

let currentParticleIndex = 0;

function spawnParticle(p: THREE.Vector3, v: THREE.Vector3, life: number, color: string | THREE.Color, size: number) {
    const part = particles[currentParticleIndex];
    part.position.copy(p);
    part.velocity.copy(v);
    part.life = life;
    part.color.set(color);
    part.size = size;
    part.active = true;

    currentParticleIndex = (currentParticleIndex + 1) % MAX_PARTICLES;
}

export function emitBlockBreak(x: number, y: number, z: number, blockType: number): void {
    const data = BLOCK_DATA[blockType];
    if (!data) return;

    const color = data.top ?? data.color;

    for (let i = 0; i < 8; i++) {
        spawnParticle(
            new THREE.Vector3(x + 0.5 + (Math.random() - 0.5) * 0.6, y + 0.5 + (Math.random() - 0.5) * 0.6, z + 0.5 + (Math.random() - 0.5) * 0.6),
            new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 2, (Math.random() - 0.5) * 4),
            0.5 + Math.random() * 0.5,
            color,
            0.1
        );
    }
}

export function emitExplosion(x: number, y: number, z: number): void {
    const colors = ['#ff4400', '#ff8800', '#cccccc', '#444444', '#ffffff'];

    for (let i = 0; i < 100; i++) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        const speed = Math.random() * 8 + 2;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;

        spawnParticle(
            new THREE.Vector3(x, y, z),
            new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * speed,
                Math.sin(phi) * Math.sin(theta) * speed,
                Math.cos(phi) * speed
            ),
            0.5 + Math.random() * 1.5,
            color,
            0.2 + Math.random() * 0.3
        );
    }
}

const dummy = new THREE.Object3D();

const BlockParticles: React.FC = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null);

    useFrame((_, delta) => {
        if (!meshRef.current) return;
        const mesh = meshRef.current;
        let drawCount = 0;

        for (let i = 0; i < MAX_PARTICLES; i++) {
            const p = particles[i];
            if (!p.active) continue;

            p.life -= delta;
            if (p.life <= 0) {
                p.active = false;
                continue;
            }

            p.velocity.y -= 15 * delta;
            p.position.addScaledVector(p.velocity, delta);

            dummy.position.copy(p.position);
            // Shrink as it dies instead of fading opacity
            const scale = Math.max(0, p.size * (p.life * 2));
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();

            mesh.setMatrixAt(drawCount, dummy.matrix);
            mesh.setColorAt(drawCount, p.color);
            drawCount++;
        }

        mesh.count = drawCount;
        if (drawCount > 0) {
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PARTICLES]} frustumCulled={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial />
        </instancedMesh>
    );
};

export default BlockParticles;


