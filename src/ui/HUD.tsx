/**
 * HUD — Crosshair, hotbar with 3D block icons, health/hunger, XP bar, oxygen bar
 * Uses getBlockIcon for 3D isometric rendering.
 */

import React, { useEffect } from 'react';
import useGameStore from '../store/gameStore';
import { BLOCK_DATA } from '../core/blockTypes';
import { getBlockIcon } from '../core/textures';

const HUD: React.FC = () => {
    const hotbar = useGameStore((s) => s.hotbar);
    const hotbarSlot = useGameStore((s) => s.hotbarSlot);
    const setHotbarSlot = useGameStore((s) => s.setHotbarSlot);
    const isLocked = useGameStore((s) => s.isLocked);
    const activeOverlay = useGameStore((s) => s.activeOverlay);
    const gameMode = useGameStore((s) => s.gameMode);
    const health = useGameStore((s) => s.health);
    const hunger = useGameStore((s) => s.hunger);
    const xpLevel = useGameStore((s) => s.xpLevel);
    const xpProgress = useGameStore((s) => s.xpProgress);
    const oxygen = useGameStore((s) => s.oxygen);
    const maxOxygen = useGameStore((s) => s.maxOxygen);
    const isChatOpen = useGameStore((s) => s.isChatOpen);

    // Number keys 1-9
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (useGameStore.getState().isChatOpen) return;
            const n = parseInt(e.key);
            if (n >= 1 && n <= 9) setHotbarSlot(n - 1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [setHotbarSlot]);

    // Scroll wheel
    useEffect(() => {
        const onWheel = (e: WheelEvent) => {
            if (useGameStore.getState().isChatOpen) return;
            const dir = e.deltaY > 0 ? 1 : -1;
            const cur = useGameStore.getState().hotbarSlot;
            useGameStore.getState().setHotbarSlot(((cur + dir) % 9 + 9) % 9);
        };
        window.addEventListener('wheel', onWheel);
        return () => window.removeEventListener('wheel', onWheel);
    }, []);

    if (activeOverlay !== 'none') return null;

    const showBars = gameMode === 'survival';
    const halfHearts = Math.ceil(health / 2);
    const halfHunger = Math.ceil(hunger / 2);
    const showOxygen = oxygen < maxOxygen;

    return (
        <div className="hud">
            {/* Crosshair */}
            <div className="crosshair">
                <div className="crosshair-h" />
                <div className="crosshair-v" />
            </div>

            {/* Start screen */}
            {!isLocked && (
                <div className="click-to-play">
                    <div className="start-box">
                        <h1>⛏ Minecraft R3F</h1>
                        <p>Kliknij aby grać</p>
                        <div className="controls-help">
                            <span>WASD — ruch</span>
                            <span>Space — skok</span>
                            <span>Shift — sprint</span>
                            <span>LMB — zniszcz blok</span>
                            <span>RMB — postaw blok</span>
                            <span>MMB — wybierz blok</span>
                            <span>1-9 / scroll — hotbar</span>
                            <span>E — ekwipunek</span>
                            <span>C — crafting</span>
                            <span>T — czat / komendy</span>
                            <span>F3 — debug</span>
                            <span>F1 — ukryj HUD</span>
                            <span>ESC — pauza</span>
                            {gameMode === 'creative' && <span>2×Space — latanie</span>}
                        </div>
                    </div>
                </div>
            )}

            {/* Hotbar with 3D block icons */}
            <div className="hotbar">
                {hotbar.map((slot, i) => {
                    const data = slot.id ? BLOCK_DATA[slot.id] : null;
                    const sel = i === hotbarSlot;
                    const icon = slot.id ? getBlockIcon(slot.id) : null;
                    return (
                        <div key={i} className={`hotbar-slot${sel ? ' selected' : ''}`} onClick={() => setHotbarSlot(i)}>
                            {slot.id > 0 && icon && (
                                <>
                                    <img src={icon} className="block-icon-3d" alt={data?.name ?? ''} draggable={false} />
                                    {slot.count > 1 && <span className="item-count">{slot.count}</span>}
                                </>
                            )}
                            <span className="slot-number">{i + 1}</span>
                            {sel && data && <div className="slot-name">{data.name}</div>}
                        </div>
                    );
                })}
            </div>

            {/* Health + Hunger (survival only) */}
            {showBars && (
                <div className="status-bars">
                    <div className="bar-row">
                        <div className="hearts">
                            {Array.from({ length: 10 }, (_, i) => (
                                <span key={i} className={`heart${i < halfHearts ? '' : ' empty'}`}>
                                    {i < halfHearts ? '❤' : '🖤'}
                                </span>
                            ))}
                        </div>
                        <div className="hunger">
                            {Array.from({ length: 10 }, (_, i) => (
                                <span key={i} className={`drumstick${i < halfHunger ? '' : ' empty'}`}>
                                    {i < halfHunger ? '🍗' : '🦴'}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Oxygen bar (only when underwater and not at max) */}
                    {showOxygen && (
                        <div className="oxygen-bar-container">
                            <div className="oxygen-bar">
                                {Array.from({ length: 10 }, (_, i) => {
                                    const oxygenPerBubble = maxOxygen / 10;
                                    const filled = oxygen >= (i + 1) * oxygenPerBubble;
                                    const partial = !filled && oxygen > i * oxygenPerBubble;
                                    return (
                                        <span key={i} className={`bubble${filled ? '' : partial ? ' partial' : ' empty'}`}>
                                            {filled ? '🫧' : partial ? '💧' : '⭕'}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* XP Bar */}
                    <div className="xp-bar-container">
                        <div className="xp-bar">
                            <div className="xp-bar-fill" style={{ width: `${xpProgress * 100}%` }} />
                        </div>
                        {xpLevel > 0 && (
                            <div className="xp-level">{xpLevel}</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default HUD;
