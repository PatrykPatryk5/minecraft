/**
 * Mob Renderer — Multi-Part Minecraft-Style Models
 *
 * Each mob has:
 *   - Head, body, arms/legs with distinct colors
 *   - Walk animation (leg/arm oscillation)
 *   - Health bars, hurt flash
 *   - Distinct proportions per mob type
 *
 * Performance: uses direct THREE.Group + mesh for each mob.
 * At typical spawn rates (~20-30 mobs) this is 150-200 meshes, which is fine.
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';

const HURT_COLOR = new THREE.Color(0xff0000);
const NO_HURT_COLOR = new THREE.Color(0x000000);
import { updateMobs } from './MobSystem';

interface MobModel {
    head: { size: [number, number, number]; color: string; yOff: number };
    body: { size: [number, number, number]; color: string; yOff: number };
    legs: { size: [number, number, number]; color: string; count: number; spacing: number; yOff: number };
    arms?: { size: [number, number, number]; color: string; yOff: number };
    faceColor?: string; // eye/face detail
}

const MOB_MODELS: Record<string, MobModel> = {
    zombie: {
        head: { size: [0.5, 0.5, 0.5], color: '#4a7a3d', yOff: 1.5 },
        body: { size: [0.5, 0.75, 0.25], color: '#3a6a80', yOff: 0.87 },
        legs: { size: [0.24, 0.75, 0.25], count: 2, spacing: 0.26, color: '#2a3a6a', yOff: 0.0 },
        arms: { size: [0.24, 0.7, 0.24], color: '#4a7a3d', yOff: 0.95 },
        faceColor: '#2a4a1d',
    },
    skeleton: {
        head: { size: [0.5, 0.5, 0.5], color: '#d8d8c8', yOff: 1.5 },
        body: { size: [0.5, 0.75, 0.2], color: '#c8c8b8', yOff: 0.87 },
        legs: { size: [0.18, 0.75, 0.18], count: 2, spacing: 0.26, color: '#b8b8a8', yOff: 0.0 },
        arms: { size: [0.18, 0.7, 0.18], color: '#c8c8b8', yOff: 0.95 },
        faceColor: '#333333',
    },
    creeper: {
        head: { size: [0.5, 0.5, 0.5], color: '#3eb049', yOff: 1.5 },
        body: { size: [0.5, 1.0, 0.5], color: '#3eb049', yOff: 0.75 },
        legs: { size: [0.24, 0.4, 0.24], count: 4, spacing: 0.26, color: '#2a8035', yOff: 0.0 },
        faceColor: '#111111',
    },
    pig: {
        head: { size: [0.5, 0.5, 0.5], color: '#f0a0a0', yOff: 0.7 },
        body: { size: [0.625, 0.5, 0.375], color: '#f0a0a0', yOff: 0.45 },
        legs: { size: [0.2, 0.25, 0.2], count: 4, spacing: 0.22, color: '#e09090', yOff: 0.0 },
        faceColor: '#d88888',
    },
    cow: {
        head: { size: [0.5, 0.5, 0.4], color: '#6a4a30', yOff: 0.85 },
        body: { size: [0.5625, 0.6, 0.375], color: '#e8e8e8', yOff: 0.55 },
        legs: { size: [0.2, 0.35, 0.2], count: 4, spacing: 0.22, color: '#6a4a30', yOff: 0.0 },
    },
    sheep: {
        head: { size: [0.4, 0.4, 0.4], color: '#555555', yOff: 0.75 },
        body: { size: [0.5, 0.55, 0.375], color: '#f0f0f0', yOff: 0.48 },
        legs: { size: [0.18, 0.3, 0.18], count: 4, spacing: 0.20, color: '#555555', yOff: 0.0 },
    },
    chicken: {
        head: { size: [0.25, 0.25, 0.25], color: '#e8e8e8', yOff: 0.65 },
        body: { size: [0.35, 0.3, 0.3], color: '#e8e8e8', yOff: 0.35 },
        legs: { size: [0.08, 0.2, 0.08], count: 2, spacing: 0.12, color: '#e8b040', yOff: 0.0 },
        faceColor: '#cc3030', // red waddle
    },
    enderman: {
        head: { size: [0.48, 0.62, 0.42], color: '#171323', yOff: 2.25 },
        body: { size: [0.38, 1.0, 0.28], color: '#211a30', yOff: 1.42 },
        legs: { size: [0.16, 1.0, 0.16], count: 2, spacing: 0.17, color: '#171323', yOff: 0.0 },
        arms: { size: [0.15, 1.0, 0.15], color: '#171323', yOff: 1.42 },
        faceColor: '#c04cff',
    },
    wolf: {
        head: { size: [0.32, 0.32, 0.42], color: '#aaa79b', yOff: 0.64 },
        body: { size: [0.38, 0.42, 0.68], color: '#c4c0b3', yOff: 0.42 },
        legs: { size: [0.12, 0.28, 0.12], count: 4, spacing: 0.22, color: '#8c887e', yOff: 0.0 },
        faceColor: '#202020',
    },
    spider: {
        head: { size: [0.36, 0.28, 0.34], color: '#35251d', yOff: 0.36 },
        body: { size: [0.62, 0.3, 0.72], color: '#4a3021', yOff: 0.32 },
        legs: { size: [0.1, 0.42, 0.1], count: 8, spacing: 0.2, color: '#2a201b', yOff: 0.02 },
        faceColor: '#b51f16',
    },
    blaze: {
        head: { size: [0.4, 0.4, 0.4], color: '#e8a21c', yOff: 1.35 },
        body: { size: [0.34, 0.55, 0.34], color: '#b64b16', yOff: 0.82 },
        legs: { size: [0.1, 0.42, 0.1], count: 4, spacing: 0.25, color: '#f4c348', yOff: 0.0 },
        arms: { size: [0.12, 0.48, 0.12], color: '#f4c348', yOff: 0.82 },
        faceColor: '#ffe58a',
    },
};

// Shared geometry cache
const geoCache = new Map<string, THREE.BoxGeometry>();
function getGeo(w: number, h: number, d: number): THREE.BoxGeometry {
    const key = `${w},${h},${d}`;
    let g = geoCache.get(key);
    if (!g) { g = new THREE.BoxGeometry(w, h, d); geoCache.set(key, g); }
    return g;
}

// Shared material cache
const matCache = new Map<string, THREE.MeshStandardMaterial>();
const mobMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
const skinCache = new Map<string, THREE.CanvasTexture>();

function getFaceTexture(type: string, accent: string): THREE.CanvasTexture {
    const key = `face:${type}:${accent}`;
    const cached = skinCache.get(key);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    const pixel = (x: number, y: number, color: string, w = 1, h = 1) => {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
    };
    const dark = '#211a18';

    // Transparent pixel art sits just above each head and supplies readable
    // eyes, noses, mouths, and species-specific markings.
    if (type === 'creeper') {
        pixel(2, 3, dark, 4, 4); pixel(10, 3, dark, 4, 4);
        pixel(6, 7, dark, 4, 3); pixel(4, 9, dark, 3, 5); pixel(9, 9, dark, 3, 5);
    } else if (type === 'enderman') {
        pixel(2, 7, accent, 4, 2); pixel(10, 7, accent, 4, 2);
    } else if (type === 'spider') {
        pixel(1, 6, accent, 3, 3); pixel(5, 7, '#f45b3d', 2, 2);
        pixel(9, 7, '#f45b3d', 2, 2); pixel(12, 6, accent, 3, 3);
    } else if (type === 'wolf') {
        pixel(3, 4, dark, 2, 2); pixel(11, 4, dark, 2, 2);
        pixel(6, 8, '#d8c5a5', 4, 5); pixel(7, 7, dark, 2, 2);
    } else if (type === 'pig') {
        pixel(3, 4, dark, 2, 2); pixel(11, 4, dark, 2, 2);
        pixel(5, 9, accent, 6, 4); pixel(6, 10, dark, 1, 2); pixel(9, 10, dark, 1, 2);
    } else if (type === 'chicken') {
        pixel(3, 4, dark, 2, 2); pixel(11, 4, dark, 2, 2);
        pixel(6, 8, '#e9a52c', 4, 3); pixel(7, 10, '#d03a30', 2, 3);
    } else if (type === 'blaze') {
        pixel(2, 6, accent, 4, 2); pixel(10, 6, accent, 4, 2);
        pixel(6, 11, '#63260e', 4, 1);
    } else if (type === 'skeleton') {
        pixel(2, 4, dark, 4, 4); pixel(10, 4, dark, 4, 4);
        pixel(7, 8, '#aaa99e', 2, 2); pixel(3, 12, '#77766e', 10, 2);
        for (let x = 4; x < 13; x += 2) pixel(x, 12, '#f1efe4', 1, 2);
    } else {
        // Humanoid faces and farm animal eyes.
        pixel(3, 5, type === 'zombie' ? '#20291b' : dark, 3, 3);
        pixel(10, 5, type === 'zombie' ? '#20291b' : dark, 3, 3);
        if (type === 'zombie') {
            pixel(6, 10, '#263927', 4, 2);
            pixel(7, 9, '#35422a', 2, 1);
        } else if (type === 'cow' || type === 'sheep') {
            pixel(6, 9, '#b7a88f', 4, 4);
            pixel(7, 8, dark, 2, 2);
        } else {
            pixel(6, 11, dark, 4, 1);
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    skinCache.set(key, texture);
    return texture;
}

function getSkinTexture(type: string, part: string, baseColor: string): THREE.CanvasTexture {
    const key = `${type}:${part}:${baseColor}`;
    const cached = skinCache.get(key);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    // Keep the 16-pixel species markings, but render them into a 64px surface
    // with per-texel variation so close-up mobs do not look like flat cubes.
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    // Three.Color stores hex inputs in linear working space; CanvasTexture pixels
    // are sRGB. Convert back before writing bytes or every mob skin is too dark.
    const base = new THREE.Color(baseColor).convertLinearToSRGB();
    let seed = 2166136261;
    for (const char of key) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 0x100000000;
    };

    // Much stronger and more realistic shading and texturing to satisfy "realistic graphics" request.
    // Adds organic procedural noise simulating fur, scales, and flesh depending on mob type.
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        let shade = 0.75 + (1 - y / 80) * 0.35 + (random() - 0.5) * 0.25;
        
        // Add species-specific realistic texturing
        if (type === 'zombie') {
            // Fleshy rot / stains
            if (random() > 0.85) shade -= 0.3;
            else if (random() > 0.95) shade += 0.2; // bone protruding
        } else if (type === 'skeleton') {
            // Bone cracks and pores
            if (random() > 0.9) shade -= 0.4;
            shade += (Math.sin(x * 0.5) * 0.1) * (Math.cos(y * 0.5) * 0.1);
        } else if (type === 'creeper') {
            // Scaly / leafy texture
            const scale = Math.sin(x * 1.5) * Math.cos(y * 1.5);
            shade += scale * 0.3;
        } else if (type === 'wolf' || type === 'sheep') {
            // Fur / wool strands
            shade += Math.sin(x * 3.14 + y * 2) * 0.2;
            if (random() > 0.7) shade += 0.2;
        } else if (type === 'enderman') {
            // Alien static / void aura
            shade += (random() - 0.5) * 0.5;
            if (random() > 0.95) shade += 1.0; // purple static sparks
        } else if (type === 'blaze') {
            // Fire/magma glow
            shade += Math.abs(Math.sin(x * 0.2 + y * 0.5)) * 0.4;
        }

        ctx.fillStyle = `rgb(${Math.min(255, Math.max(0, Math.round(base.r * 255 * shade)))},${Math.min(255, Math.max(0, Math.round(base.g * 255 * shade)))},${Math.min(255, Math.max(0, Math.round(base.b * 255 * shade)))})`;
        ctx.fillRect(x, y, 1, 1);
    }

    // Species markings below are authored on a 16x16 grid; scale that grid to
    // the higher-resolution surface while preserving recognizable patterns.
    ctx.scale(4, 4);

    if (type === 'cow' && part === 'body') {
        ctx.fillStyle = '#493329';
        ctx.fillRect(2, 2, 4, 3); ctx.fillRect(10, 1, 4, 5);
        ctx.fillRect(1, 10, 5, 4); ctx.fillRect(9, 9, 5, 5);
    } else if (type === 'sheep' && (part === 'body' || part === 'wool_fleece')) {
        for (let i = 0; i < 24; i++) {
            const x = (random() * 15) | 0, y = (random() * 15) | 0;
            ctx.fillStyle = random() > 0.5 ? '#fffdf0' : '#d9d5c8';
            ctx.fillRect(x, y, 2, 1);
        }
    } else if (type === 'pig') {
        for (let i = 0; i < 12; i++) {
            ctx.fillStyle = random() > 0.5 ? '#f7b6b2' : '#ce7e82';
            ctx.fillRect((random() * 15) | 0, (random() * 15) | 0, 1 + ((random() * 2) | 0), 1);
        }
    } else if (type === 'zombie' && part === 'body') {
        ctx.fillStyle = '#244c5a'; ctx.fillRect(0, 1, 16, 14);
        ctx.fillStyle = '#347181'; ctx.fillRect(1, 2, 6, 3); ctx.fillRect(9, 2, 6, 3);
        ctx.fillStyle = '#7b9e57'; ctx.fillRect(7, 6, 2, 7);
    } else if (type === 'skeleton' && part !== 'head') {
        ctx.fillStyle = '#77766e'; ctx.fillRect(0, 5, 16, 2); ctx.fillRect(0, 12, 16, 1);
        ctx.fillStyle = '#f0eee0'; ctx.fillRect(2, 1, 2, 3); ctx.fillRect(10, 8, 3, 3);
    } else if (type === 'creeper') {
        for (let i = 0; i < 18; i++) {
            ctx.fillStyle = random() > 0.5 ? '#2d8e3d' : '#60c34e';
            ctx.fillRect((random() * 15) | 0, (random() * 15) | 0, 2, 2);
        }
    } else if (type === 'enderman') {
        for (let i = 0; i < 10; i++) {
            ctx.fillStyle = '#7547a5'; ctx.fillRect((random() * 15) | 0, (random() * 15) | 0, 1, 1);
        }
    } else if (type === 'blaze') {
        ctx.fillStyle = '#ffd45e';
        for (let y = 2; y < 16; y += 5) ctx.fillRect(1, y, 14, 1);
    } else if (type === 'wolf' || type === 'spider') {
        for (let i = 0; i < 16; i++) {
            ctx.fillStyle = i % 2 ? '#332820' : '#d7d2c3';
            ctx.fillRect((random() * 15) | 0, (random() * 15) | 0, 1, 2);
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    skinCache.set(key, texture);
    return texture;
}

function getSkinNormalTexture(type: string, part: string, baseColor: string): THREE.CanvasTexture {
    const key = `normal:${type}:${part}:${baseColor}`;
    const cached = skinCache.get(key);
    if (cached) return cached;

    const diffuse = getSkinTexture(type, part, baseColor);
    const source = diffuse.image as HTMLCanvasElement;
    const sourceContext = source.getContext('2d')!;
    const { data, width, height } = sourceContext.getImageData(0, 0, source.width, source.height);
    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = width;
    normalCanvas.height = height;
    const normalContext = normalCanvas.getContext('2d')!;
    const normalData = normalContext.createImageData(width, height);
    const luminance = (x: number, y: number) => {
        const i = (Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))) * 4;
        return (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;
    };

    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const nx = (luminance(x - 1, y) - luminance(x + 1, y)) * 0.5;
        const ny = (luminance(x, y - 1) - luminance(x, y + 1)) * 0.5;
        const nz = 1;
        const length = Math.hypot(nx, ny, nz);
        const i = (y * width + x) * 4;
        normalData.data[i] = Math.round((nx / length * 0.65 + 0.5) * 255);
        normalData.data[i + 1] = Math.round((ny / length * 0.65 + 0.5) * 255);
        normalData.data[i + 2] = Math.round((nz / length * 0.65 + 0.5) * 255);
        normalData.data[i + 3] = 255;
    }
    normalContext.putImageData(normalData, 0, 0);

    const texture = new THREE.CanvasTexture(normalCanvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    skinCache.set(key, texture);
    return texture;
}

function getMat(color: string, emissive?: boolean): THREE.MeshStandardMaterial {
    const key = color + (emissive ? '_e' : '');
    let m = matCache.get(key);
    if (!m) {
        m = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color),
            emissive: new THREE.Color(emissive ? 0xcc0000 : 0x000000),
            emissiveIntensity: emissive ? 0.6 : 0,
            roughness: 0.92,
            metalness: 0,
        });
        matCache.set(key, m);
    }
    return m;
}

const MobRenderer: React.FC = () => {
    const groupRef = useRef<THREE.Group>(null);
    const visualSignature = useGameStore((s) => s.mobs.map((mob: any) => {
        const maxHealth = Math.max(1, mob.maxHealth ?? 20);
        const healthStep = Math.ceil(Math.max(0, mob.health ?? maxHealth) / maxHealth * 20);
        const dx = s.playerPos[0] - mob.pos[0];
        const dy = s.playerPos[1] - mob.pos[1];
        const dz = s.playerPos[2] - mob.pos[2];
        const detailLod = dx * dx + dy * dy + dz * dz <= 24 * 24 ? 0 : 1;
        return `${mob.id}:${mob.type}:${healthStep}:${detailLod}`;
    }).join('|'));
    const visualSnapshot = useMemo(() => {
        const state = useGameStore.getState();
        return { mobs: state.mobs, playerPos: state.playerPos };
    }, [visualSignature]);
    const { mobs, playerPos } = visualSnapshot;
    const simulationAccumulator = useRef(0);
    const mobTick = 1 / 20;

    // Per-mob limb rotation for walk animation
    const limbPhases = useRef<Map<string, number>>(new Map());
    const hurtStates = useRef<Map<string, boolean>>(new Map());

    useEffect(() => {
        hurtStates.current.clear();
        const activeIds = new Set(mobs.map((mob: any) => String(mob.id)));
        const activeMaterialPrefixes = new Set(mobs.map((mob: any) => `${mob.id}:${mob.type}:`));
        for (const id of limbPhases.current.keys()) {
            if (!activeIds.has(id)) limbPhases.current.delete(id);
        }
        for (const id of hurtStates.current.keys()) {
            if (!activeIds.has(id)) hurtStates.current.delete(id);
        }
        for (const [key, material] of mobMaterialCache) {
            const mobId = key.slice(0, key.indexOf(':'));
            const mobTypePrefix = `${mobId}:${key.slice(key.indexOf(':') + 1).split(':', 1)[0]}:`;
            if (!activeMaterialPrefixes.has(mobTypePrefix)) {
                material.dispose();
                mobMaterialCache.delete(key);
            }
        }
    }, [visualSignature]);

    useEffect(() => () => {
        for (const material of mobMaterialCache.values()) material.dispose();
        mobMaterialCache.clear();
        for (const texture of skinCache.values()) texture.dispose();
        skinCache.clear();
    }, []);

    useFrame((_, delta) => {
        const s = useGameStore.getState();
        if (s.isPaused || s.screen !== 'playing') return;

        // Run AI on the same fixed 20 Hz cadence as the rest of the game. Running
        // pathfinding once per render frame needlessly tripled its CPU cost at 60 FPS.
        simulationAccumulator.current = Math.min(simulationAccumulator.current + Math.min(delta, 0.2), mobTick * 5);
        let simulationSteps = 0;
        while (simulationAccumulator.current >= mobTick && simulationSteps < 4) {
            updateMobs(mobTick);
            simulationAccumulator.current -= mobTick;
            simulationSteps++;
        }
        // Drop excessive backlog after a long stall rather than freezing the next frame.
        if (simulationSteps === 4 && simulationAccumulator.current >= mobTick) {
            simulationAccumulator.current %= mobTick;
        }

        if (!groupRef.current) return;
        const children = groupRef.current.children;
        const frameState = useGameStore.getState();
        const frameMobs = frameState.mobs;
        const framePlayerPos = frameState.playerPos;

        for (let i = 0; i < frameMobs.length && i < children.length; i++) {
            const mob = frameMobs[i];
            const group = children[i] as THREE.Group;
            if (!mob || !group) continue;

            const prediction = simulationAccumulator.current;
            group.position.set(
                mob.pos[0] + (mob.vel[0] + (mob.knockback?.[0] || 0)) * prediction,
                mob.pos[1] + mob.vel[1] * prediction,
                mob.pos[2] + (mob.vel[2] + (mob.knockback?.[2] || 0)) * prediction,
            );

            // Face direction of movement
            if (mob.vel && (Math.abs(mob.vel[0]) > 0.1 || Math.abs(mob.vel[2]) > 0.1)) {
                group.rotation.y = Math.atan2(mob.vel[0], mob.vel[2]);
            }

            // Walk animation — oscillate legs/arms
            const speed = mob.vel ? Math.sqrt(mob.vel[0] ** 2 + mob.vel[2] ** 2) : 0;
            const id = mob.id || `mob_${i}`;
            let phase = limbPhases.current.get(id) || 0;
            if (speed > 0.2) {
                phase += delta * speed * 4;
                limbPhases.current.set(id, phase);
            } else {
                const target = Math.round(phase / (Math.PI * 2)) * Math.PI * 2;
                phase += (target - phase) * Math.min(1, delta * 8); // settle
                limbPhases.current.set(id, phase);
            }

            const model = MOB_MODELS[mob.type] || MOB_MODELS.zombie;
            const dx = framePlayerPos[0] - mob.pos[0];
            const dy = framePlayerPos[1] - mob.pos[1];
            const dz = framePlayerPos[2] - mob.pos[2];
            const hasFaceOverlay = dx * dx + dy * dy + dz * dz <= 24 * 24;
            const legSwing = Math.sin(phase) * 0.6;

            // Animate legs
            // Far mobs omit the face overlay. Account for that so limb indices
            // remain correct in both detail LODs.
            const firstOptionalIndex = 2 + (hasFaceOverlay ? 1 : 0);
            const firstLegIndex = firstOptionalIndex + (model.arms ? 2 : 0);

            // Direct leg animation
            for (let li = 0; li < model.legs.count; li++) {
                const legMesh = group.children[firstLegIndex + li] as THREE.Mesh;
                if (legMesh) {
                    const dir = li % 2 === 0 ? 1 : -1;
                    legMesh.rotation.x = legSwing * dir;
                }
            }

            // Arm animation
            if (model.arms) {
                for (let ai = 0; ai < 2; ai++) {
                    const armMesh = group.children[firstOptionalIndex + ai] as THREE.Mesh;
                    if (armMesh) {
                        armMesh.rotation.x = legSwing * (ai === 0 ? -1 : 1);
                    }
                }
            }

            // Hurt flash - OPTIMIZED: only update the group's userData and let meshes handle it if possible
            // Actually, for simplicity and performance, we can just update the first few children if we know they are meshes
            const isHurt = mob.hurtTimer > 0;
            const hurtIntensity = isHurt ? 0.8 : 0;
            const hurtColor = isHurt ? HURT_COLOR : NO_HURT_COLOR;

            if (hurtStates.current.get(id) !== isHurt) {
                hurtStates.current.set(id, isHurt);
                for (const child of group.children) {
                    if (!(child as THREE.Mesh).isMesh) continue;
                    const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
                    material.emissiveIntensity = hurtIntensity;
                    material.emissive = hurtColor;
                }
            }
        }
    });

    const mobMeshes = useMemo(() => {
        return mobs.map((mob: any, i: number) => {
            const model = MOB_MODELS[mob.type] || MOB_MODELS.zombie;
            const dx = playerPos[0] - mob.pos[0];
            const dy = playerPos[1] - mob.pos[1];
            const dz = playerPos[2] - mob.pos[2];
            const detailed = dx * dx + dy * dy + dz * dz <= 24 * 24;
            const meshes: React.ReactNode[] = [];

            // Helper to get a cloned material for this specific mob mesh
            const getUniqueMat = (color: string, part: string, faceTexture = false) => {
                const materialKey = `${mob.id}:${mob.type}:${detailed ? 'detailed' : 'simple'}:${part}:${color}`;
                const existing = mobMaterialCache.get(materialKey);
                if (existing) return existing;
                const mat = getMat(color).clone();
                if (detailed) {
                    mat.map = faceTexture ? getFaceTexture(mob.type, color) : getSkinTexture(mob.type, part, color);
                    if (!faceTexture) {
                        mat.normalMap = getSkinNormalTexture(mob.type, part, color);
                        mat.normalScale.set(0.45, 0.45);
                    }
                    mat.color.set('#ffffff');
                }
                if (faceTexture) {
                    mat.transparent = true;
                    mat.alphaTest = 0.05;
                    mat.depthWrite = false;
                }
                mat.needsUpdate = true;
                mobMaterialCache.set(materialKey, mat);
                return mat;
            };

            // Head
            meshes.push(
                <mesh key="head" geometry={getGeo(...model.head.size)}
                    material={getUniqueMat(model.head.color, 'head')}
                    position={[0, model.head.yOff, 0]} />
            );

            // Body
            meshes.push(
                <mesh key="body" geometry={getGeo(...model.body.size)}
                    material={getUniqueMat(model.body.color, 'body')}
                    position={[0, model.body.yOff, 0]} />
            );

            // Face detail (eyes/face)
            if (detailed) {
                const faceMat = getUniqueMat(model.faceColor || '#202020', 'face', true);
                meshes.push(
                    <mesh key="face" geometry={getGeo(model.head.size[0] * 0.94, model.head.size[1] * 0.94, 0.01)}
                        material={faceMat}
                        position={[0, model.head.yOff, model.head.size[2] / 2 + 0.012]} />
                );
            }

            // Arms (humanoids)
            if (model.arms) {
                const armOff = model.body.size[0] / 2 + model.arms.size[0] / 2;
                meshes.push(
                    <mesh key="arm_l" geometry={getGeo(...model.arms.size)}
                        material={getUniqueMat(model.arms.color, 'arm_l')}
                        position={[-armOff, model.arms.yOff, 0]} />
                );
                meshes.push(
                    <mesh key="arm_r" geometry={getGeo(...model.arms.size)}
                        material={getUniqueMat(model.arms.color, 'arm_r')}
                        position={[armOff, model.arms.yOff, 0]} />
                );
            }

            // Legs
            const legColumns = model.legs.count <= 2 ? model.legs.count : model.legs.count / 2;
            for (let li = 0; li < model.legs.count; li++) {
                const lx = model.legs.count <= 2
                    ? (li === 0 ? -model.legs.spacing : model.legs.spacing)
                    : ((li % legColumns) - (legColumns - 1) / 2) * model.legs.spacing;

                // For 4-legged mobs, position in 2 rows
                let lz = 0;
                if (model.legs.count >= 4) {
                    lz = Math.floor(li / legColumns) === 0 ? model.body.size[2] / 2 - 0.05 : -model.body.size[2] / 2 + 0.05;
                }
                const llx = model.legs.count >= 4 ? lx : (model.legs.count === 2 ? (li === 0 ? -model.legs.spacing : model.legs.spacing) : lx);

                meshes.push(
                    <mesh key={`leg_${li}`}
                        geometry={getGeo(...model.legs.size)}
                        material={getUniqueMat(model.legs.color, `leg_${li}`)}
                        position={[llx, model.legs.yOff + model.legs.size[1] / 2, lz]}
                        rotation={model.legs.count >= 8 ? [0, 0, (llx < 0 ? -1 : 1) * 0.9] : undefined} />
                );
            }

            // Species-specific silhouettes add readable anatomy without replacing
            // the shared, low-cost voxel geometry used by the rest of each model.
            const addDetail = (
                key: string,
                size: [number, number, number],
                color: string,
                position: [number, number, number],
            ) => meshes.push(
                <mesh key={key} geometry={getGeo(...size)} material={getUniqueMat(color, key)} position={position} />
            );

            if (detailed && mob.type === 'pig') {
                const snoutZ = model.head.size[2] / 2 + 0.07;
                const snoutY = model.head.yOff - 0.08;
                addDetail('snout', [0.24, 0.15, 0.12], '#e89598', [0, snoutY, snoutZ]);
                addDetail('nostril_l', [0.035, 0.045, 0.012], '#54292b', [-0.055, snoutY, snoutZ + 0.066]);
                addDetail('nostril_r', [0.035, 0.045, 0.012], '#54292b', [0.055, snoutY, snoutZ + 0.066]);
                addDetail('ear_l', [0.09, 0.15, 0.08], '#e89598', [-0.18, model.head.yOff + 0.28, 0]);
                addDetail('ear_r', [0.09, 0.15, 0.08], '#e89598', [0.18, model.head.yOff + 0.28, 0]);
            } else if (detailed && mob.type === 'cow') {
                addDetail('muzzle', [0.24, 0.15, 0.12], '#d4b8a1', [0, model.head.yOff - 0.1, model.head.size[2] / 2 + 0.05]);
                addDetail('horn_l', [0.07, 0.17, 0.07], '#e2d5b8', [-0.19, model.head.yOff + 0.28, 0]);
                addDetail('horn_r', [0.07, 0.17, 0.07], '#e2d5b8', [0.19, model.head.yOff + 0.28, 0]);
                addDetail('udder', [0.17, 0.12, 0.16], '#c98e91', [0, model.body.yOff - model.body.size[1] / 2 - 0.035, 0]);
            } else if (detailed && mob.type === 'wolf') {
                addDetail('muzzle', [0.19, 0.15, 0.22], '#c4c0b3', [0, model.head.yOff - 0.07, model.head.size[2] / 2 + 0.09]);
                addDetail('ear_l', [0.1, 0.16, 0.12], '#8c887e', [-0.11, model.head.yOff + 0.2, -0.02]);
                addDetail('ear_r', [0.1, 0.16, 0.12], '#8c887e', [0.11, model.head.yOff + 0.2, -0.02]);
                addDetail('tail', [0.12, 0.13, 0.3], '#aaa79b', [0, model.body.yOff + 0.05, -model.body.size[2] / 2 - 0.1]);
            } else if (detailed && mob.type === 'chicken') {
                addDetail('beak', [0.13, 0.09, 0.14], '#e9a52c', [0, model.head.yOff - 0.07, model.head.size[2] / 2 + 0.06]);
                addDetail('wattle', [0.06, 0.11, 0.045], '#c93630', [0, model.head.yOff - 0.2, model.head.size[2] / 2 + 0.025]);
                addDetail('wing_l', [0.1, 0.2, 0.22], '#d8d8d0', [-0.19, model.body.yOff, 0]);
                addDetail('wing_r', [0.1, 0.2, 0.22], '#d8d8d0', [0.19, model.body.yOff, 0]);
            } else if (detailed && mob.type === 'sheep') {
                addDetail('wool_fleece', [model.body.size[0] + 0.1, model.body.size[1] + 0.08, model.body.size[2] + 0.1], '#f0f0e8', [0, model.body.yOff, 0]);
            }

            // Health bar
            const healthPct = (mob.health ?? 20) / (mob.maxHealth ?? 20);
            if (detailed && healthPct < 1) {
                meshes.push(
                    <group key="hbar" position={[0, model.head.yOff + 0.5, 0]}>
                        <mesh geometry={getGeo(0.6, 0.06, 0.02)}
                            material={getMat('#333333')} // Shared is fine for health bar
                            position={[0, 0, 0]} />
                        <mesh geometry={getGeo(0.56 * healthPct, 0.04, 0.025)}
                            material={getMat(healthPct > 0.5 ? '#44ff44' : healthPct > 0.25 ? '#ffff44' : '#ff4444')}
                            position={[-(0.56 * (1 - healthPct)) / 2, 0, 0.005]} />
                    </group>
                );
            }

            return (
                <group key={mob.id || i} position={[mob.pos[0], mob.pos[1], mob.pos[2]]}>
                    {meshes}
                </group>
            );
        });
    }, [visualSignature]);

    return <group ref={groupRef}>{mobMeshes}</group>;
};

export default MobRenderer;
