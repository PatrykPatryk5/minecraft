/**
 * Furnace Screen — Opens via right-click on Furnace block
 * Smelting with fuel, progress bar, input/fuel/output slots
 */

import React, { useEffect, useRef, useMemo } from 'react';
import useGameStore from '../store/gameStore';
import { BLOCK_DATA } from '../core/blockTypes';
import { getBlockIcon } from '../core/textures';
import { findSmeltingRecipe, getFuelValue } from '../core/crafting';
import type { FurnaceState, InventorySlot } from '../store/gameStore';
import { playSound } from '../audio/sounds';

const emptySlot = (): InventorySlot => ({ id: 0, count: 0 });

const FurnaceScreen: React.FC = () => {
    const activeOverlay = useGameStore((s) => s.activeOverlay);
    const setOverlay = useGameStore((s) => s.setOverlay);
    const furnace = useGameStore((s) => s.furnace);
    const setFurnace = useGameStore((s) => s.setFurnace);
    const screen = useGameStore((s) => s.screen);
    const gameMode = useGameStore((s) => s.gameMode);
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ESC to close
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.code === 'Escape' && useGameStore.getState().activeOverlay === 'furnace') {
                e.preventDefault(); e.stopPropagation();
                closeFurnace();
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, []);

    // Smelting tick (runs at 20 TPS when open)
    useEffect(() => {
        if (activeOverlay !== 'furnace') return;

        tickRef.current = setInterval(() => {
            const s = useGameStore.getState();
            const f = { ...s.furnace };
            const input = { ...f.inputSlot };
            const fuel = { ...f.fuelSlot };
            const output = { ...f.outputSlot };
            let changed = false;

            // Try to start burning new fuel
            if (f.burnTimeRemaining <= 0 && input.id > 0) {
                const recipe = findSmeltingRecipe(input.id);
                if (recipe && fuel.id > 0) {
                    const fuelVal = getFuelValue(fuel.id);
                    if (fuelVal > 0) {
                        // Check output compatibility
                        if (output.id === 0 || (output.id === recipe.output && output.count < 64)) {
                            f.burnTimeRemaining = Math.floor(fuelVal * 200);
                            f.burnTimeTotal = f.burnTimeRemaining;
                            fuel.count--;
                            if (fuel.count <= 0) { fuel.id = 0; fuel.count = 0; }
                            changed = true;
                        }
                    }
                }
            }

            // Cook progress
            if (f.burnTimeRemaining > 0) {
                f.burnTimeRemaining--;
                changed = true;

                const recipe = findSmeltingRecipe(input.id);
                if (recipe && (output.id === 0 || (output.id === recipe.output && output.count < 64))) {
                    f.cookProgress++;
                    if (f.cookProgress >= recipe.duration) {
                        // Complete smelt!
                        f.cookProgress = 0;
                        input.count--;
                        if (input.count <= 0) { input.id = 0; input.count = 0; }
                        if (output.id === 0) {
                            output.id = recipe.output;
                            output.count = recipe.count;
                        } else {
                            output.count += recipe.count;
                        }
                        playSound('xp');
                    }
                } else {
                    // No valid recipe, reset cook progress
                    if (f.cookProgress > 0) {
                        f.cookProgress = 0;
                        changed = true;
                    }
                }
            } else {
                if (f.cookProgress > 0) {
                    f.cookProgress = 0;
                    changed = true;
                }
            }

            if (changed) {
                f.inputSlot = input;
                f.fuelSlot = fuel;
                f.outputSlot = output;
                s.setFurnace(f);
            }
        }, 50); // 20 TPS

        return () => {
            if (tickRef.current) clearInterval(tickRef.current);
        };
    }, [activeOverlay]);

    const closeFurnace = () => {
        setOverlay('none');
        playSound('close');
        document.querySelector('canvas')?.requestPointerLock();
    };

    const handleInputClick = () => {
        const s = useGameStore.getState();
        const f = { ...s.furnace };
        if (f.inputSlot.id > 0) {
            s.addItem(f.inputSlot.id, f.inputSlot.count);
            f.inputSlot = emptySlot();
            s.setFurnace(f);
            playSound('click');
        }
    };

    const handleFuelClick = () => {
        const s = useGameStore.getState();
        const f = { ...s.furnace };
        if (f.fuelSlot.id > 0) {
            s.addItem(f.fuelSlot.id, f.fuelSlot.count);
            f.fuelSlot = emptySlot();
            s.setFurnace(f);
            playSound('click');
        }
    };

    const handleOutputClick = () => {
        const s = useGameStore.getState();
        const f = { ...s.furnace };
        if (f.outputSlot.id > 0) {
            s.addItem(f.outputSlot.id, f.outputSlot.count);
            f.outputSlot = emptySlot();
            s.setFurnace(f);
            playSound('click');
        }
    };

    const addToSlot = (slotKey: 'inputSlot' | 'fuelSlot', itemId: number) => {
        const s = useGameStore.getState();
        const f = { ...s.furnace };
        const slot = { ...f[slotKey] };

        if (gameMode === 'survival') {
            // Remove from player inventory
            let found = false;
            const hb = s.hotbar.map(sl => ({ ...sl }));
            const inv = s.inventory.map(sl => ({ ...sl }));
            for (let i = 0; i < 9 && !found; i++) {
                if (hb[i].id === itemId && hb[i].count > 0) {
                    hb[i].count--;
                    if (hb[i].count <= 0) hb[i] = { id: 0, count: 0 };
                    found = true;
                }
            }
            for (let i = 0; i < 27 && !found; i++) {
                if (inv[i].id === itemId && inv[i].count > 0) {
                    inv[i].count--;
                    if (inv[i].count <= 0) inv[i] = { id: 0, count: 0 };
                    found = true;
                }
            }
            if (!found) return;
            s.setHotbar(hb);
            s.setInventory(inv);
        }

        if (slot.id === 0) {
            slot.id = itemId;
            slot.count = 1;
        } else if (slot.id === itemId && slot.count < 64) {
            slot.count++;
        } else {
            return; // Can't add different item
        }

        f[slotKey] = slot;
        s.setFurnace(f);
        playSound('click');
    };

    if (activeOverlay !== 'furnace') return null;

    const burnPct = furnace.burnTimeTotal > 0 ? (furnace.burnTimeRemaining / furnace.burnTimeTotal) * 100 : 0;
    const cookPct = furnace.cookTimeTotal > 0 ? (furnace.cookProgress / furnace.cookTimeTotal) * 100 : 0;

    const playerItems = gameMode === 'creative'
        ? Object.keys(BLOCK_DATA).map(Number).filter(id => id > 0)
        : getPlayerItems();

    // Filter items that can be smelted or used as fuel
    const smeltableItems = playerItems.filter(id => findSmeltingRecipe(id) !== null);
    const fuelItems = playerItems.filter(id => getFuelValue(id) > 0);

    return (
        <div className="crafting-overlay" onClick={closeFurnace}>
            <div className="crafting-window furnace-window" onClick={(e) => e.stopPropagation()}>
                <h3>🔥 Piec</h3>

                <div className="furnace-layout">
                    {/* Input slot */}
                    <div className="furnace-column">
                        <div className="inv-section-label">Surowiec</div>
                        <div className={`inv-slot furnace-slot${furnace.inputSlot.id ? ' filled' : ''}`}
                            onClick={handleInputClick}
                            title={furnace.inputSlot.id ? BLOCK_DATA[furnace.inputSlot.id]?.name : 'Puste'}>
                            {furnace.inputSlot.id > 0 && (
                                <>
                                    <img src={getBlockIcon(furnace.inputSlot.id)} className="block-icon-3d" alt="" draggable={false} />
                                    {furnace.inputSlot.count > 1 && <span className="item-count">{furnace.inputSlot.count}</span>}
                                </>
                            )}
                        </div>

                        {/* Fuel slot */}
                        <div className="inv-section-label" style={{ marginTop: 8 }}>Opał</div>
                        <div className={`inv-slot furnace-slot${furnace.fuelSlot.id ? ' filled' : ''}`}
                            onClick={handleFuelClick}
                            title={furnace.fuelSlot.id ? BLOCK_DATA[furnace.fuelSlot.id]?.name : 'Puste'}>
                            {furnace.fuelSlot.id > 0 && (
                                <>
                                    <img src={getBlockIcon(furnace.fuelSlot.id)} className="block-icon-3d" alt="" draggable={false} />
                                    {furnace.fuelSlot.count > 1 && <span className="item-count">{furnace.fuelSlot.count}</span>}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="furnace-progress">
                        <div className="furnace-fire" style={{ opacity: burnPct > 0 ? 1 : 0.3 }}>🔥</div>
                        <div className="furnace-bar-container">
                            <div className="furnace-bar" style={{ width: `${cookPct}%` }} />
                        </div>
                        <div className="craft-arrow">→</div>
                    </div>

                    {/* Output slot */}
                    <div className="furnace-column">
                        <div className="inv-section-label">Wynik</div>
                        <div className={`inv-slot furnace-slot output${furnace.outputSlot.id ? ' filled has-result' : ''}`}
                            onClick={handleOutputClick}
                            title={furnace.outputSlot.id ? BLOCK_DATA[furnace.outputSlot.id]?.name : 'Puste'}>
                            {furnace.outputSlot.id > 0 && (
                                <>
                                    <img src={getBlockIcon(furnace.outputSlot.id)} className="block-icon-3d" alt="" draggable={false} />
                                    {furnace.outputSlot.count > 1 && <span className="item-count">{furnace.outputSlot.count}</span>}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Smeltable items */}
                <div className="inv-section-label" style={{ marginTop: 12 }}>Surowce (kliknij aby dodać)</div>
                <div className="craft-palette mini">
                    {smeltableItems.map(id => {
                        const data = BLOCK_DATA[id];
                        if (!data) return null;
                        const icon = getBlockIcon(id);
                        return (
                            <div key={id} className="palette-slot" onClick={() => addToSlot('inputSlot', id)} title={data.name}>
                                {icon && <img src={icon} className="block-icon-3d small" alt="" draggable={false} />}
                            </div>
                        );
                    })}
                </div>

                {/* Fuel items */}
                <div className="inv-section-label" style={{ marginTop: 8 }}>Opał (kliknij aby dodać)</div>
                <div className="craft-palette mini">
                    {fuelItems.map(id => {
                        const data = BLOCK_DATA[id];
                        if (!data) return null;
                        const icon = getBlockIcon(id);
                        return (
                            <div key={id} className="palette-slot" onClick={() => addToSlot('fuelSlot', id)} title={data.name}>
                                {icon && <img src={icon} className="block-icon-3d small" alt="" draggable={false} />}
                            </div>
                        );
                    })}
                </div>

                <div className="inv-hint" style={{ marginTop: 8 }}>ESC — zamknij • Kliknij slot aby zabrać • Dodaj surowiec i opał</div>
            </div>
        </div>
    );
};

function getPlayerItems(): number[] {
    const s = useGameStore.getState();
    const ids = new Set<number>();
    for (const sl of [...s.hotbar, ...s.inventory]) {
        if (sl.id) ids.add(sl.id);
    }
    return Array.from(ids);
}

export default FurnaceScreen;
