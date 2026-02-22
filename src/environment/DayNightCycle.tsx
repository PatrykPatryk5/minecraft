import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';

const CYCLE_SECONDS = 20 * 60;

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

function lerpColor(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
    return new THREE.Color(lerp(a.r, b.r, t), lerp(a.g, b.g, t), lerp(a.b, b.b, t));
}

const DayNightCycle: React.FC = () => {
    const graphics = useGameStore((s) => s.settings.graphics);
    const renderDist = useGameStore((s) => s.settings.renderDistance);
    const brightness = useGameStore((s) => s.settings.brightness || 0.5);
    const currentDim = useGameStore((s) => s.dimension);
    const brightnessMultiplier = 0.95 + brightness * 1.6;
    const useShadows = graphics !== 'fast';
    const shadowMapSize = graphics === 'fabulous' ? 4096 : 2048;

    const dirLightRef = useRef<THREE.DirectionalLight>(null);
    const ambLightRef = useRef<THREE.AmbientLight>(null);
    const hemiRef = useRef<THREE.HemisphereLight>(null);
    const shadowFrustumRef = useRef(0);
    const { scene } = useThree();

    const timeRef = useRef(useGameStore.getState().dayTime);
    const lastStoreUpdate = useRef(0);
    const [uiTime, setUiTime] = React.useState(timeRef.current);

    const sunColors = useMemo(() => ({
        day: new THREE.Color('#fff5e0'),
        dawn: new THREE.Color('#ff9944'),
        moonlight: new THREE.Color('#8899bb'),
    }), []);

    const skyColors = useMemo(() => ({
        day: new THREE.Color('#356296'),
        dawn: new THREE.Color('#884422'),
        night: new THREE.Color('#080812'),
        storm: new THREE.Color('#444a55'),
    }), []);

    const weather = useGameStore((s) => s.weather);
    const weatherIntensity = useGameStore((s) => s.weatherIntensity);

    useFrame((_, delta) => {
        const safeDelta = Math.min(delta, 0.1);
        timeRef.current = (timeRef.current + safeDelta / CYCLE_SECONDS) % 1;
        const t = timeRef.current;

        lastStoreUpdate.current += safeDelta;
        if (lastStoreUpdate.current > 0.1) {
            lastStoreUpdate.current = 0;
            const state = useGameStore.getState();
            const isClient = state.isMultiplayer && (window as any).isMPClient;

            if (isClient) {
                // Clients just follow the store
                timeRef.current = state.dayTime;
            } else {
                // Host or Single Player advances time and updates store
                const storeTime = state.dayTime;
                // Use a small epsilon to detect manual jumps (like /time set)
                if (Math.abs(t - storeTime) > 0.02) {
                    timeRef.current = storeTime;
                } else {
                    state.setDayTime(t);
                }
            }
            setUiTime(timeRef.current);
        }

        const angle = t * Math.PI * 2;
        const sunX = Math.cos(angle) * 150;
        const sunY = Math.sin(angle) * 150;
        const sunZ = Math.sin(angle + Math.PI * 0.5) * 150;

        const isOverworld = currentDim === 'overworld';

        const sunHeight = Math.sin(angle);
        const daylight = smoothstep(-0.1, 0.12, sunHeight);
        const isNight = daylight < 0.08;
        const dawnFactor = Math.max(0, 1 - Math.abs(t - 0.25) / 0.12);
        const duskFactor = Math.max(0, 1 - Math.abs(t - 0.75) / 0.12);
        const twilight = Math.max(dawnFactor, duskFactor);

        if (dirLightRef.current) {
            const playerPos = useGameStore.getState().playerPos;
            const px = playerPos[0];
            const py = playerPos[1];
            const pz = playerPos[2];

            const shadowFrustum = Math.min(220, Math.max(96, renderDist * 14));
            const shadowTexel = (shadowFrustum * 2) / shadowMapSize;
            const snappedX = Math.round((px + sunX) / shadowTexel) * shadowTexel;
            const snappedZ = Math.round((pz + sunZ) / shadowTexel) * shadowTexel;

            dirLightRef.current.position.set(snappedX, Math.max(py + 12, py + sunY), snappedZ);
            dirLightRef.current.target.position.set(px, py - 10, pz);
            dirLightRef.current.target.updateMatrixWorld();
            dirLightRef.current.castShadow = useShadows && daylight > 0.08 && isOverworld;
            dirLightRef.current.visible = isOverworld;

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

            const baseColor = lerpColor(sunColors.moonlight, sunColors.day, daylight);
            const warmTint = lerpColor(baseColor, sunColors.dawn, twilight * 0.45);
            dirLightRef.current.color.copy(warmTint);
            const weatherFactor = 1.0 - (weatherIntensity * 0.35);
            const sunIntensity = lerp(0.03, 1.0, daylight) + twilight * 0.08;
            dirLightRef.current.intensity = sunIntensity * weatherFactor * brightnessMultiplier;
        }

        if (ambLightRef.current) {
            if (currentDim === 'nether') {
                ambLightRef.current.intensity = 0.4 * brightnessMultiplier;
                ambLightRef.current.color.set('#411');
            } else if (currentDim === 'end') {
                ambLightRef.current.intensity = 0.3 * brightnessMultiplier;
                ambLightRef.current.color.set('#212');
            } else {
                ambLightRef.current.intensity = lerp(0.08, 0.3, daylight) * brightnessMultiplier;
                ambLightRef.current.color.copy(lerpColor(skyColors.night, skyColors.day, daylight));
            }
        }

        if (hemiRef.current) {
            hemiRef.current.color.copy(lerpColor(skyColors.night, skyColors.day, daylight));
            hemiRef.current.groundColor.set('#553322');
            hemiRef.current.intensity = lerp(0.015, 0.11, daylight) * brightnessMultiplier;
        }

        const isUnderwater = useGameStore.getState().isUnderwater;
        if (scene.fog && scene.fog instanceof THREE.Fog) {
            if (isUnderwater) {
                scene.fog.color.set('#0a2860');
                scene.fog.near = 1;
                scene.fog.far = 25;
            } else {
                let fogColor = lerpColor(skyColors.night, skyColors.day, daylight);
                fogColor = lerpColor(fogColor, skyColors.dawn, twilight * 0.4);

                if (weather !== 'clear') {
                    fogColor = lerpColor(fogColor, skyColors.storm, weatherIntensity);
                }
                scene.fog.color.copy(fogColor);

                const maxFog = renderDist * 16;
                scene.fog.near = lerp(maxFog * 0.45, maxFog * 0.82, daylight);
                scene.fog.far = maxFog;
            }
        }

        // Keep UI stars transition smooth enough without per-frame React re-renders.
        if (isNight && uiTime >= 0.25 && uiTime <= 0.75) {
            setUiTime(t);
        }
    });

    const angle = uiTime * Math.PI * 2;
    const sunX = Math.cos(angle) * 150;
    const sunY = Math.sin(angle) * 150;
    const sunZ = Math.sin(angle + Math.PI * 0.5) * 150;
    const daylightUi = smoothstep(-0.1, 0.12, Math.sin(angle));
    const isNightUi = daylightUi < 0.08;
    const initialShadowFrustum = Math.min(220, Math.max(96, renderDist * 14));

    return (
        <>
            {currentDim === 'overworld' && (
                <Sky
                    sunPosition={[sunX, sunY, sunZ]}
                    turbidity={isNightUi ? 0 : 3}
                    rayleigh={isNightUi ? 0 : 0.3}
                    mieCoefficient={0.005}
                    mieDirectionalG={0.8}
                />
            )}
            {isNightUi && currentDim === 'overworld' && <Stars radius={300} depth={50} count={7000} factor={4} saturation={0} fade speed={1} />}
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
