/**
 * Death Screen — Shown when player health reaches 0
 * Features:
 *   - Dramatic red overlay with cinematic animation
 *   - Death message (randomized)
 *   - Score display (XP-based)
 *   - Respawn and Main Menu buttons
 */

import React, { useEffect, useState } from 'react';
import useGameStore from '../store/gameStore';
import { getSpawnHeight } from '../core/terrainGen';
import { playSound } from '../audio/sounds';

const DEATH_MESSAGES = [
    'Zginąłeś!',
    'Game Over!',
    'Straciłeś wszystkie punkty życia!',
    'Twoja przygoda dobiegła końca...',
    'Porażka!',
    'Świat Cię pokonał...',
    'Następnym razem będzie lepiej!',
];

const DeathScreen: React.FC = () => {
    const isDead = useGameStore((s) => s.isDead);
    const xpLevel = useGameStore((s) => s.xpLevel);
    const deathReason = useGameStore((s) => s.deathReason);
    const setScreen = useGameStore((s) => s.setScreen);
    const [message, setMessage] = useState('');
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isDead) {
            setMessage(deathReason || DEATH_MESSAGES[Math.floor(Math.random() * DEATH_MESSAGES.length)]);
            // Short delay for the fade-in effect
            const t = setTimeout(() => setVisible(true), 50);
            return () => clearTimeout(t);
        } else {
            setVisible(false);
        }
    }, [isDead]);

    if (!isDead) return null;

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

    const score = xpLevel * 7;

    return (
        <div className={`death-overlay${visible ? ' death-visible' : ''}`}>
            <div className="death-content">
                {/* Title with animated glow */}
                <div className="death-skull">💀</div>
                <h1 className="death-title">{message}</h1>

                <div className="death-divider" />

                {/* Score */}
                <div className="death-score">
                    <span className="death-score-label">Wynik</span>
                    <span className="death-score-value">{score}</span>
                    <span className="death-score-suffix">pkt</span>
                </div>
                <div className="death-xp-note">Poziom XP: {xpLevel}</div>

                <div className="death-divider" />

                {/* Buttons */}
                <div className="death-buttons">
                    <button className="mc-btn primary death-btn" onClick={respawn}>
                        ⟲ Odrodzenie
                    </button>
                    <button className="mc-btn death-btn" onClick={toMenu}>
                        ← Menu Główne
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeathScreen;
