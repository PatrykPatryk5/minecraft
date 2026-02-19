/**
 * Keybind Customization Screen
 *
 * Allows players to remap all controls.
 * Press a key to set the keybind, ESC to cancel.
 */

import React, { useState, useEffect, useCallback } from 'react';
import useGameStore from '../store/gameStore';
import type { Keybinds } from '../store/gameStore';

const KEYBIND_LABELS: Record<string, string> = {
    forward: 'Do przodu',
    backward: 'Do tyłu',
    left: 'W lewo',
    right: 'W prawo',
    jump: 'Skok',
    sprint: 'Sprint',
    sneak: 'Kucanie',
    inventory: 'Ekwipunek',
    drop: 'Wyrzuć',
    chat: 'Czat',
    command: 'Polecenie',
};

const KEY_DISPLAY: Record<string, string> = {
    KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D',
    KeyE: 'E', KeyQ: 'Q', KeyT: 'T', KeyR: 'R',
    KeyF: 'F', KeyG: 'G', KeyC: 'C', KeyX: 'X',
    Space: 'Spacja', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift',
    ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl',
    Slash: '/', AltLeft: 'L-Alt', Tab: 'Tab',
    Enter: 'Enter', Backspace: 'Backspace',
};

function displayKey(code: string): string {
    return KEY_DISPLAY[code] || code.replace('Key', '');
}

const KeybindScreen: React.FC = () => {
    const screen = useGameStore((s) => s.screen);
    const setScreen = useGameStore((s) => s.setScreen);
    const settings = useGameStore((s) => s.settings);
    const updateSettings = useGameStore((s) => s.updateSettings);

    const [listening, setListening] = useState<string | null>(null);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!listening) return;
        e.preventDefault();
        e.stopPropagation();

        if (e.code === 'Escape') {
            setListening(null);
            return;
        }

        const newBinds: Keybinds = { ...settings.keybinds, [listening]: e.code };
        updateSettings({ keybinds: newBinds });
        setListening(null);
    }, [listening, settings.keybinds, updateSettings]);

    useEffect(() => {
        if (listening) {
            window.addEventListener('keydown', handleKeyDown, true);
            return () => window.removeEventListener('keydown', handleKeyDown, true);
        }
    }, [listening, handleKeyDown]);

    if (screen !== 'keybinds') return null;

    const resetDefaults = () => {
        updateSettings({
            keybinds: {
                forward: 'KeyW', backward: 'KeyS', left: 'KeyA', right: 'KeyD',
                jump: 'Space', sprint: 'ShiftLeft', sneak: 'ControlLeft',
                inventory: 'KeyE', drop: 'KeyQ', chat: 'KeyT', command: 'Slash',
            },
        });
    };

    return (
        <div className="main-menu">
            <div className="menu-bg" />
            <div className="menu-content">
                <div className="screen-title">🎮 Sterowanie</div>
                <div className="settings-grid" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    {Object.entries(KEYBIND_LABELS).map(([action, label]) => (
                        <div key={action} className="setting-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label>{label}</label>
                            <button
                                className={`mc-btn${listening === action ? ' active' : ''}`}
                                style={{ minWidth: 100, textAlign: 'center' }}
                                onClick={() => setListening(listening === action ? null : action)}
                            >
                                {listening === action ? '> ... <' : displayKey(settings.keybinds[action] || '?')}
                            </button>
                        </div>
                    ))}
                </div>
                <div className="menu-buttons" style={{ marginTop: 16, gap: 8, display: 'flex', flexDirection: 'column' }}>
                    <button className="mc-btn" onClick={resetDefaults}>🔄 Przywróć domyślne</button>
                    <button className="mc-btn" onClick={() => setScreen('settings')}>← Wstecz</button>
                </div>
            </div>
        </div>
    );
};

export default KeybindScreen;
