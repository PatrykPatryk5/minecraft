/**
 * Inventory Screen (E key) — With 2x2 crafting grid + drag/drop
 */

import React, { useEffect, useState, useMemo } from 'react';
import useGameStore from '../store/gameStore';
import { BLOCK_DATA, PLACEABLE_BLOCKS, ITEM_BLOCKS } from '../core/blockTypes';
import { getBlockIcon } from '../core/textures';
import { matchRecipe } from '../core/crafting';
import type { InventorySlot } from '../store/gameStore';
import { playSound } from '../audio/sounds';

const Inventory: React.FC = () => {
    const activeOverlay = useGameStore((s) => s.activeOverlay);
    const setOverlay = useGameStore((s) => s.setOverlay);
    const hotbar = useGameStore((s) => s.hotbar);
    const setHotbar = useGameStore((s) => s.setHotbar);
    const inventory = useGameStore((s) => s.inventory);
    const setInventory = useGameStore((s) => s.setInventory);
    const gameMode = useGameStore((s) => s.gameMode);
    const screen = useGameStore((s) => s.screen);
    const invCraftGrid = useGameStore((s) => s.inventoryCraftingGrid);
    const setInvCraftGrid = useGameStore((s) => s.setInventoryCraftingGrid);

    const [held, setHeld] = useState<InventorySlot | null>(null);

    // E key toggle
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.code !== 'KeyE' || screen !== 'playing') return;
            const s = useGameStore.getState();
            if (s.isChatOpen) return;
            if (s.activeOverlay === 'none') {
                setOverlay('inventory');
                playSound('open');
                document.exitPointerLock();
            } else if (s.activeOverlay === 'inventory') {
                closeInv();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [setOverlay, screen]);

    // ESC to close
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.code === 'Escape' && useGameStore.getState().activeOverlay === 'inventory') {
                e.preventDefault(); e.stopPropagation();
                closeInv();
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, []);

    const closeInv = () => {
        // Return 2x2 crafting items to player
        if (useGameStore.getState().gameMode === 'survival') {
            for (const id of invCraftGrid) {
                if (id) useGameStore.getState().addItem(id, 1);
            }
        }
        setInvCraftGrid(Array(4).fill(0));
        setOverlay('none');
        setHeld(null);
        playSound('close');
        document.querySelector('canvas')?.requestPointerLock();
    };

    // 2x2 crafting result
    const craftResult = useMemo(() => matchRecipe(invCraftGrid, 2), [invCraftGrid]);

    const craftItem2x2 = () => {
        if (!craftResult) return;
        playSound('craft');
        setInvCraftGrid(Array(4).fill(0));
        useGameStore.getState().addItem(craftResult.result, craftResult.count);
    };

    const setCraftSlot = (index: number, blockId: number) => {
        const newGrid = [...invCraftGrid];
        if (gameMode === 'survival' && blockId !== 0) {
            const s = useGameStore.getState();
            let found = false;
            const newHotbar = s.hotbar.map(sl => ({ ...sl }));
            const newInv = s.inventory.map(sl => ({ ...sl }));

            for (let i = 0; i < 9 && !found; i++) {
                if (newHotbar[i].id === blockId && newHotbar[i].count > 0) {
                    newHotbar[i].count--;
                    if (newHotbar[i].count <= 0) newHotbar[i] = { id: 0, count: 0 };
                    found = true;
                }
            }
            for (let i = 0; i < 27 && !found; i++) {
                if (newInv[i].id === blockId && newInv[i].count > 0) {
                    newInv[i].count--;
                    if (newInv[i].count <= 0) newInv[i] = { id: 0, count: 0 };
                    found = true;
                }
            }
            if (!found) return;
            s.setHotbar(newHotbar);
            s.setInventory(newInv);
        }
        if (gameMode === 'survival' && newGrid[index]) {
            useGameStore.getState().addItem(newGrid[index], 1);
        }
        newGrid[index] = blockId;
        setInvCraftGrid(newGrid);
        playSound('click');
    };

    if (activeOverlay !== 'inventory') return null;

    const handleSlotClick = (source: 'hotbar' | 'inv', index: number) => {
        playSound('click');
        const arr = source === 'hotbar' ? hotbar : inventory;
        const setArr = source === 'hotbar' ? setHotbar : setInventory;
        const newArr = arr.map(s => ({ ...s }));

        if (held) {
            const old = newArr[index];
            if (old.id === held.id && old.count < 64) {
                const add = Math.min(held.count, 64 - old.count);
                newArr[index].count += add;
                const remaining = held.count - add;
                setArr(newArr);
                setHeld(remaining > 0 ? { id: held.id, count: remaining } : null);
            } else {
                newArr[index] = held;
                setArr(newArr);
                setHeld(old.id ? old : null);
            }
        } else if (arr[index].id) {
            setHeld({ ...arr[index] });
            newArr[index] = { id: 0, count: 0 };
            setArr(newArr);
        }
    };

    const handlePaletteClick = (blockId: number) => {
        playSound('click');
        setHeld({ id: blockId, count: 64 });
    };

    const renderSlot = (slot: InventorySlot, onClick: () => void, selected = false) => {
        const icon = slot.id ? getBlockIcon(slot.id) : null;
        const data = slot.id ? BLOCK_DATA[slot.id] : null;
        return (
            <div className={`inv-slot${selected ? ' selected' : ''}${held ? ' droppable' : ''}`}
                onClick={onClick} title={data?.name ?? ''}>
                {slot.id > 0 && icon && (
                    <>
                        <img src={icon} className="block-icon-3d" alt="" draggable={false} />
                        {slot.count > 1 && <span className="item-count">{slot.count}</span>}
                    </>
                )}
            </div>
        );
    };

    const allItems = [...PLACEABLE_BLOCKS, ...ITEM_BLOCKS];
    const availableItems = gameMode === 'creative' ? allItems : getPlayerItems();

    const close = () => {
        closeInv();
    };

    return (
        <div className="inventory-overlay" onClick={close}>
            <div className="inventory-window" onClick={(e) => e.stopPropagation()}>
                <h3>📦 Ekwipunek</h3>

                {held && (
                    <div className="holding-info">
                        Trzymasz: <strong>{BLOCK_DATA[held.id]?.name ?? '?'} ×{held.count}</strong>
                        <button className="drop-btn" onClick={() => setHeld(null)}>Upuść</button>
                    </div>
                )}

                {/* 2x2 Crafting Grid (top section) */}
                <div className="inv-crafting-section">
                    <div className="inv-section-label">Craftowanie (2×2)</div>
                    <div className="inv-crafting-layout">
                        <div className="inv-crafting-grid">
                            {invCraftGrid.map((id, i) => {
                                const icon = id ? getBlockIcon(id) : null;
                                return (
                                    <div key={i} className={`craft-slot${id ? ' filled' : ''}`}
                                        onClick={() => setCraftSlot(i, 0)}
                                        title={id ? BLOCK_DATA[id]?.name : ''}>
                                        {id > 0 && icon && <img src={icon} className="block-icon-3d" alt="" draggable={false} />}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="craft-arrow">→</div>
                        <div className={`craft-result small${craftResult ? ' has-result' : ''}`}
                            onClick={craftResult ? craftItem2x2 : undefined}>
                            {craftResult ? (
                                <>
                                    <img src={getBlockIcon(craftResult.result)} className="block-icon-3d" alt="" draggable={false} />
                                    {craftResult.count > 1 && <span className="result-count">×{craftResult.count}</span>}
                                </>
                            ) : (
                                <span className="no-result">?</span>
                            )}
                        </div>
                    </div>

                    {/* Quick palette for 2x2 grid */}
                    <div className="craft-palette mini">
                        {availableItems.slice(0, 20).map((id) => {
                            const data = BLOCK_DATA[id];
                            if (!data) return null;
                            const icon = getBlockIcon(id);
                            return (
                                <div key={id} className="palette-slot" onClick={() => {
                                    const emptyIdx = invCraftGrid.findIndex(v => v === 0);
                                    if (emptyIdx >= 0) setCraftSlot(emptyIdx, id);
                                }} title={data.name}>
                                    {icon && <img src={icon} className="block-icon-3d small" alt="" draggable={false} />}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Creative palette */}
                {gameMode === 'creative' && (
                    <>
                        <div className="inv-section-label">Bloki (kliknij aby wziąć)</div>
                        <div className="craft-palette" style={{ maxHeight: '160px' }}>
                            {allItems.map((id) => {
                                const data = BLOCK_DATA[id];
                                if (!data) return null;
                                const icon = getBlockIcon(id);
                                return (
                                    <div key={id} className="palette-slot" onClick={() => handlePaletteClick(id)} title={data.name}>
                                        {icon && <img src={icon} className="block-icon-3d small" alt="" draggable={false} />}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* Main Inventory 3×9 */}
                <div className="inv-section-label">Plecak</div>
                <div className="inv-grid">
                    {inventory.map((slot, i) => (
                        <React.Fragment key={i}>{renderSlot(slot, () => handleSlotClick('inv', i))}</React.Fragment>
                    ))}
                </div>

                {/* Hotbar */}
                <div className="inv-section-label">Pasek szybkiego dostępu</div>
                <div className="inv-hotbar">
                    {hotbar.map((slot, i) => (
                        <React.Fragment key={i}>{renderSlot(slot, () => handleSlotClick('hotbar', i), i === useGameStore.getState().hotbarSlot)}</React.Fragment>
                    ))}
                </div>

                <div className="inv-hint">Kliknij slot aby przenieść • Stackuj takie same • E — zamknij</div>
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

export default Inventory;
