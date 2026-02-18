/**
 * Mob Renderer — 3D rendering for all mobs using InstancedMesh
 *
 * Renders box-based mob models with correct colors, rotation, and health bars.
 * Also runs the mob update loop each frame.
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';
import { updateMobs, MOB_STATS, type Mob, type MobType } from './MobSystem';

// Mob body dimensions (width, height, depth)
const MOB_SIZES: Record<MobType, [number, number, number]> = {
    zombie: [0.6, 1.8, 0.6],
    skeleton: [0.6, 1.8, 0.6],
    creeper: [0.6, 1.7, 0.6],
    pig: [0.9, 0.9, 0.6],
    cow: [0.9, 1.4, 0.6],
    sheep: [0.9, 1.2, 0.6],
};

const MobRenderer: React.FC = () => {
    const groupRef = useRef<THREE.Group>(null);
    const meshRefs = useRef<Map<string, THREE.Mesh>>(new Map());

    // Update mob AI every frame
    useFrame((_, delta) => {
        const clampedDelta = Math.min(delta, 0.1); // Cap to prevent huge jumps
        updateMobs(clampedDelta);
    });

    const mobs = useGameStore((s) => s.mobs) as Mob[];

    // Create materials per mob type (memoized)
    const materials = useMemo(() => {
        const mats: Record<string, THREE.MeshLambertMaterial> = {};
        for (const [type, stats] of Object.entries(MOB_STATS)) {
            mats[type] = new THREE.MeshLambertMaterial({
                color: new THREE.Color(stats.color),
            });
            // Hurt version (red tint)
            mats[`${type}_hurt`] = new THREE.MeshLambertMaterial({
                color: new THREE.Color('#ff3333'),
            });
        }
        return mats;
    }, []);

    // Create geometries per mob type (memoized)
    const geometries = useMemo(() => {
        const geos: Record<string, THREE.BoxGeometry> = {};
        for (const [type, size] of Object.entries(MOB_SIZES)) {
            geos[type] = new THREE.BoxGeometry(size[0], size[1], size[2]);
        }
        return geos;
    }, []);

    // Cleanup
    useEffect(() => {
        return () => {
            for (const mat of Object.values(materials)) mat.dispose();
            for (const geo of Object.values(geometries)) geo.dispose();
        };
    }, [materials, geometries]);

    if (mobs.length === 0) return null;

    return (
        <group ref={groupRef}>
            {mobs.map((mob) => {
                const size = MOB_SIZES[mob.type];
                const isHurt = mob.hurtTimer > 0;
                const matKey = isHurt ? `${mob.type}_hurt` : mob.type;

                return (
                    <group
                        key={mob.id}
                        position={[mob.pos[0], mob.pos[1] + size[1] / 2, mob.pos[2]]}
                        rotation={[0, mob.rotation, 0]}
                    >
                        {/* Body */}
                        <mesh
                            geometry={geometries[mob.type]}
                            material={materials[matKey]}
                            castShadow
                        />

                        {/* Eyes (hostile mobs) */}
                        {MOB_STATS[mob.type].hostile && (
                            <>
                                <mesh position={[-0.15, size[1] * 0.3, -size[2] / 2 - 0.01]}>
                                    <boxGeometry args={[0.1, 0.1, 0.02]} />
                                    <meshBasicMaterial color={mob.type === 'creeper' ? '#000000' : '#ff0000'} />
                                </mesh>
                                <mesh position={[0.15, size[1] * 0.3, -size[2] / 2 - 0.01]}>
                                    <boxGeometry args={[0.1, 0.1, 0.02]} />
                                    <meshBasicMaterial color={mob.type === 'creeper' ? '#000000' : '#ff0000'} />
                                </mesh>
                            </>
                        )}

                        {/* Creeper fuse glow */}
                        {mob.type === 'creeper' && mob.fuseTimer > 0 && (
                            <mesh>
                                <boxGeometry args={[size[0] + 0.1, size[1] + 0.1, size[2] + 0.1]} />
                                <meshBasicMaterial
                                    color="#ffffff"
                                    transparent
                                    opacity={0.3 + Math.sin(mob.fuseTimer * 0.01) * 0.3}
                                />
                            </mesh>
                        )}

                        {/* Health bar (only show when damaged) */}
                        {mob.health < mob.maxHealth && (
                            <group position={[0, size[1] / 2 + 0.3, 0]}>
                                {/* Background */}
                                <mesh>
                                    <planeGeometry args={[0.8, 0.1]} />
                                    <meshBasicMaterial color="#333333" />
                                </mesh>
                                {/* Health fill */}
                                <mesh position={[-(0.8 - (0.8 * mob.health / mob.maxHealth)) / 2, 0, 0.001]}>
                                    <planeGeometry args={[0.8 * mob.health / mob.maxHealth, 0.08]} />
                                    <meshBasicMaterial color={mob.health > mob.maxHealth * 0.3 ? '#44ff44' : '#ff4444'} />
                                </mesh>
                            </group>
                        )}
                    </group>
                );
            })}
        </group>
    );
};

export default MobRenderer;
