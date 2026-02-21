/**
 * Weather System
 * 
 * Renders environmental effects like Rain and Snow using InstancedMesh for performance.
 * Particles follow the player to create a localized bubble of weather.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';

const PARTICLE_COUNT = 4000;
const RADIUS = 40; // Bubble radius around player
const HEIGHT = 50;

const Weather: React.FC = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const weather = useGameStore((s) => s.weather);
    const intensity = useGameStore((s) => s.weatherIntensity);
    const playerPos = useGameStore((s) => s.playerPos);

    // Initial random positions
    const particles = useMemo(() => {
        const data = new Float32Array(PARTICLE_COUNT * 3);
        const velocities = new Float32Array(PARTICLE_COUNT);
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            data[i * 3] = (Math.random() - 0.5) * RADIUS * 2;
            data[i * 3 + 1] = Math.random() * HEIGHT;
            data[i * 3 + 2] = (Math.random() - 0.5) * RADIUS * 2;
            velocities[i] = 15 + Math.random() * 10; // Fall speed
        }
        return { positions: data, velocities };
    }, []);

    const dummy = new THREE.Object3D();

    useFrame((_, delta) => {
        if (!meshRef.current || weather === 'clear') return;

        const mesh = meshRef.current;
        const [px, py, pz] = playerPos;
        const isRain = weather === 'rain' || weather === 'thunder';

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            // Update relative position
            particles.positions[i * 3 + 1] -= particles.velocities[i] * delta;

            // Wrap vertically
            if (particles.positions[i * 3 + 1] < -10) {
                particles.positions[i * 3 + 1] = HEIGHT;
                // Randomize XZ on reset to maintain spread
                particles.positions[i * 3] = (Math.random() - 0.5) * RADIUS * 2;
                particles.positions[i * 3 + 2] = (Math.random() - 0.5) * RADIUS * 2;
            }

            // World position = Player + Offset
            const wx = px + particles.positions[i * 3];
            const wy = py + particles.positions[i * 3 + 1];
            const wz = pz + particles.positions[i * 3 + 2];

            dummy.position.set(wx, wy, wz);

            // Thin vertical line for rain, small flake for snow?
            if (isRain) {
                dummy.scale.set(0.02, 0.4, 0.02);
            } else {
                dummy.scale.set(0.1, 0.1, 0.1);
            }

            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }

        mesh.instanceMatrix.needsUpdate = true;
        // Adjust entire visibility if needed (e.g. by instance count)
        mesh.count = Math.floor(PARTICLE_COUNT * intensity);
    });

    if (weather === 'clear') return null;

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]} frustumCulled={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color={weather === 'rain' || weather === 'thunder' ? "#4488ff" : "#ffffff"} transparent opacity={0.6} />
        </instancedMesh>
    );
};

export default Weather;
