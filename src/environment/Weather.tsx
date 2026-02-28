/**
 * Weather System — Enhanced
 *
 * Renders rain/snow as InstancedMesh for performance.
 * Thunder: random lightning flash via DOM overlay.
 * Snow: slow, drifting white flakes.
 * Rain: slanted streaks with wind drift.
 */

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';

const RAIN_COUNT = 12000;
const SNOW_COUNT = 4000;
const RADIUS = 96;
const HEIGHT = 64;

// ─── Thunder Flash ─────────────────────────────────────────
const ThunderFlash: React.FC = () => {
    const [flash, setFlash] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const scheduleNext = () => {
            // Random 8-28s between strikes
            const delay = 8000 + Math.random() * 20000;
            timerRef.current = setTimeout(() => {
                setFlash(true);
                // Multiple flash pulses (like real lightning)
                setTimeout(() => setFlash(false), 80);
                setTimeout(() => setFlash(true), 150);
                setTimeout(() => setFlash(false), 230);
                setTimeout(() => {
                    setFlash(true);
                    setTimeout(() => setFlash(false), 120);
                }, 380);
                scheduleNext();
            }, delay);
        };
        scheduleNext();
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, []);

    if (!flash) return null;
    return (
        <Html fullscreen style={{ pointerEvents: 'none', zIndex: 999 }}>
            <div style={{
                position: 'fixed', inset: 0,
                background: 'rgba(200, 220, 255, 0.35)',
                pointerEvents: 'none',
                animation: 'none',
            }} />
        </Html>
    );
};

// ─── Rain / Snow 3D Particles ─────────────────────────────
const WeatherParticles: React.FC = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const weather = useGameStore((s) => s.weather);
    const intensity = useGameStore((s) => s.weatherIntensity);
    const playerPos = useGameStore((s) => s.playerPos);
    const isSnow = false; // Could be biome-based; reserved for future
    const count = isSnow ? SNOW_COUNT : RAIN_COUNT;

    const particles = useMemo(() => {
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count);
        const drifts = new Float32Array(count * 2); // wind X, Z drift per particle

        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * RADIUS * 2;
            positions[i * 3 + 1] = Math.random() * HEIGHT;
            positions[i * 3 + 2] = (Math.random() - 0.5) * RADIUS * 2;
            // Rain falls 12-22 blocks/s, snow 1.5-3
            velocities[i] = isSnow ? 1.5 + Math.random() * 1.5 : 12 + Math.random() * 10;
            // Subtle wind: every particle has slightly different horizontal drift
            drifts[i * 2] = (Math.random() - 0.5) * 0.8;
            drifts[i * 2 + 1] = (Math.random() - 0.5) * 0.8;
        }
        return { positions, velocities, drifts };
    }, [count, isSnow]);

    const dummy = useMemo(() => new THREE.Object3D(), []);

    useFrame((_, delta) => {
        if (!meshRef.current || weather === 'clear') return;

        const mesh = meshRef.current;
        const [px, py, pz] = playerPos;
        const dt = Math.min(delta, 0.05);

        for (let i = 0; i < count; i++) {
            // Vertical fall
            particles.positions[i * 3 + 1] -= particles.velocities[i] * dt;
            // Wind drift
            particles.positions[i * 3] += particles.drifts[i * 2] * dt * 2;
            particles.positions[i * 3 + 2] += particles.drifts[i * 2 + 1] * dt * 2;

            if (particles.positions[i * 3 + 1] < -10) {
                particles.positions[i * 3 + 1] = HEIGHT;
                particles.positions[i * 3] = (Math.random() - 0.5) * RADIUS * 2;
                particles.positions[i * 3 + 2] = (Math.random() - 0.5) * RADIUS * 2;
            }

            dummy.position.set(
                px + particles.positions[i * 3],
                py + particles.positions[i * 3 + 1],
                pz + particles.positions[i * 3 + 2],
            );

            if (isSnow) {
                dummy.scale.set(0.12, 0.12, 0.12);
                dummy.rotation.y += delta;
            } else {
                // Rain: tall thin streak, slight wind tilt
                dummy.scale.set(0.015, 0.55, 0.015);
                dummy.rotation.z = 0.08; // slight slant
            }

            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }

        mesh.instanceMatrix.needsUpdate = true;
        mesh.count = Math.floor(count * Math.min(1, intensity));
    });

    if (weather === 'clear') return null;

    const rainColor = weather === 'thunder' ? '#99aacc' : '#8aaee0';
    return (
        <instancedMesh
            ref={meshRef}
            args={[undefined, undefined, count]}
            frustumCulled={false}
        >
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial
                color={isSnow ? '#ffffff' : rainColor}
                transparent
                opacity={isSnow ? 0.85 : 0.55}
                depthWrite={false}
            />
        </instancedMesh>
    );
};

// ─── Main Weather component ─────────────────────────────────
const Weather: React.FC = () => {
    const weather = useGameStore((s) => s.weather);

    return (
        <>
            <WeatherParticles />
            {weather === 'thunder' && <ThunderFlash />}
        </>
    );
};

export default Weather;
