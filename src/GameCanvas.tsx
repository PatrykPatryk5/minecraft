import React, { Suspense } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import World from './world/World';
import Player from './player/Player';
import DayNightCycle from './environment/DayNightCycle';
import Clouds from './environment/Clouds';
import TorchLights from './environment/TorchLights';
import HandheldLight from './environment/HandheldLight';
import EnchantingTables from './environment/EnchantingTables';
import BlockParticles from './effects/BlockParticles';
import MobRenderer from './mobs/MobRenderer';
import { MultiplayerRenderer } from './multiplayer/MultiplayerRenderer';
import Weather from './environment/Weather';
import useGameStore from './store/gameStore';
import DroppedItemsManager from './entities/DroppedItems';
import FallingBlocksManager from './entities/FallingBlocks';
import ArrowsManager from './entities/Arrows';
import TNTManager from './entities/TNTPrimed';
import { ThrowablesManager } from './entities/Throwables';
import SafeModule from './ui/SafeModule';

type GraphicsQuality = ReturnType<typeof useGameStore.getState>['settings']['graphics'];

function SceneContent() {
    const dimension = useGameStore((s) => s.dimension);
    const graphics = useGameStore((s) => s.settings.graphics);

    return (
        <>
            <DayNightCycle />
            {/* Fixed-step simulation keeps collisions and rigid-body motion stable
                when the render frame rate changes; interpolation hides the steps. */}
            <Physics timeStep={1 / 60} interpolate numSolverIterations={10}>
                <World />
                <Player />
                <SafeModule name="MobRenderer"><MobRenderer /></SafeModule>
                <SafeModule name="MultiplayerRenderer"><MultiplayerRenderer /></SafeModule>
                <SafeModule name="DroppedItems"><DroppedItemsManager /></SafeModule>
                <SafeModule name="FallingBlocks"><FallingBlocksManager /></SafeModule>
                <SafeModule name="Arrows"><ArrowsManager /></SafeModule>
                <SafeModule name="TNT"><TNTManager /></SafeModule>
                <SafeModule name="Throwables"><ThrowablesManager /></SafeModule>
            </Physics>
            {dimension === 'overworld' && <SafeModule name="Clouds"><Clouds /></SafeModule>}
            {dimension === 'overworld' && <SafeModule name="Weather"><Weather /></SafeModule>}
            <SafeModule name="TorchLights"><TorchLights /></SafeModule>
            <SafeModule name="HandheldLight"><HandheldLight /></SafeModule>
            <SafeModule name="EnchantingTables"><EnchantingTables /></SafeModule>
            <SafeModule name="BlockParticles"><BlockParticles /></SafeModule>
        </>
    );
}

export default function GameCanvas({ fov, graphics }: { fov: number; graphics: GraphicsQuality }) {
    const useShadows = graphics === 'fancy' || graphics === 'fabulous';

    return (
        <Canvas
            camera={{ fov, near: 0.1, far: 1000, position: [0, 80, 0] }}
            gl={async (props) => {
                const { WebGPURenderer } = await import('three/webgpu');
                const renderer = new WebGPURenderer({
                    ...props,
                    antialias: graphics === 'fancy' || graphics === 'fabulous',
                    // powerPreference is ignored on Windows WebGPU (crbug.com/369219127)
                    stencil: false,
                    depth: true,
                    alpha: false,
                    forceWebGL: false,
                } as any);
                await renderer.init();
                const backend = (renderer as any).backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL2 fallback';
                console.info(`[MC R3F] Active graphics backend: ${backend}`);
                (globalThis as any).__minecraftRendererBackend = backend;
                return renderer as unknown as THREE.WebGLRenderer;
            }}
            shadows={useShadows ? { type: graphics === 'fabulous' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap } : false}
            dpr={graphics === 'potato' ? [0.75, 0.75] : graphics === 'fabulous' ? [1, Math.min(window.devicePixelRatio, 2)] : [1, 1]}
            style={{ width: '100%', height: '100%' }}
            onContextMenu={(e) => e.preventDefault()}
            frameloop="always"
            performance={{ min: 0.5 }}
            onCreated={({ gl }) => {
                gl.outputColorSpace = THREE.SRGBColorSpace;
                gl.toneMapping = graphics === 'fast' ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
                gl.toneMappingExposure = graphics === 'fabulous' ? 1.06 : 1.0;
                gl.shadowMap.enabled = useShadows;
                if (useShadows) {
                    gl.shadowMap.type = graphics === 'fabulous' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
                }
            }}
        >
            <Suspense fallback={null}><SceneContent /></Suspense>
        </Canvas>
    );
}
