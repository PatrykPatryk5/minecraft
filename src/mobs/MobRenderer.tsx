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

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';
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
const matCache = new Map<string, THREE.MeshLambertMaterial>();
function getMat(color: string, emissive?: boolean): THREE.MeshLambertMaterial {
    const key = color + (emissive ? '_e' : '');
    let m = matCache.get(key);
    if (!m) {
        m = new THREE.MeshLambertMaterial({
            color: new THREE.Color(color),
            emissive: emissive ? new THREE.Color(0xcc0000) : undefined,
            emissiveIntensity: emissive ? 0.6 : 0,
        });
        matCache.set(key, m);
    }
    return m;
}

const MobRenderer: React.FC = () => {
    const groupRef = useRef<THREE.Group>(null);
    const mobs = useGameStore((s) => s.mobs);

    // Per-mob limb rotation for walk animation
    const limbPhases = useRef<Map<string, number>>(new Map());

    useFrame((_, delta) => {
        const s = useGameStore.getState();
        if (s.isPaused || s.screen !== 'playing') return;

        // Run simulation / spawning / AI
        updateMobs(delta);

        if (!groupRef.current) return;
        const children = groupRef.current.children;

        for (let i = 0; i < mobs.length && i < children.length; i++) {
            const mob = mobs[i];
            const group = children[i] as THREE.Group;
            if (!mob || !group) continue;

            group.position.set(mob.pos[0], mob.pos[1], mob.pos[2]);

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
                phase *= 0.9; // settle
                limbPhases.current.set(id, phase);
            }

            const model = MOB_MODELS[mob.type] || MOB_MODELS.zombie;
            const legSwing = Math.sin(phase) * 0.6;

            // Animate legs
            const legStart = model.arms ? 4 : 2; // skip head(0), body(1), face(2 or none), arms(3/4)
            const faceIdx = model.faceColor ? 2 : -1;
            const armStartIdx = model.arms ? (faceIdx >= 0 ? 3 : 2) : -1;
            let childIdx = faceIdx >= 0 ? 3 : 2;
            if (model.arms) childIdx += 2;

            // Direct leg animation
            for (let li = 0; li < model.legs.count; li++) {
                const legMesh = group.children[childIdx + li] as THREE.Mesh;
                if (legMesh) {
                    const dir = li % 2 === 0 ? 1 : -1;
                    legMesh.rotation.x = legSwing * dir;
                }
            }

            // Arm animation
            if (model.arms && armStartIdx >= 0) {
                for (let ai = 0; ai < 2; ai++) {
                    const armMesh = group.children[(faceIdx >= 0 ? 3 : 2) + ai] as THREE.Mesh;
                    if (armMesh) {
                        armMesh.rotation.x = legSwing * (ai === 0 ? -1 : 1);
                    }
                }
            }

            // Hurt flash - OPTIMIZED: only update the group's userData and let meshes handle it if possible
            // Actually, for simplicity and performance, we can just update the first few children if we know they are meshes
            const isHurt = mob.hurtTime && mob.hurtTime > 0;
            const hurtIntensity = isHurt ? 0.8 : 0;
            const hurtColor = isHurt ? new THREE.Color(0xff0000) : new THREE.Color(0x000000);

            for (let c = 0; c < group.children.length; c++) {
                const child = group.children[c];
                if ((child as any).isMesh) {
                    const m = child as THREE.Mesh;
                    // We check if it's already set to avoid expensive material updates
                    if (m.userData.lastHurt !== isHurt) {
                        m.userData.lastHurt = isHurt;
                        // To avoid sharing materials between mobs when flashing, we need unique materials
                        // But wait, the current implementation uses shared materials. We'll fix this in the memo.
                        const mat = m.material as THREE.MeshLambertMaterial;
                        mat.emissiveIntensity = hurtIntensity;
                        mat.emissive = hurtColor;
                    }
                } else if (child.type === 'Group') { // Handle nested groups (e.g. health bars)
                    // skip health bar for performance
                }
            }
        }
    });

    const mobMeshes = useMemo(() => {
        return mobs.map((mob: any, i: number) => {
            const model = MOB_MODELS[mob.type] || MOB_MODELS.zombie;
            const meshes: React.ReactNode[] = [];

            // Helper to get a cloned material for this specific mob mesh
            const getUniqueMat = (color: string) => {
                const baseMat = getMat(color);
                const mat = baseMat.clone();
                return mat;
            };

            // Head
            meshes.push(
                <mesh key="head" geometry={getGeo(...model.head.size)}
                    material={getUniqueMat(model.head.color)}
                    position={[0, model.head.yOff, 0]} />
            );

            // Body
            meshes.push(
                <mesh key="body" geometry={getGeo(...model.body.size)}
                    material={getUniqueMat(model.body.color)}
                    position={[0, model.body.yOff, 0]} />
            );

            // Face detail (eyes/face)
            if (model.faceColor) {
                meshes.push(
                    <mesh key="face" geometry={getGeo(model.head.size[0] * 0.6, model.head.size[1] * 0.3, 0.01)}
                        material={getUniqueMat(model.faceColor)}
                        position={[0, model.head.yOff, model.head.size[2] / 2 + 0.01]} />
                );
            }

            // Arms (humanoids)
            if (model.arms) {
                const armOff = model.body.size[0] / 2 + model.arms.size[0] / 2;
                meshes.push(
                    <mesh key="arm_l" geometry={getGeo(...model.arms.size)}
                        material={getUniqueMat(model.arms.color)}
                        position={[-armOff, model.arms.yOff, 0]} />
                );
                meshes.push(
                    <mesh key="arm_r" geometry={getGeo(...model.arms.size)}
                        material={getUniqueMat(model.arms.color)}
                        position={[armOff, model.arms.yOff, 0]} />
                );
            }

            // Legs
            const totalWidth = (model.legs.count - 1) * model.legs.spacing;
            for (let li = 0; li < model.legs.count; li++) {
                const lx = model.legs.count <= 2
                    ? (li === 0 ? -model.legs.spacing : model.legs.spacing)
                    : (-totalWidth / 2 + li * model.legs.spacing) * (li < model.legs.count / 2 ? 1 : 1);

                // For 4-legged mobs, position in 2 rows
                let lz = 0;
                if (model.legs.count === 4) {
                    lz = li < 2 ? model.body.size[2] / 2 - 0.05 : -model.body.size[2] / 2 + 0.05;
                }
                const llx = model.legs.count === 4
                    ? (li % 2 === 0 ? -model.legs.spacing : model.legs.spacing)
                    : lx;

                meshes.push(
                    <mesh key={`leg_${li}`}
                        geometry={getGeo(...model.legs.size)}
                        material={getUniqueMat(model.legs.color)}
                        position={[llx, model.legs.yOff + model.legs.size[1] / 2, lz]} />
                );
            }

            // Health bar
            const healthPct = (mob.health ?? 20) / (mob.maxHealth ?? 20);
            if (healthPct < 1) {
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
    }, [mobs]);

    return <group ref={groupRef}>{mobMeshes}</group>;
};

export default MobRenderer;
