/**
 * Pause Menu — ESC toggle (only when no other overlay is open)
 * Includes game mode switcher, settings, back to menu.
 */

import React, { useEffect } from 'react';
import useGameStore from '../store/gameStore';
import type { GameMode } from '../store/gameStore';

const PauseMenu: React.FC = () => {
    const activeOverlay = useGameStore((s) => s.activeOverlay);
    const setOverlay = useGameStore((s) => s.setOverlay);
    const isLocked = useGameStore((s) => s.isLocked);
    const renderDistance = useGameStore((s) => s.renderDistance);
    const setRenderDistance = useGameStore((s) => s.setRenderDistance);
    const fov = useGameStore((s) => s.fov);
    const setFov = useGameStore((s) => s.setFov);
    const gameMode = useGameStore((s) => s.gameMode);
    const setGameMode = useGameStore((s) => s.setGameMode);
    const settings = useGameStore((s) => s.settings);
    const updateSettings = useGameStore((s) => s.updateSettings);
    const setScreen = useGameStore((s) => s.setScreen);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.code !== 'Escape') return;
            const s = useGameStore.getState();
            if (s.screen !== 'playing') return;
            if (s.isChatOpen) return; // Don't interfere with chat
            // Only handle ESC for pause if no other overlay is open
            if (s.activeOverlay === 'none') {
                s.setOverlay('pause');
                document.exitPointerLock();
            } else if (s.activeOverlay === 'pause') {
                s.setOverlay('none');
                document.querySelector('canvas')?.requestPointerLock();
            }
            // If inventory/crafting is open, their own ESC handler (capture phase) handles it
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isLocked]);

    if (activeOverlay !== 'pause') return null;

    const resume = () => {
        setOverlay('none');
        document.querySelector('canvas')?.requestPointerLock();
    };

    const toMainMenu = () => {
        setOverlay('none');
        setScreen('mainMenu');
    };

    return (
        <div className="pause-overlay">
            <div className="pause-menu">
                <h2>⏸ Gra Wstrzymana</h2>

                <button className="mc-button" onClick={resume}>Powrót do gry</button>

                {/* Game mode switcher */}
                <div className="settings-group">
                    <label>Tryb gry</label>
                    <div className="mode-selector">
                        {(['survival', 'creative', 'spectator'] as GameMode[]).map((m) => (
                            <button key={m} className={`mode-btn${gameMode === m ? ' active' : ''}`} onClick={() => setGameMode(m)}>
                                {m === 'survival' && '⚔ Survival'}
                                {m === 'creative' && '✨ Creative'}
                                {m === 'spectator' && '👁 Spectator'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="settings-group">
                    <label>Zasięg renderowania: <strong>{renderDistance}</strong> chunków</label>
                    <input type="range" min={2} max={16} value={renderDistance} onChange={(e) => setRenderDistance(+e.target.value)} className="mc-slider" />
                </div>

                <div className="settings-group">
                    <label>FOV: <strong>{fov}°</strong></label>
                    <input type="range" min={60} max={110} value={fov} onChange={(e) => setFov(+e.target.value)} className="mc-slider" />
                </div>

                <div className="settings-group">
                    <label>Czułość myszy: <strong>{(settings.sensitivity * 100).toFixed(0)}%</strong></label>
                    <input type="range" min={10} max={100} value={settings.sensitivity * 100} onChange={(e) => updateSettings({ sensitivity: +e.target.value / 100 })} className="mc-slider" />
                </div>

                <div className="settings-group">
                    <label>Dźwięki: <strong>{(settings.soundVolume * 100).toFixed(0)}%</strong></label>
                    <input type="range" min={0} max={100} value={settings.soundVolume * 100} onChange={(e) => updateSettings({ soundVolume: +e.target.value / 100 })} className="mc-slider" />
                </div>

                <button className="mc-button secondary" onClick={toMainMenu}>Powrót do Menu Głównego</button>
            </div>
        </div>
    );
};

export default PauseMenu;
