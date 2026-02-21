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
    const brightness = useGameStore((s) => s.settings.brightness || 0.5);
    const brightnessMultiplier = 0.7 + brightness * 1.5;
    const useShadows = graphics !== 'fast';
    const shadowMapSize = graphics === 'fabulous' ? 4096 : 2048;
    const dirLightRef = useRef<THREE.DirectionalLight>(null);
    const ambLightRef = useRef<THREE.AmbientLight>(null);
    const hemiRef = useRef<THREE.HemisphereLight>(null);
    const shadowFrustumRef = useRef(0);
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
        storm: new THREE.Color('#444a55'),
    }), []);

    const weather = useGameStore((s) => s.weather);
    const weatherIntensity = useGameStore((s) => s.weatherIntensity);

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
        const sunZ = Math.sin(angle + Math.PI * 0.5) * 150;
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

            const shadowFrustum = Math.min(220, Math.max(96, renderDist * 14));
            const shadowTexel = (shadowFrustum * 2) / shadowMapSize;
            const snappedX = Math.round((px + sunX) / shadowTexel) * shadowTexel;
            const snappedZ = Math.round((pz + sunZ) / shadowTexel) * shadowTexel;

            dirLightRef.current.position.set(snappedX, Math.max(12, sunY), snappedZ);
            dirLightRef.current.target.position.set(px, 0, pz);
            dirLightRef.current.target.updateMatrixWorld();

            if (useShadows) {
                const shadow = dirLightRef.current.shadow;
                if (shadow.mapSize.x !== shadowMapSize || shadow.mapSize.y !== shadowMapSize) {
                    shadow.mapSize.set(shadowMapSize, shadowMapSize);
                    shadow.needsUpdate = true;
                }
                if (shadowFrustumRef.current !== shadowFrustum) {
                    const cam = shadow.camera as THREE.OrthographicCamera;
                    cam.left = -shadowFrustum;
                    cam.right = shadowFrustum;
                    cam.top = shadowFrustum;
                    cam.bottom = -shadowFrustum;
                    cam.near = 1;
                    cam.far = 520;
                    cam.updateProjectionMatrix();
                    shadowFrustumRef.current = shadowFrustum;
                    shadow.needsUpdate = true;
                }
            }

            let color: THREE.Color;
            let intensity: number;

            if (isNight) {
                color = sunColors.moonlight;
                intensity = 0.03;
            } else if (isDawn) {
                const p = (t - 0.2) / 0.15;
                color = lerpColor(sunColors.night, sunColors.dawn, p);
                intensity = lerp(0.08, 0.45, p);
            } else if (isDusk) {
                const p = (t - 0.65) / 0.15;
                color = lerpColor(sunColors.dusk, sunColors.night, p);
                intensity = lerp(0.45, 0.08, p);
            } else {
                color = sunColors.day;
                intensity = 0.55 + sunFactor * 0.45;
            }

            dirLightRef.current.color.copy(color);
            // Darken world during rain
            const weatherFactor = 1.0 - (weatherIntensity * 0.35);
            dirLightRef.current.intensity = intensity * weatherFactor * brightnessMultiplier;
        }

        // ─── Ambient Light ───────────────────────────────
        if (ambLightRef.current) {
            ambLightRef.current.intensity = (isNight ? 0.08 : lerp(0.16, 0.28, sunFactor)) * brightnessMultiplier;
            ambLightRef.current.color.copy(isNight ? skyColors.night : skyColors.day);
        }

        // ─── Hemisphere Light ────────────────────────────
        if (hemiRef.current) {
            if (isNight) {
                hemiRef.current.color.set('#0a0a2a');
                hemiRef.current.groundColor.set('#221111');
                hemiRef.current.intensity = 0.015 * brightnessMultiplier;
            } else {
                hemiRef.current.color.copy(isDawn ? skyColors.dawn : skyColors.day);
                hemiRef.current.groundColor.set('#553322');
                hemiRef.current.intensity = (0.03 + sunFactor * 0.07) * brightnessMultiplier;
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
                let fogColor = isNight ? skyColors.night :
                    isDawn ? lerpColor(skyColors.night, skyColors.dawn, ((t - 0.2) / 0.15)) :
                        isDusk ? lerpColor(skyColors.day, skyColors.night, ((t - 0.65) / 0.15)) :
                            skyColors.day;

                if (weather !== 'clear') {
                    fogColor = lerpColor(fogColor, skyColors.storm, weatherIntensity);
                }
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
    const sunZ = Math.sin(angle + Math.PI * 0.5) * 150;
    const isNightUi = uiTime > 0.75 || uiTime < 0.25;
    const initialShadowFrustum = Math.min(220, Math.max(96, renderDist * 14));

    return (
        <>
            <Sky
                sunPosition={[sunX, sunY, sunZ]}
                turbidity={isNightUi ? 0 : 3}
                rayleigh={isNightUi ? 0 : 0.3}
                mieCoefficient={0.005}
                mieDirectionalG={0.8}
            />
            {isNightUi && <Stars radius={300} depth={50} count={7000} factor={4} saturation={0} fade speed={1} />}
            <ambientLight ref={ambLightRef} intensity={0.5} />
            <directionalLight
                ref={dirLightRef}
                position={[sunX, sunY, sunZ]}
                intensity={0.8}
                castShadow={useShadows}
                shadow-bias={-0.00015}
                shadow-normalBias={0.01}
                shadow-radius={graphics === 'fabulous' ? 2.5 : 2}
                shadow-mapSize={[shadowMapSize, shadowMapSize]}
            >
                <orthographicCamera attach="shadow-camera" args={[-initialShadowFrustum, initialShadowFrustum, initialShadowFrustum, -initialShadowFrustum, 1, 520]} />
            </directionalLight>
            <hemisphereLight ref={hemiRef} args={['#aaccff', '#443322', 0.2]} />
        </>
    );
};

export default DayNightCycle;
