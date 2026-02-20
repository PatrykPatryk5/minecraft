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
    const graphics = useGameStore((s) => s.settings.graphics);
    const renderDist = useGameStore((s) => s.settings.renderDistance);
    const useShadows = graphics !== 'fast';
    const shadowMapSize = graphics === 'fabulous' ? 4096 : 2048;
    const dirLightRef = useRef<THREE.DirectionalLight>(null);
    const ambLightRef = useRef<THREE.AmbientLight>(null);
    const hemiRef = useRef<THREE.HemisphereLight>(null);
    const { scene } = useThree();

    // Internal time state to avoid 60FPS React renders
    const timeRef = useRef(useGameStore.getState().dayTime);
    const lastStoreUpdate = useRef(0);
    const [uiTime, setUiTime] = React.useState(timeRef.current);

    // Color palette
    const sunColors = useMemo(() => ({
        day: new THREE.Color('#fff5e0'),
        dawn: new THREE.Color('#ff9944'),
        dusk: new THREE.Color('#ff6633'),
        night: new THREE.Color('#223366'),
        moonlight: new THREE.Color('#8899bb'),
    }), []);

    const skyColors = useMemo(() => ({
        day: new THREE.Color('#356296'), // Darker, less blinding sky blue
        dawn: new THREE.Color('#884422'),
        night: new THREE.Color('#080812'),
    }), []);

    useFrame((_, delta) => {
        // Prevent massive time jumps on lag spikes
        const safeDelta = Math.min(delta, 0.1);
        timeRef.current = (timeRef.current + safeDelta / CYCLE_SECONDS) % 1;
        const t = timeRef.current;

        lastStoreUpdate.current += safeDelta;
        if (lastStoreUpdate.current > 1.0) {
            lastStoreUpdate.current = 0;
            useGameStore.getState().setDayTime(t);
            setUiTime(t);
        }

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
            const playerPos = useGameStore.getState().playerPos;
            const px = playerPos[0];
            const pz = playerPos[2];

            dirLightRef.current.position.set(px + sunX, Math.max(10, sunY), pz + 50);
            dirLightRef.current.target.position.set(px, 0, pz);
            dirLightRef.current.target.updateMatrixWorld();

            let color: THREE.Color;
            let intensity: number;

            if (isNight) {
                color = sunColors.moonlight;
                intensity = 0.05;
            } else if (isDawn) {
                const p = (t - 0.2) / 0.15;
                color = lerpColor(sunColors.night, sunColors.dawn, p);
                intensity = lerp(0.05, 0.25, p);
            } else if (isDusk) {
                const p = (t - 0.65) / 0.15;
                color = lerpColor(sunColors.dusk, sunColors.night, p);
                intensity = lerp(0.25, 0.05, p);
            } else {
                color = sunColors.day;
                // Keep directional light strong enough for stark shadows
                intensity = 0.7 + sunFactor * 0.4;
            }

            dirLightRef.current.color.copy(color);
            dirLightRef.current.intensity = intensity;
        }

        // ─── Ambient Light ───────────────────────────────
        if (ambLightRef.current) {
            ambLightRef.current.intensity = isNight ? 0.4 : lerp(0.7, 1.0, sunFactor);
            ambLightRef.current.color.copy(isNight ? skyColors.night : skyColors.day);
        }

        // ─── Hemisphere Light ────────────────────────────
        if (hemiRef.current) {
            if (isNight) {
                hemiRef.current.color.set('#0a0a2a');
                hemiRef.current.groundColor.set('#221111');
                hemiRef.current.intensity = 0.02;
            } else {
                hemiRef.current.color.copy(isDawn ? skyColors.dawn : skyColors.day);
                hemiRef.current.groundColor.set('#553322');
                hemiRef.current.intensity = 0.05 + sunFactor * 0.1;
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

                const maxFog = renderDist * 16;
                // Reduce fog density (push near closer to far)
                scene.fog.near = isNight ? maxFog * 0.4 : maxFog * 0.8;
                scene.fog.far = maxFog;
            }
        }
    });

    const angle = uiTime * Math.PI * 2;
    const sunX = Math.cos(angle) * 150;
    const sunY = Math.sin(angle) * 150;
    const isNightUi = uiTime > 0.75 || uiTime < 0.25;

    return (
        <>
            <Sky
                sunPosition={[sunX, sunY, 50]}
                turbidity={isNightUi ? 0 : 3}
                rayleigh={isNightUi ? 0 : 0.3}
                mieCoefficient={0.005}
                mieDirectionalG={0.8}
            />
            {isNightUi && <Stars radius={300} depth={50} count={7000} factor={4} saturation={0} fade speed={1} />}
            <ambientLight ref={ambLightRef} intensity={0.5} />
            <directionalLight
                ref={dirLightRef}
                position={[sunX, sunY, 50]}
                intensity={0.8}
                castShadow={useShadows}
                shadow-bias={-0.0005}
                shadow-normalBias={0.02}
                shadow-mapSize={[shadowMapSize, shadowMapSize]}
            >
                <orthographicCamera attach="shadow-camera" args={[-100, 100, 100, -100, 1, 500]} />
            </directionalLight>
            <hemisphereLight ref={hemiRef} args={['#aaccff', '#443322', 0.2]} />
        </>
    );
};

export default DayNightCycle;
