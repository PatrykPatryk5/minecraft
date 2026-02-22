/**
 * Pause Menu — ESC toggle, settings, game mode, LAN hosting, new options
 */

import React, { useEffect, useCallback, useState } from 'react';
import useGameStore from '../store/gameStore';
import type { GameMode, Difficulty } from '../store/gameStore';
import { startLANServer, stopLANServer, getLANState } from '../multiplayer/LANServer';
import { exportWorldToFile } from '../core/storage';

const PauseMenu: React.FC = () => {
    const isPaused = useGameStore((s) => s.isPaused);
    const setPaused = useGameStore((s) => s.setPaused);
    const activeOverlay = useGameStore((s) => s.activeOverlay);
    const setScreen = useGameStore((s) => s.setScreen);
    const settings = useGameStore((s) => s.settings);
    const updateSettings = useGameStore((s) => s.updateSettings);
    const gameMode = useGameStore((s) => s.gameMode);
    const setGameMode = useGameStore((s) => s.setGameMode);
    const setLocked = useGameStore((s) => s.setLocked);
    const screen = useGameStore((s) => s.screen);
    const playerName = useGameStore((s) => s.playerName);

    const [lanActive, setLanActive] = useState(false);
    const [lanPort, setLanPort] = useState(0);
    const [showLanPanel, setShowLanPanel] = useState(false);

    const handleEscape = useCallback((e: KeyboardEvent) => {
        if (e.code !== 'Escape' || screen !== 'playing') return;
        if (activeOverlay !== 'none' && activeOverlay !== 'pause') return;

        e.preventDefault();
        const next = !isPaused;
        setPaused(next);
        setLocked(!next);

        if (next) {
            document.exitPointerLock?.();
        }
    }, [isPaused, setPaused, setLocked, activeOverlay, screen]);

    useEffect(() => {
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [handleEscape]);

    if (!isPaused || activeOverlay !== 'pause') return null;

    const returnToMenu = () => {
        if (lanActive) {
            stopLANServer();
            setLanActive(false);
        }
        useGameStore.getState().saveGame();
        setPaused(false);
        setLocked(false);
        setScreen('mainMenu');
    };

    const resume = () => {
        setPaused(false);
        setLocked(true);
        document.body.requestPointerLock?.();
    };

    const toggleLAN = () => {
        if (lanActive) {
            stopLANServer();
            setLanActive(false);
            setLanPort(0);
        } else {
            const { port } = startLANServer(playerName);
            setLanActive(true);
            setLanPort(port);
        }
    };

    return (
        <div className="pause-overlay">
            <div className="pause-panel">
                <h2>⏸ Gra Wstrzymana</h2>

                <button className="mc-btn primary" onClick={resume}>▶ Wznów Grę</button>

                {/* LAN / WAN Hosting */}
                <div style={{ margin: '12px 0', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12 }}>
                    <button className={`mc-btn ${lanActive ? 'active' : ''}`} onClick={toggleLAN}>
                        {lanActive ? '🔴 Zamknij LAN' : '🌐 Otwórz na LAN'}
                    </button>

                    {lanActive && (
                        <div style={{ margin: '8px 0', padding: '8px 12px', background: 'rgba(0,200,0,0.15)', borderRadius: 4, fontSize: '0.85em' }}>
                            <div>✅ <strong>Serwer LAN aktywny</strong></div>
                            <div style={{ margin: '4px 0' }}>
                                Port: <code>{lanPort}</code>
                            </div>
                            <div style={{ color: '#aaa', fontSize: '0.8em' }}>
                                Inni gracze łączą się przez:<br />
                                <code>ws://TWOJE_IP:{lanPort}</code><br />
                                Sprawdź swoje IP: <code>ipconfig</code>
                            </div>
                        </div>
                    )}

                    <button className="mc-btn" onClick={() => setShowLanPanel(!showLanPanel)} style={{ marginTop: 4 }}>
                        {showLanPanel ? '▲ Ukryj Hosting Zewnętrzny' : '🌍 Hosting Zewnętrzny (WAN)'}
                    </button>

                    {showLanPanel && (
                        <div style={{ margin: '8px 0', padding: '8px 12px', background: 'rgba(0,100,200,0.15)', borderRadius: 4, fontSize: '0.8em', color: '#bbb' }}>
                            <div><strong>Hosting poza LAN:</strong></div>
                            <div style={{ marginTop: 4 }}>
                                1. Otwórz folder <code>server/</code><br />
                                2. <code>npm install</code><br />
                                3. <code>npx ts-node server.ts</code><br />
                                4. Przekieruj port 3001 na routerze<br />
                                5. Podaj IP publiczne innym graczom
                            </div>
                            <div style={{ marginTop: 6, color: '#ff9' }}>
                                ⚠ Hosting WAN wymaga port-forwardingu lub usługi typu ngrok
                            </div>
                        </div>
                    )}
                </div>

                <div className="settings-compact">
                    <div className="setting-row">
                        <span>Zasięg: <strong>{settings.renderDistance}</strong> {settings.renderDistance > 12 && <span style={{ color: '#fa0', fontSize: '0.8em' }}>(Zalecane. max 12)</span>}</span>
                        <input type="range" min={2} max={32} value={settings.renderDistance}
                            onChange={(e) => updateSettings({ renderDistance: +e.target.value })} className="mc-slider" />
                    </div>
                    <div className="setting-row">
                        <span>FOV: <strong>{settings.fov}°</strong></span>
                        <input type="range" min={60} max={110} value={settings.fov}
                            onChange={(e) => updateSettings({ fov: +e.target.value })} className="mc-slider" />
                    </div>
                    <div className="setting-row">
                        <span>Czułość: <strong>{(settings.sensitivity * 100).toFixed(0)}%</strong></span>
                        <input type="range" min={10} max={100} value={settings.sensitivity * 100}
                            onChange={(e) => updateSettings({ sensitivity: +e.target.value / 100 })} className="mc-slider" />
                    </div>
                    <div className="setting-row">
                        <span>Dźwięki: <strong>{(settings.soundVolume * 100).toFixed(0)}%</strong></span>
                        <input type="range" min={0} max={100} value={settings.soundVolume * 100}
                            onChange={(e) => updateSettings({ soundVolume: +e.target.value / 100 })} className="mc-slider" />
                    </div>
                    <div className="setting-row">
                        <span>Muzyka: <strong>{(settings.musicVolume * 100).toFixed(0)}%</strong></span>
                        <input type="range" min={0} max={100} value={settings.musicVolume * 100}
                            onChange={(e) => updateSettings({ musicVolume: +e.target.value / 100 })} className="mc-slider" />
                    </div>
                    <div className="setting-row">
                        <span>Jasność: <strong>{(settings.brightness * 100).toFixed(0)}%</strong></span>
                        <input type="range" min={1} max={200} value={settings.brightness * 100}
                            onChange={(e) => updateSettings({ brightness: +e.target.value / 100 })} className="mc-slider" />
                    </div>
                    <div className="setting-row">
                        <span>Trudność:</span>
                        <div className="mode-selector compact">
                            {(['peaceful', 'easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
                                <button key={d} className={`mode-btn sm${settings.difficulty === d ? ' active' : ''}`}
                                    onClick={() => updateSettings({ difficulty: d })}>
                                    {d === 'peaceful' ? '🕊' : d === 'easy' ? '😊' : d === 'normal' ? '⚔' : '💀'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="setting-row">
                        <span>Grafika:</span>
                        <div className="mode-selector compact">
                            {(['fast', 'fancy', 'fabulous'] as const).map((g) => (
                                <button key={g} className={`mode-btn sm${settings.graphics === g ? ' active' : ''}`}
                                    onClick={() => updateSettings({ graphics: g })}>
                                    {g === 'fast' ? '⚡' : g === 'fancy' ? '🎨' : '✨'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="setting-row">
                        <span>GUI Scale: <strong>{settings.guiScale}x</strong></span>
                        <input type="range" min={1} max={4} value={settings.guiScale}
                            onChange={(e) => updateSettings({ guiScale: +e.target.value })} className="mc-slider" />
                    </div>
                    <div className="setting-row" style={{ gridColumn: 'span 2', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={settings.smoothLighting} onChange={(e) => updateSettings({ smoothLighting: e.target.checked })} />
                            AO
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={settings.viewBobbing} onChange={(e) => updateSettings({ viewBobbing: e.target.checked })} />
                            Bobbing
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={settings.showFps} onChange={(e) => updateSettings({ showFps: e.target.checked })} />
                            FPS
                        </label>
                    </div>
                    <div className="setting-row">
                        <span>Cząsteczki:</span>
                        <div className="mode-selector compact">
                            {(['all', 'decreased', 'minimal'] as const).map((p) => (
                                <button key={p} className={`mode-btn sm${settings.particles === p ? ' active' : ''}`}
                                    onClick={() => updateSettings({ particles: p })}>
                                    {p === 'all' ? '✨' : p === 'decreased' ? '🔅' : '⬜'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="setting-row">
                        <label>
                            <input type="checkbox" checked={settings.smoothLighting}
                                onChange={(e) => updateSettings({ smoothLighting: e.target.checked })} />
                            Gładkie oświetlenie
                        </label>
                    </div>
                </div>

                <div className="setting-row" style={{ marginTop: 12 }}>
                    <span>Tryb gry:</span>
                    <div className="mode-selector compact">
                        {(['survival', 'creative', 'spectator'] as GameMode[]).map((m) => (
                            <button key={m} className={`mode-btn sm${gameMode === m ? ' active' : ''}`}
                                onClick={() => setGameMode(m)}>
                                {m === 'survival' ? '⚔' : m === 'creative' ? '✨' : '👁'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="menu-row" style={{ marginTop: '16px', gap: '8px', display: 'flex' }}>
                    <button className="mc-btn half primary" onClick={() => exportWorldToFile()}>📥 Eksportuj Świat</button>
                    <button className="mc-btn half" onClick={returnToMenu}>🏠 Zapisz i Wyjdź</button>
                </div>
            </div>
        </div>
    );
};

export default PauseMenu;
