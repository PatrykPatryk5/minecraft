/**
 * Particle System Logic (Core)
 * 
 * Manages the state of particles off-thread/independent of React rendering.
 * Separated from the UI component to allow smooth HMR and performance.
 */

import * as THREE from 'three';
import { BLOCK_DATA } from './blockTypes';

export interface Particle {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    life: number;
    color: THREE.Color;
    size: number;
    rotation: number;
    rotationVelocity: number;
    drag: number;
    active: boolean;
    type: 'block' | 'smoke' | 'spark';
}

export const MAX_PARTICLES = 4000;
// Static array to avoid garbage collection
export const particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    life: 0,
    color: new THREE.Color(),
    size: 0.1,
    rotation: 0,
    rotationVelocity: 0,
    drag: 0.98,
    active: false,
    type: 'block',
}));

let currentParticleIndex = 0;

export function spawnParticle(
    p: THREE.Vector3,
    v: THREE.Vector3,
    life: number,
    color: string | THREE.Color,
    size: number,
    type: 'block' | 'smoke' | 'spark' = 'block',
    drag = 0.98
) {
    const part = particles[currentParticleIndex];
    part.position.copy(p);
    part.velocity.copy(v);
    part.life = life;
    part.color.set(color);
    part.size = size;
    part.type = type;
    part.drag = drag;
    part.active = true;

    // Randomize rotation for block particles
    if (type === 'block') {
        part.rotation = Math.random() * Math.PI * 2;
        part.rotationVelocity = (Math.random() - 0.5) * 10;
    } else {
        part.rotation = 0;
        part.rotationVelocity = 0;
    }

    currentParticleIndex = (currentParticleIndex + 1) % MAX_PARTICLES;
}

export function emitBlockBreak(x: number, y: number, z: number, blockType: number): void {
    const data = BLOCK_DATA[blockType];
    if (!data) return;

    const color = data.top ?? data.color;

    // More debris particles
    for (let i = 0; i < 12; i++) {
        spawnParticle(
            new THREE.Vector3(x + 0.5 + (Math.random() - 0.5) * 0.6, y + 0.5 + (Math.random() - 0.5) * 0.6, z + 0.5 + (Math.random() - 0.5) * 0.6),
            new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 4 + 2, (Math.random() - 0.5) * 3),
            0.6 + Math.random() * 0.4,
            color,
            0.08 + Math.random() * 0.05,
            'block',
            0.96 // Bit more drag for dust-like debris
        );
    }
}

export function emitSmoke(x: number, y: number, z: number, count = 5): void {
    for (let i = 0; i < count; i++) {
        spawnParticle(
            new THREE.Vector3(x + (Math.random() - 0.5) * 0.4, y + (Math.random() - 0.5) * 0.4, z + (Math.random() - 0.5) * 0.4),
            new THREE.Vector3((Math.random() - 0.5) * 0.5, Math.random() * 1.5 + 0.5, (Math.random() - 0.5) * 0.5),
            1.0 + Math.random() * 1.5,
            '#888888',
            0.2 + Math.random() * 0.2,
            'smoke',
            0.99
        );
    }
}

export function emitSpark(x: number, y: number, z: number, count = 10): void {
    for (let i = 0; i < count; i++) {
        spawnParticle(
            new THREE.Vector3(x, y, z),
            new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5),
            0.3 + Math.random() * 0.4,
            '#ffff00',
            0.05 + Math.random() * 0.05,
            'spark',
            0.92
        );
    }
}

export function emitExplosion(x: number, y: number, z: number): void {
    const colors = ['#ff4400', '#ff8800', '#cccccc', '#444444', '#ffffff'];

    // Dense smoke and block fragments
    for (let i = 0; i < 150; i++) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        const speed = Math.random() * 12 + 4;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;

        spawnParticle(
            new THREE.Vector3(x, y, z),
            new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * speed,
                Math.sin(phi) * Math.sin(theta) * speed,
                Math.cos(phi) * speed
            ),
            1.0 + Math.random() * 2.5,
            color,
            0.2 + Math.random() * 0.5,
            Math.random() > 0.3 ? 'smoke' : 'block',
            0.94
        );
    }

    // High intensity sparks
    emitSpark(x, y, z, 40);
}
