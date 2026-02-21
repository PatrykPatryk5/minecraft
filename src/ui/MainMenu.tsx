/**
 * Main Menu — Minecraft-style with animated background, world creation, settings
 * Updated with difficulty, keybinds, multiplayer, GUI scale, particles, smooth lighting
 */

import React, { useState, useEffect, useRef } from 'react';
import useGameStore from '../store/gameStore';
import type { GameMode, Difficulty } from '../store/gameStore';
import { DEFAULT_HOTBAR, EMPTY_HOTBAR } from '../core/blockTypes';
import { exportWorldToFile, importWorldFromFile } from '../core/storage';

const SPLASHES = [
    'Zbudowany w React!', 'Piksele!', 'Kopaj głęboko!', 'Craftuj mądrze!',
    '60 FPS!', 'TypeScript 5.9!', '100% darmowe!', 'WebGPU ready!',
    'Polskie napisy!', 'Three.js inside!', 'Zustand powered!', 'Open Source!',
    'Więcej bloków!', 'Survival mode!', 'Multiplayer!', '4 workery!',
];

const MenuHome: React.FC = () => {
    const setScreen = useGameStore((s) => s.setScreen);
    const loadWorldFromStorage = useGameStore((s) => s.loadWorldFromStorage);
    const [splash] = useState(() => SPLASHES[Math.floor(Math.random() * SPLASHES.length)]);
    const [hasSave, setHasSave] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial check for a saved world
    useEffect(() => {
        // Check if there's a saved game
        const stored = localStorage.getItem('mcraft_player_state');
        setHasSave(!!stored);
    }, []);

    const handleContinue = async () => {
        const success = await loadWorldFromStorage();
        if (success) {
            setScreen('playing');
        } else {
            alert("Brak zapisu lub plik uszkodzony!");
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            const text = ev.target?.result as string;
            if (text) {
                const success = await importWorldFromFile(text);
                if (success) {
                    alert("Świat pomyślnie załadowany z pliku!");
                    setHasSave(true);
                } else {
                    alert("Błąd podczas wgrywania zapisu! Niewłaściwy format.");
                }
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="menu-content">
            <div className="menu-title">
                <h1>
                    <span className="title-m">M</span><span className="title-i">I</span>
                    <span className="title-n">N</span><span className="title-e">E</span>
                    <span className="title-c">C</span><span className="title-r">R</span>
                    <span className="title-a">A</span><span className="title-f">F</span>
                    <span className="title-t">T</span>
                </h1>
                <div className="subtitle">React Three Fiber Edition</div>
                <div className="splash-text">{splash}</div>
            </div>

            <div className="menu-buttons">
                {hasSave ? (
                    <button className="mc-btn primary" onClick={handleContinue}>
                        🟢 Kontynuuj Grę
                    </button>
                ) : null}

                <button className={hasSave ? "mc-btn" : "mc-btn primary"} onClick={() => setScreen('worldCreate')}>
                    🌍 Nowy Świat
                </button>
                <div className="menu-row">
                    <button className="mc-btn half" onClick={() => setScreen('multiplayer')}>
                        🌐 W sieci
                    </button>
                    <button className="mc-btn half" onClick={() => fileInputRef.current?.click()}>
                        📥 Wczytaj
                    </button>
                    {/* Hidden file input */}
                    <input
                        type="file"
                        accept=".json,.mcraft"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                    />
                </div>
                <div className="menu-row">
                    <button className="mc-btn half" onClick={() => setScreen('settings')}>⚙ Opcje</button>
                    <button className="mc-btn half" disabled>🗣 Języki</button>
                </div>
            </div>

            <div className="menu-footer">
                <span>Minecraft R3F v4.0</span>
                <span>React 19 + Three.js + Zustand</span>
            </div>
            <div className="menu-credits">
                <div>MADE BY: MUZYKANT TEAM</div>
                <div>MAIN DEVELOPER: Patryk_Patryk_5</div>
                <a href="https://muzykant.xyz" target="_blank" rel="noreferrer">https://muzykant.xyz</a>
                <div>ALL RIGHTS RESERVED!</div>
            </div>
        </div>
    );
};

const WorldCreate: React.FC = () => {
    const setScreen = useGameStore((s) => s.setScreen);
    const setGameMode = useGameStore((s) => s.setGameMode);
    const resetWorld = useGameStore((s) => s.resetWorld);
    const setWorldSeed = useGameStore((s) => s.setWorldSeed);
    const gameMode = useGameStore((s) => s.gameMode);
    const setHotbar = useGameStore((s) => s.setHotbar);
    const settings = useGameStore((s) => s.settings);
    const updateSettings = useGameStore((s) => s.updateSettings);

    const [worldName, setWorldName] = useState('Nowy Świat');
    const [seed, setSeed] = useState('');
    const [mode, setMode] = useState<GameMode>(gameMode);
    const [diff, setDiff] = useState<Difficulty>(settings.difficulty);

    const descriptions: Record<GameMode, string> = {
        survival: '⚔ Zbieraj zasoby, craftuj narzędzia, przetrwaj!',
        creative: '✨ Nieskończone bloki, latanie, buduj co chcesz!',
        spectator: '👁 Lataj przez bloki, obserwuj świat',
    };

    const diffDescriptions: Record<Difficulty, string> = {
        peaceful: '🕊 Brak mobów wrogich, regeneracja zdrowia',
        easy: '😊 Mniej obrażeń, łatwiejsze przetrwanie',
        normal: '⚔ Standardowe obrażenia i moby',
        hard: '💀 Więcej obrażeń, trudniejsze moby',
    };

    const hashSeed = (s: string): number => {
        let h = 0;
        for (let i = 0; i < s.length; i++) {
            h = ((h << 5) - h) + s.charCodeAt(i);
            h = h & h;
        }
        return Math.abs(h) || 1;
    };

    const startGame = () => {
        const finalSeed = seed.trim()
            ? (/^\d+$/.test(seed.trim()) ? parseInt(seed.trim()) : hashSeed(seed.trim()))
            : Math.floor(Math.random() * 2147483647);

        setWorldSeed(finalSeed);
        setGameMode(mode);
        updateSettings({ difficulty: diff });
        resetWorld();

        if (mode === 'creative') {
            setHotbar(DEFAULT_HOTBAR.map(id => ({ id, count: 64 })));
        } else {
            setHotbar(EMPTY_HOTBAR.map(() => ({ id: 0, count: 0 })));
        }

        console.log(`[MC] Starting world "${worldName}" seed: ${finalSeed}, mode: ${mode}, diff: ${diff}`);
        setScreen('playing');
    };

    return (
        <div className="menu-content">
            <div className="screen-title">🌍 Utwórz Nowy Świat</div>

            <div className="form-group">
                <label>Nazwa Świata</label>
                <input className="mc-input" value={worldName} onChange={(e) => setWorldName(e.target.value)} />
            </div>

            <div className="form-group">
                <label>Ziarno Świata (opcjonalne)</label>
                <input className="mc-input" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Losowe..." />
            </div>

            <div className="form-group">
                <label>Tryb Gry</label>
                <div className="mode-selector">
                    {(['survival', 'creative', 'spectator'] as GameMode[]).map((m) => (
                        <button key={m} className={`mode-btn${mode === m ? ' active' : ''}`} onClick={() => setMode(m)}>
                            {m === 'survival' && '⚔ Survival'}
                            {m === 'creative' && '✨ Creative'}
                            {m === 'spectator' && '👁 Spectator'}
                        </button>
                    ))}
                </div>
                <div className="mode-desc">{descriptions[mode]}</div>
            </div>

            <div className="form-group">
                <label>Trudność</label>
                <div className="mode-selector">
                    {(['peaceful', 'easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
                        <button key={d} className={`mode-btn${diff === d ? ' active' : ''}`} onClick={() => setDiff(d)}>
                            {d === 'peaceful' && '🕊'}
                            {d === 'easy' && '😊'}
                            {d === 'normal' && '⚔'}
                            {d === 'hard' && '💀'}
                            {' '}{d.charAt(0).toUpperCase() + d.slice(1)}
                        </button>
                    ))}
                </div>
                <div className="mode-desc">{diffDescriptions[diff]}</div>
            </div>

            <div className="menu-buttons" style={{ marginTop: 20 }}>
                <button className="mc-btn primary" onClick={startGame}>🚀 Utwórz Świat</button>
                <button className="mc-btn" onClick={() => setScreen('mainMenu')}>← Wstecz</button>
            </div>
        </div>
    );
};

const SettingsScreen: React.FC = () => {
    const setScreen = useGameStore((s) => s.setScreen);
    const settings = useGameStore((s) => s.settings);
    const updateSettings = useGameStore((s) => s.updateSettings);

    return (
        <div className="menu-content">
            <div className="screen-title">⚙ Ustawienia</div>

            <div className="settings-grid" style={{ padding: '4px' }}>
                <div className="setting-item">
                    <label>Zasięg renderowania: <strong>{settings.renderDistance}</strong> chunków {settings.renderDistance > 12 && <span style={{ color: '#fa0', fontSize: '0.8em' }}>(Zalecane do 12)</span>}</label>
                    <input type="range" min={2} max={32} value={settings.renderDistance} onChange={(e) => updateSettings({ renderDistance: +e.target.value })} className="mc-slider" />
                </div>
                <div className="setting-item">
                    <label>FOV: <strong>{settings.fov}°</strong></label>
                    <input type="range" min={60} max={110} value={settings.fov} onChange={(e) => updateSettings({ fov: +e.target.value })} className="mc-slider" />
                </div>
                <div className="setting-item">
                    <label>Czułość myszy: <strong>{(settings.sensitivity * 100).toFixed(0)}%</strong></label>
                    <input type="range" min={10} max={100} value={settings.sensitivity * 100} onChange={(e) => updateSettings({ sensitivity: +e.target.value / 100 })} className="mc-slider" />
                </div>
                <div className="setting-item">
                    <label>Głośność dźwięków: <strong>{(settings.soundVolume * 100).toFixed(0)}%</strong></label>
                    <input type="range" min={0} max={100} value={settings.soundVolume * 100} onChange={(e) => updateSettings({ soundVolume: +e.target.value / 100 })} className="mc-slider" />
                </div>
                <div className="setting-item">
                    <label>Głośność muzyki: <strong>{(settings.musicVolume * 100).toFixed(0)}%</strong></label>
                    <input type="range" min={0} max={100} value={settings.musicVolume * 100} onChange={(e) => updateSettings({ musicVolume: +e.target.value / 100 })} className="mc-slider" />
                </div>
                <div className="setting-item">
                    <label>Jasność: <strong>{(settings.brightness * 100).toFixed(0)}%</strong></label>
                    <input type="range" min={1} max={100} value={settings.brightness * 100} onChange={(e) => updateSettings({ brightness: +e.target.value / 100 })} className="mc-slider" />
                </div>
                <div className="setting-item">
                    <label>Grafika: <strong>{settings.graphics}</strong></label>
                    <div className="mode-selector">
                        {(['fast', 'fancy', 'fabulous'] as const).map((g) => (
                            <button key={g} className={`mode-btn${settings.graphics === g ? ' active' : ''}`} onClick={() => updateSettings({ graphics: g })}>
                                {g === 'fast' && '⚡ Szybka'}
                                {g === 'fancy' && '🎨 Ładna'}
                                {g === 'fabulous' && '✨ Bajna'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="setting-item">
                    <label>Skala GUI: <strong>{settings.guiScale}x</strong></label>
                    <input type="range" min={1} max={4} value={settings.guiScale} onChange={(e) => updateSettings({ guiScale: +e.target.value })} className="mc-slider" />
                </div>
                <div className="setting-item">
                    <label>Cząsteczki: <strong>{settings.particles === 'all' ? 'Wszystkie' : settings.particles === 'decreased' ? 'Mniej' : 'Minimalne'}</strong></label>
                    <div className="mode-selector">
                        {(['all', 'decreased', 'minimal'] as const).map((p) => (
                            <button key={p} className={`mode-btn${settings.particles === p ? ' active' : ''}`} onClick={() => updateSettings({ particles: p })}>
                                {p === 'all' && '✨ Wszystkie'}
                                {p === 'decreased' && '🔅 Mniej'}
                                {p === 'minimal' && '⬜ Min'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="setting-item">
                    <label>
                        <input type="checkbox" checked={settings.smoothLighting} onChange={(e) => updateSettings({ smoothLighting: e.target.checked })} />
                        Gładkie oświetlenie (AO)
                    </label>
                </div>
                <div className="setting-item">
                    <label>
                        <input type="checkbox" checked={settings.viewBobbing} onChange={(e) => updateSettings({ viewBobbing: e.target.checked })} />
                        Kołysanie widoku
                    </label>
                </div>
                <div className="setting-item">
                    <label>
                        <input type="checkbox" checked={settings.showFps} onChange={(e) => updateSettings({ showFps: e.target.checked })} />
                        Pokaż FPS
                    </label>
                </div>
            </div>

            <div className="menu-buttons" style={{ marginTop: 16, gap: 8, display: 'flex', flexDirection: 'column' }}>
                <button className="mc-btn" onClick={() => setScreen('keybinds')}>🎮 Sterowanie</button>
                <button className="mc-btn" onClick={() => setScreen('mainMenu')}>← Wstecz</button>
            </div>
        </div>
    );
};

const MainMenu: React.FC = () => {
    const screen = useGameStore((s) => s.screen);

    if (screen !== 'mainMenu' && screen !== 'worldCreate' && screen !== 'settings') {
        return null;
    }

    return (
        <div className="main-menu">
            <div className="menu-bg" />
            {screen === 'mainMenu' && <MenuHome />}
            {screen === 'worldCreate' && <WorldCreate />}
            {screen === 'settings' && <SettingsScreen />}
        </div>
    );
};

export default MainMenu;
