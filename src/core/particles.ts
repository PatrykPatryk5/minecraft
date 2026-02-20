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
    active: boolean;
}

export const MAX_PARTICLES = 2000;
// Static array to avoid garbage collection
export const particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    life: 0,
    color: new THREE.Color(),
    size: 0.1,
    active: false,
}));

let currentParticleIndex = 0;

export function spawnParticle(p: THREE.Vector3, v: THREE.Vector3, life: number, color: string | THREE.Color, size: number) {
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
