/**
 * Main App — Full game with main menu, modes, crafting, inventory.
 */

import React, { Suspense, useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import World from './world/World';
import Player from './player/Player';
import DayNightCycle from './environment/DayNightCycle';
import Clouds from './environment/Clouds';
import TorchLights from './environment/TorchLights';
import BlockParticles from './effects/BlockParticles';
import HUD from './ui/HUD';
import DebugScreen from './ui/DebugScreen';
import PauseMenu from './ui/PauseMenu';
import { EffectComposer, Vignette, SMAA, N8AO } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Physics } from '@react-three/rapier';
import Inventory from './ui/Inventory';
import CraftingScreen from './ui/CraftingScreen';
import FurnaceScreen from './ui/FurnaceScreen';
import ChatBox from './ui/ChatBox';
import DeathScreen from './ui/DeathScreen';
import ErrorBoundary from './ui/ErrorBoundary';
import MainMenu from './ui/MainMenu';
import CreditsScreen from './ui/CreditsScreen';
import KeybindScreen from './ui/KeybindScreen';
import MultiplayerScreen from './ui/MultiplayerScreen';
import MobRenderer from './mobs/MobRenderer';
import { MultiplayerRenderer } from './multiplayer/MultiplayerRenderer';
import Weather from './environment/Weather';
import NetworkHUD from './ui/NetworkHUD';
import useGameStore from './store/gameStore';
import { getRendererCaps, type RendererCapabilities } from './core/renderer';
import { preloadAllTextures } from './core/textures';
import DroppedItemsManager from './entities/DroppedItems';
import FallingBlocksManager from './entities/FallingBlocks';
import ArrowsManager from './entities/Arrows';
import TNTManager from './entities/TNTPrimed';
import PreJoinShield from './ui/PreJoinShield';


const UnderwaterOverlay = () => {
    const isUnderwater = useGameStore((s) => s.isUnderwater);
    if (!isUnderwater) return null;
    return <div className="water-overlay" />;
};

const SceneContent: React.FC = () => {
    const graphics = useGameStore((s) => s.settings.graphics);
    const usePostProcessing = graphics !== 'fast';
    const isFabulous = graphics === 'fabulous';

    const renderDist = useGameStore((s) => s.settings.renderDistance);

    return (
        <>
            <DayNightCycle />
            <Physics>
                <World />
                <Player />
                <MobRenderer />
                <MultiplayerRenderer />
                <DroppedItemsManager />
                <FallingBlocksManager />
                <ArrowsManager />
                <TNTManager />
            </Physics>
            <Clouds />
            <Weather />
            <TorchLights />
            <BlockParticles />

            {usePostProcessing && isFabulous && (
                <EffectComposer multisampling={graphics === 'fabulous' ? 4 : 0}>
                    <N8AO aoRadius={2} intensity={0.8} color="black" />
                    <SMAA edgeDetectionMode={1} />
                    <Vignette eskil={false} offset={0.1} darkness={0.2} />
                </EffectComposer>
            )}
        </>
    );
};

const App: React.FC = () => {
    const fov = useGameStore((s) => s.fov);
    const screen = useGameStore((s) => s.screen);
    const gameMode = useGameStore((s) => s.gameMode);
    const showHUD = useGameStore((s) => s.showHUD);
    const activeOverlay = useGameStore((s) => s.activeOverlay);
    const graphics = useGameStore((s) => s.settings.graphics);
    const useShadows = graphics !== 'fast';
    const [caps, setCaps] = useState<RendererCapabilities | null>(null);
    const [ready, setReady] = useState(false);
    const prevScreenRef = useRef(screen);

    useEffect(() => {
        const init = async () => {
            const detected = await getRendererCaps();
            setCaps(detected);
            console.log(`[MC R3F] Renderer: ${detected.label} | GPU: ${detected.gpuName}`);
            preloadAllTextures();
            setTimeout(() => {
                setReady(true);
                // Smoothly hide HTML loading screen after React is mounted
                requestAnimationFrame(() => {
                    const overlay = document.getElementById('loading-overlay');
                    if (overlay) {
                        overlay.style.pointerEvents = 'none'; // Disable interactions immediately
                        overlay.classList.add('fade-out');
                        setTimeout(() => overlay.remove(), 1000);
                    }
                });
            }, 500);
        };
        init();
    }, []);

    // ─── 100% Game Focus & Shortcut Blocking ────────────────
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            // Block critical browser shortcuts
            const blockedKeys = ['F1', 'F3', 'F5', 'F6', 'F11', 'F12'];
            const isCtrl = e.ctrlKey || e.metaKey;
            const isAlt = e.altKey;

            if (blockedKeys.includes(e.code) || (isCtrl && (e.code === 'KeyR' || e.code === 'KeyS' || e.code === 'KeyP' || e.code === 'KeyF'))) {
                if (screen === 'playing') {
                    e.preventDefault();
                    console.log(`[MC] Blocked shortcut: ${e.code}`);
                }
            }

            if (e.code === 'F1') {
                useGameStore.getState().toggleHUD();
            }
        };

        const onFocus = () => {
            console.log('[MC] Window focused');
            // Resume sound or logic if needed
        };

        const onBlur = () => {
            console.log('[MC] Window blurred - Pausing');
            if (screen === 'playing' && !useGameStore.getState().isPaused) {
                useGameStore.getState().setPaused(true);
            }
        };

        const onClick = () => {
            // Interaction logic handled by PointerLockControls via Canvas
        };

        window.addEventListener('keydown', onKey);
        window.addEventListener('click', onClick);
        window.addEventListener('focus', onFocus);
        window.addEventListener('blur', onBlur);

        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('click', onClick);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('blur', onBlur);
        };
    }, [screen, activeOverlay]);

    if (!ready) return null; // Keep HTML overlay visible

    const isPlaying = screen === 'playing';

    return (
        <ErrorBoundary>
            <MainMenu />
            <KeybindScreen />
            <MultiplayerScreen />
            <PreJoinShield />

            {isPlaying && (
                <Canvas
                    camera={{ fov, near: 0.1, far: 1000, position: [0, 80, 0] }}
                    gl={{
                        antialias: graphics !== 'fast',
                        powerPreference: 'high-performance',
                        stencil: false,
                        depth: true,
                        alpha: false,
                        failIfMajorPerformanceCaveat: false,
                    }}
                    shadows={useShadows ? { type: graphics === 'fabulous' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap } : false}
                    dpr={graphics === 'fabulous' ? [1, Math.min(window.devicePixelRatio, 2)] : [1, 1]}
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
                    <Suspense fallback={null}>
                        <SceneContent />
                    </Suspense>
                </Canvas>
            )}

            {isPlaying && showHUD && (
                <>
                    <HUD />
                    <NetworkHUD />
                    <DebugScreen />
                </>
            )}

            {/* Overlays — always available when playing */}
            {isPlaying && <PauseMenu />}
            {isPlaying && <Inventory />}
            {isPlaying && <CraftingScreen />}
            {isPlaying && <FurnaceScreen />}
            {isPlaying && <DeathScreen />}

            {/* Chat */}
            {isPlaying && <ChatBox />}

            {/* Credits */}
            {screen === 'credits' && <CreditsScreen />}

            {/* Underwater overlay */}
            {isPlaying && <UnderwaterOverlay />}

            {/* Game mode indicator */}
            {isPlaying && activeOverlay === 'none' && (
                <div className="mode-indicator">
                    {gameMode === 'creative' && '✨ Creative'}
                    {gameMode === 'survival' && '⚔ Survival'}
                    {gameMode === 'spectator' && '👁 Spectator'}
                </div>
            )}

            {/* Vignette overlay for cinematic effect */}
            {isPlaying && <div className="vignette" />}
        </ErrorBoundary>
    );
};

export default App;
