/**
 * Day/Night Cycle (Enhanced for PBR)
 *
 * Improved lighting for MeshStandardMaterial:
 *   - Stronger directional light with color temperature
 *   - Ambient light varies with time
 *   - Fog color matches sky
 *   - Sun/Moon with smooth transitions
 *   - 20 minute real-time cycle (matching MC)
 */

import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';

const CYCLE_SECONDS = 20 * 60;

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function lerpColor(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
    return new THREE.Color(lerp(a.r, b.r, t), lerp(a.g, b.g, t), lerp(a.b, b.b, t));
}

const DayNightCycle: React.FC = () => {
    const dayTime = useGameStore((s) => s.dayTime);
    const setDayTime = useGameStore((s) => s.setDayTime);
    const dirLightRef = useRef<THREE.DirectionalLight>(null);
    const ambLightRef = useRef<THREE.AmbientLight>(null);
    const hemiRef = useRef<THREE.HemisphereLight>(null);
    const { scene } = useThree();

    // Color palette
    const sunColors = useMemo(() => ({
        day: new THREE.Color('#fff5e0'),
        dawn: new THREE.Color('#ff9944'),
        dusk: new THREE.Color('#ff6633'),
        night: new THREE.Color('#223366'),
        moonlight: new THREE.Color('#8899bb'),
    }), []);

    const skyColors = useMemo(() => ({
        day: new THREE.Color('#3b82f6'), // Richer, deeper blue for cloud contrast
        dawn: new THREE.Color('#cc7744'),
        night: new THREE.Color('#0a0a1a'),
    }), []);

    useFrame((_, delta) => {
        const t = (dayTime + delta / CYCLE_SECONDS) % 1;
        setDayTime(t);

        // Calculate sun progress: 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk
        const angle = t * Math.PI * 2;
        const sunX = Math.cos(angle) * 150;
        const sunY = Math.sin(angle) * 150;
        const isNight = t > 0.75 || t < 0.25;
        const isDawn = t > 0.2 && t < 0.35;
        const isDusk = t > 0.65 && t < 0.8;

        // Sun height factor (0 = horizon, 1 = zenith)
        const sunFactor = Math.max(0, Math.sin(angle));

        // ─── Directional Light ───────────────────────────
        if (dirLightRef.current) {
            dirLightRef.current.position.set(sunX, Math.max(10, sunY), 50);
            let color: THREE.Color;
            let intensity: number;

            if (isNight) {
                color = sunColors.moonlight;
                intensity = 0.15;
            } else if (isDawn) {
                const p = (t - 0.2) / 0.15;
                color = lerpColor(sunColors.night, sunColors.dawn, p);
                intensity = lerp(0.15, 0.4, p);
            } else if (isDusk) {
                const p = (t - 0.65) / 0.15;
                color = lerpColor(sunColors.dusk, sunColors.night, p);
                intensity = lerp(0.4, 0.15, p);
            } else {
                color = sunColors.day;
                // Stronger sunlight for PBR MeshStandardMaterial
                intensity = 0.6 + sunFactor * 0.5;
            }

            dirLightRef.current.color.copy(color);
            dirLightRef.current.intensity = intensity;
        }

        // ─── Ambient Light ───────────────────────────────
        if (ambLightRef.current) {
            ambLightRef.current.intensity = isNight ? 0.15 : lerp(0.3, 0.6, sunFactor);
            ambLightRef.current.color.copy(isNight ? skyColors.night : skyColors.day);
        }

        // ─── Hemisphere Light ────────────────────────────
        if (hemiRef.current) {
            if (isNight) {
                hemiRef.current.color.set('#0a0a2a');
                hemiRef.current.groundColor.set('#221111');
                hemiRef.current.intensity = 0.1;
            } else {
                hemiRef.current.color.copy(isDawn ? skyColors.dawn : skyColors.day);
                hemiRef.current.groundColor.set('#553322');
                hemiRef.current.intensity = 0.25 + sunFactor * 0.2;
            }
        }

        // ─── Fog Color Sync ──────────────────────────────
        const isUnderwater = useGameStore.getState().isUnderwater;
        if (scene.fog && scene.fog instanceof THREE.Fog) {
            if (isUnderwater) {
                scene.fog.color.set('#0a2860');
                scene.fog.near = 1;
                scene.fog.far = 25;
            } else {
                const fogColor = isNight ? skyColors.night :
                    isDawn ? lerpColor(skyColors.night, skyColors.dawn, ((t - 0.2) / 0.15)) :
                        isDusk ? lerpColor(skyColors.day, skyColors.night, ((t - 0.65) / 0.15)) :
                            skyColors.day;
                scene.fog.color.copy(fogColor);
                scene.fog.near = isNight ? 30 : 60;
                scene.fog.far = isNight ? 140 : 280;
            }
        }
    });

    const angle = dayTime * Math.PI * 2;
    const sunX = Math.cos(angle) * 150;
    const sunY = Math.sin(angle) * 150;
    const isNight = dayTime > 0.75 || dayTime < 0.25;

    return (
        <>
            <Sky
                sunPosition={[sunX, sunY, 50]}
                turbidity={isNight ? 0 : 1}
                rayleigh={isNight ? 0 : 0.5}
                mieCoefficient={0.005}
                mieDirectionalG={0.7}
            />
            {isNight && <Stars radius={300} depth={50} count={7000} factor={4} saturation={0} fade speed={1} />}
            <ambientLight ref={ambLightRef} intensity={0.4} />
            <directionalLight
                ref={dirLightRef}
                position={[sunX, sunY, 50]}
                intensity={0.8}
                castShadow={true}
                shadow-bias={-0.001}
                shadow-mapSize={[2048, 2048]}
            >
                <orthographicCamera attach="shadow-camera" args={[-128, 128, 128, -128, 1, 500]} />
            </directionalLight>
            <hemisphereLight ref={hemiRef} args={['#87ceeb', '#553322', 0.3]} />
        </>
    );
};

export default DayNightCycle;
