/**
 * Main App — Full game with main menu, modes, crafting, inventory.
 */

import React, { Suspense, lazy, useEffect, useState, useRef } from 'react';
import HUD from './ui/HUD';
import DebugScreen from './ui/DebugScreen';
import PauseMenu from './ui/PauseMenu';
import Inventory from './ui/Inventory';
import CraftingScreen from './ui/CraftingScreen';
import FurnaceScreen from './ui/FurnaceScreen';
import ChestScreen from './ui/ChestScreen';
import ChatBox from './ui/ChatBox';
import DeathScreen from './ui/DeathScreen';
import ErrorBoundary from './ui/ErrorBoundary';
import MainMenu from './ui/MainMenu';
import CreditsScreen from './ui/CreditsScreen';
import KeybindScreen from './ui/KeybindScreen';
import NetworkHUD from './ui/NetworkHUD';
import useGameStore from './store/gameStore';
import { setMusicVolume, setSoundVolume } from './audio/sounds';
import { getRendererCaps, type RendererCapabilities } from './core/renderer';
import MobileControls from './ui/MobileControls';
import PreJoinShield from './ui/PreJoinShield';
import TabList from './ui/TabList';
import ModuleCrashOverlay from './ui/ModuleCrashOverlay';

const GameCanvas = lazy(() => import('./GameCanvas'));
const MultiplayerScreen = lazy(() => import('./ui/MultiplayerScreen'));

const UnderwaterOverlay = () => {
    const isUnderwater = useGameStore((s) => s.isUnderwater);
    if (!isUnderwater) return null;
    return <div className="water-overlay" />;
};

const App: React.FC = () => {
    const fov = useGameStore((s) => s.fov);
    const screen = useGameStore((s) => s.screen);
    const gameMode = useGameStore((s) => s.gameMode);
    const showHUD = useGameStore((s) => s.showHUD);
    const activeOverlay = useGameStore((s) => s.activeOverlay);
    const graphics = useGameStore((s) => s.settings.graphics);
    const soundVolume = useGameStore((s) => s.settings.soundVolume);
    const musicVolume = useGameStore((s) => s.settings.musicVolume);
    const [caps, setCaps] = useState<RendererCapabilities | null>(null);
    const [ready, setReady] = useState(false);
    const prevScreenRef = useRef(screen);

    useEffect(() => {
        setSoundVolume(soundVolume);
        setMusicVolume(musicVolume);
    }, [soundVolume, musicVolume]);

    useEffect(() => {
        const init = async () => {
            const detected = await getRendererCaps();
            setCaps(detected);
            console.log(`[MC R3F] Renderer: ${detected.label} | GPU: ${detected.gpuName}`);
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
        };

        const onBlur = () => {
            if (screen !== 'playing') return;
            const state = useGameStore.getState();
            if (!state.isPaused) state.setPaused(true);
            state.setLocked(false);
            document.exitPointerLock?.();
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
            {screen === 'multiplayer' && (
                <Suspense fallback={(
                    <div className="loading-screen" role="status" aria-live="polite">
                        <div className="loading-icon">🌐</div>
                        <div className="loading-text">Ładowanie trybu wieloosobowego…</div>
                        <div className="loading-bar"><div className="loading-fill" /></div>
                    </div>
                )}>
                    <MultiplayerScreen />
                </Suspense>
            )}
            <PreJoinShield />

            {isPlaying && (
                <Suspense fallback={(
                    <div className="loading-screen" role="status" aria-live="polite">
                        <div className="loading-icon">⛏</div>
                        <div className="loading-text">Ładowanie świata…</div>
                        <div className="loading-bar"><div className="loading-fill" /></div>
                    </div>
                )}>
                    <GameCanvas fov={fov} graphics={graphics} />
                </Suspense>
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
            {isPlaying && <ChestScreen />}
            {isPlaying && <DeathScreen />}
            {isPlaying && <ModuleCrashOverlay />}

            {/* Chat */}
            {isPlaying && <ChatBox />}

            {/* Tab List */}
            {isPlaying && <TabList />}

            {/* Mobile Controls */}
            {isPlaying && <MobileControls />}

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
