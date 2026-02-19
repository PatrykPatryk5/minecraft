/**
 * Death Screen — Shown when player health reaches 0
 *
 * Features:
 *   - Red overlay with death message
 *   - Score display (XP-based)
 *   - Respawn button → teleport to spawn, restore health/hunger
 *   - Title screen button
 */

import React from 'react';
import useGameStore from '../store/gameStore';
import { getSpawnHeight } from '../core/terrainGen';
import { playSound } from '../audio/sounds';

const DEATH_MESSAGES = [
    'Zginąłeś!',
    'Game Over!',
    'Straciłeś wszystkie punkty życia!',
    'Twoja przygoda dobiegła końca...',
    'Porażka!',
];

const DeathScreen: React.FC = () => {
    const isDead = useGameStore((s) => s.isDead);
    const xpLevel = useGameStore((s) => s.xpLevel);
    const setScreen = useGameStore((s) => s.setScreen);

    if (!isDead) return null;

    const message = DEATH_MESSAGES[Math.floor(Math.random() * DEATH_MESSAGES.length)];

    const respawn = () => {
        const s = useGameStore.getState();
        const y = getSpawnHeight(8, 8);
        s.setPlayerPos([8, y + 2, 8]);
        s.setHealth(20);
        s.setHunger(20);
        s.setOxygen(300);
        s.setDead(false);
        s.setOverlay('none');
        playSound('xp');
        document.querySelector('canvas')?.requestPointerLock();
    };

    const toMenu = () => {
        const s = useGameStore.getState();
        s.saveGame();
        s.setDead(false);
        s.setHealth(20);
        s.setHunger(20);
        s.setOxygen(300);
        s.setOverlay('none');
        setScreen('mainMenu');
    };

    return (
        <div className="death-overlay">
            <div className="death-content">
                <h1 className="death-title">{message}</h1>
                <div className="death-score">
                    Wynik: <strong>{xpLevel * 7}</strong> punktów
                </div>
                <div className="death-buttons">
                    <button className="mc-btn primary" onClick={respawn}>
                        ⟲ Odrodzenie
                    </button>
                    <button className="mc-btn" onClick={toMenu}>
                        ← Menu Główne
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeathScreen;
