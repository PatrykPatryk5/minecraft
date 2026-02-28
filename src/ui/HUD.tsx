/**
 * HUD — Crosshair, hotbar with 3D block icons, health/hunger, XP bar, oxygen bar
 * Features: mining crack overlay, heart shake on damage, absorption hearts,
 *           durability bar in hotbar, animated status effects.
 */

import React, { useEffect, useRef, useState } from 'react';
import useGameStore from '../store/gameStore';
import { BLOCK_DATA, BlockType } from '../core/blockTypes';
import { getBlockIcon } from '../core/textures';

// Mining crack stages: 0-9 (maps miningProgress 0-1 to 10 visual stages)
const CRACK_STAGES = 10;

const HUD: React.FC = () => {
    const hotbar = useGameStore((s) => s.hotbar);
    const hotbarSlot = useGameStore((s) => s.hotbarSlot);
    const setHotbarSlot = useGameStore((s) => s.setHotbarSlot);
    const isLocked = useGameStore((s) => s.isLocked);
    const activeOverlay = useGameStore((s) => s.activeOverlay);
    const gameMode = useGameStore((s) => s.gameMode);
    const health = useGameStore((s) => s.health);
    const maxHealth = useGameStore((s) => s.maxHealth);
    const hunger = useGameStore((s) => s.hunger);
    const xpLevel = useGameStore((s) => s.xpLevel);
    const xpProgress = useGameStore((s) => s.xpProgress);
    const oxygen = useGameStore((s) => s.oxygen);
    const maxOxygen = useGameStore((s) => s.maxOxygen);
    const isChatOpen = useGameStore((s) => s.isChatOpen);
    const miningProg = useGameStore((s) => s.miningProgressValue);
    const isUnderwater = useGameStore((s) => s.isUnderwater);
    const armorSlots = useGameStore((s) => s.armor);
    const absorption = useGameStore((s) => s.absorption);

    // Heart shake animation state
    const [heartShake, setHeartShake] = useState(false);
    const prevHealth = useRef(health);
    useEffect(() => {
        if (health < prevHealth.current) {
            setHeartShake(true);
            const t = setTimeout(() => setHeartShake(false), 500);
            prevHealth.current = health;
            return () => clearTimeout(t);
        }
        prevHealth.current = health;
    }, [health]);

    // Golden apple visual tracker is no longer fully needed since we have absorption in store,
    // but kept if we want pulsing effects
    const prevWasGoldenApple = useRef(false);
    useEffect(() => {
        const unsub = useGameStore.subscribe((s) => {
            const sel = s.hotbar[s.hotbarSlot];
            if (sel?.id === BlockType.GOLDEN_APPLE) {
                prevWasGoldenApple.current = true;
            }
        });
        return unsub;
    }, []);

    const armorPoints = React.useMemo(() => {
        let total = 0;
        if (armorSlots.helmet.id) total += BLOCK_DATA[armorSlots.helmet.id]?.armorPoints || 0;
        if (armorSlots.chestplate.id) total += BLOCK_DATA[armorSlots.chestplate.id]?.armorPoints || 0;
        if (armorSlots.leggings.id) total += BLOCK_DATA[armorSlots.leggings.id]?.armorPoints || 0;
        if (armorSlots.boots.id) total += BLOCK_DATA[armorSlots.boots.id]?.armorPoints || 0;
        return total;
    }, [armorSlots]);

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

    // Mining crack: map 0-1 progress to 0-9 stage
    const crackStage = miningProg > 0 && miningProg < 1
        ? Math.min(CRACK_STAGES - 1, Math.floor(miningProg * CRACK_STAGES))
        : -1;

    return (
        <div className="hud">
            {/* Crosshair */}
            <div className="crosshair">
                <div className="crosshair-h" />
                <div className="crosshair-v" />
            </div>

            {/* Underwater Overlay */}
            {isUnderwater && <div className="water-overlay" />}

            {/* Mining Progress Bar + Crack Stage indicator */}
            {miningProg > 0 && miningProg < 1 && (
                <div className="mining-progress-container">
                    <div className="mining-progress-label">
                        {[...Array(CRACK_STAGES)].map((_, i) => (
                            <div
                                key={i}
                                className={`mining-crack-pip ${i <= crackStage ? 'active' : ''}`}
                            />
                        ))}
                    </div>
                    <div className="mining-progress-bar">
                        <div
                            className="mining-progress-fill"
                            style={{ width: `${miningProg * 100}%` }}
                        />
                    </div>
                </div>
            )}

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
                            <span>PPM na stół — crafting 3×3</span>
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
                    const durPct = (slot.durability !== undefined && data?.maxDurability)
                        ? slot.durability / data.maxDurability
                        : null;
                    const durColor = durPct !== null
                        ? `hsl(${Math.round(durPct * 120)}, 100%, 45%)`
                        : 'transparent';
                    return (
                        <div key={i} className={`hotbar-slot${sel ? ' selected' : ''}`} onClick={() => setHotbarSlot(i)}>
                            {slot.id > 0 && icon && (
                                <>
                                    <img
                                        src={icon}
                                        className={`block-icon-3d${(slot as any).sharpness || (slot as any).efficiency ? ' enchanted-glow' : ''
                                            }`}
                                        alt={data?.name ?? ''}
                                        draggable={false}
                                    />
                                    {slot.count > 1 && <span className="item-count">{slot.count}</span>}
                                    {/* Durability bar */}
                                    {durPct !== null && durPct < 1 && (
                                        <div className="durability-bar-bg">
                                            <div
                                                className="durability-bar-fill"
                                                style={{
                                                    width: `${durPct * 100}%`,
                                                    backgroundColor: durColor,
                                                }}
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                            <span className="slot-number">{i + 1}</span>
                            {sel && data && (
                                <div className="slot-name">
                                    {data.name}
                                    {(slot as any).sharpness ? <span className="enchant-tag"> ✨ Ostrość {(slot as any).sharpness}</span> : null}
                                    {(slot as any).efficiency ? <span className="enchant-tag"> ⚡ Efektywność {(slot as any).efficiency}</span> : null}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Health + Hunger (survival only) */}
            {showBars && (
                <div className="status-bars">
                    {armorPoints > 0 && (
                        <div className="armor-bar" title={`Zbroja: ${armorPoints}/20 punktów`}>
                            {Array.from({ length: 10 }, (_, i) => {
                                const filled = armorPoints >= (i + 1) * 2;
                                const partial = !filled && armorPoints >= (i * 2) + 1;
                                return (
                                    <span key={i} className={`armor-icon${filled ? '' : partial ? ' partial' : ' empty'}`}>
                                        {filled ? '🛡️' : partial ? '🛡️' : '🕳️'}
                                    </span>
                                );
                            })}
                            <span style={{ fontSize: '9px', opacity: 0.7, marginLeft: '2px' }}>{armorPoints}</span>
                        </div>
                    )}
                    <div className="bar-row">
                        <div className={`hearts${heartShake ? ' shake' : ''}`}>
                            {Array.from({ length: 10 }, (_, i) => {
                                const filled = i < halfHearts;
                                return (
                                    <span
                                        key={i}
                                        className={`heart${filled ? '' : ' empty'}`}
                                        style={{ animationDelay: heartShake ? `${i * 25}ms` : '0ms' }}
                                    >
                                        {filled ? '❤' : '🖤'}
                                    </span>
                                );
                            })}
                            {/* Absorption Hearts (Golden) */}
                            {absorption > 0 && Array.from({ length: Math.ceil(absorption / 2) }, (_, i) => {
                                const filled = absorption >= (i + 1) * 2;
                                return (
                                    <span
                                        key={`abs-${i}`}
                                        className={`heart absorption${!filled ? ' partial' : ''}`}
                                        style={{ color: '#FFD700', textShadow: '0 0 4px #FFD700', marginLeft: '2px' }}
                                        title={!filled ? 'Połowa złotego serca' : 'Złote serce'}
                                    >
                                        💛
                                    </span>
                                );
                            })}
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
