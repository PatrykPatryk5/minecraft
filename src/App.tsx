/**
 * Main App — Full game with main menu, modes, crafting, inventory.
 */

import React, { Suspense, useEffect, useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import World from './world/World';
import Player from './player/Player';
import DayNightCycle from './environment/DayNightCycle';
import WaterSurface from './environment/WaterSurface';
import Clouds from './environment/Clouds';
import BlockParticles from './effects/BlockParticles';
import HUD from './ui/HUD';
import DebugScreen from './ui/DebugScreen';
import PauseMenu from './ui/PauseMenu';
import Inventory from './ui/Inventory';
import CraftingScreen from './ui/CraftingScreen';
import FurnaceScreen from './ui/FurnaceScreen';
import ChatBox from './ui/ChatBox';
import DeathScreen from './ui/DeathScreen';
import ErrorBoundary from './ui/ErrorBoundary';
import MainMenu from './ui/MainMenu';
import KeybindScreen from './ui/KeybindScreen';
import MultiplayerScreen from './ui/MultiplayerScreen';
import MobRenderer from './mobs/MobRenderer';
import useGameStore from './store/gameStore';
import { getRendererCaps, type RendererCapabilities } from './core/renderer';
import { preloadAllTextures } from './core/textures';

const LoadingScreen: React.FC<{ caps: RendererCapabilities | null; progress: string }> = ({ caps, progress }) => (
    <div className="loading-screen">
        <div className="loading-icon">⛏</div>
        <div className="loading-text">{progress}</div>
        <div className="loading-bar"><div className="loading-fill" /></div>
        {caps && <div className="loading-gpu">{caps.label} | {caps.gpuName}</div>}
    </div>
);

const SceneContent: React.FC = () => (
    <>
        <fog attach="fog" args={['#87ceeb', 60, 220]} />
        <DayNightCycle />
        <World />
        <Player />
        <WaterSurface />
        <Clouds />
        <BlockParticles />
        <MobRenderer />
    </>
);

const App: React.FC = () => {
    const fov = useGameStore((s) => s.fov);
    const screen = useGameStore((s) => s.screen);
    const gameMode = useGameStore((s) => s.gameMode);
    const showHUD = useGameStore((s) => s.showHUD);
    const activeOverlay = useGameStore((s) => s.activeOverlay);
    const playerPos = useGameStore((s) => s.playerPos);
    const [caps, setCaps] = useState<RendererCapabilities | null>(null);
    const [ready, setReady] = useState(false);
    const prevScreenRef = useRef(screen);

    useEffect(() => {
        const init = async () => {
            const detected = await getRendererCaps();
            setCaps(detected);
            console.log(`[MC R3F] Renderer: ${detected.label} | GPU: ${detected.gpuName}`);
            preloadAllTextures();
            setTimeout(() => setReady(true), 500);
        };
        init();
    }, []);

    // Auto-fullscreen when starting game
    useEffect(() => {
        if (screen === 'playing' && prevScreenRef.current !== 'playing') {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen?.().catch(() => { });
            }
        }
        prevScreenRef.current = screen;
    }, [screen]);

    // F1 to toggle HUD
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.code === 'F1') {
                e.preventDefault();
                useGameStore.getState().toggleHUD();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    if (!ready) return <LoadingScreen caps={caps} progress="Ładowanie zasobów..." />;

    const isPlaying = screen === 'playing';

    return (
        <ErrorBoundary>
            <MainMenu />
            <KeybindScreen />
            <MultiplayerScreen />

            {isPlaying && (
                <Canvas
                    camera={{ fov, near: 0.1, far: 1000, position: [0, 80, 0] }}
                    gl={{
                        antialias: false,
                        powerPreference: 'high-performance',
                        stencil: false,
                        depth: true,
                        alpha: false,
                        failIfMajorPerformanceCaveat: false,
                    }}
                    dpr={[1, Math.min(window.devicePixelRatio, 2)]}
                    style={{ width: '100%', height: '100%' }}
                    onContextMenu={(e) => e.preventDefault()}
                    frameloop="always"
                    performance={{ min: 0.5 }}
                >
                    <Suspense fallback={null}>
                        <SceneContent />
                    </Suspense>
                </Canvas>
            )}

            {/* HUD and Debug — only when playing and HUD enabled */}
            {isPlaying && showHUD && (
                <>
                    <HUD />
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

            {/* Underwater overlay */}
            {isPlaying && useGameStore.getState().getBlock(Math.floor(playerPos[0]), Math.floor(playerPos[1] + 1.62), Math.floor(playerPos[2])) === 9 && (
                <div className="water-overlay" />
            )}

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
