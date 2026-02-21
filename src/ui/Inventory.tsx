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

    const cursorItem = useGameStore((s) => s.cursorItem);
    const setCursorItem = useGameStore((s) => s.setCursorItem);

    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            setMousePos({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener('mousemove', onMouseMove);
        return () => window.removeEventListener('mousemove', onMouseMove);
    }, []);

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
        const s = useGameStore.getState();
        if (s.gameMode === 'survival') {
            for (const slot of invCraftGrid) {
                if (slot.id > 0) s.addItem(slot.id, slot.count, slot.durability);
            }
            if (s.cursorItem) {
                s.addItem(s.cursorItem.id, s.cursorItem.count, s.cursorItem.durability);
                s.setCursorItem(null);
            }
        } else {
            s.setCursorItem(null);
        }
        setInvCraftGrid(Array(4).fill({ id: 0, count: 0 }));
        setOverlay('none');
        playSound('close');
        document.querySelector('canvas')?.requestPointerLock();
    };

    // 2x2 crafting result
    const craftResult = useMemo(() => matchRecipe(invCraftGrid.map(s => s.id), 2), [invCraftGrid]);

    const craftItem2x2 = () => {
        if (!craftResult) return;
        playSound('craft');

        // Consume ingredients
        const newGrid = [...invCraftGrid];
        for (let i = 0; i < newGrid.length; i++) {
            if (newGrid[i].id > 0) {
                newGrid[i] = { ...newGrid[i], count: newGrid[i].count - 1 };
                if (newGrid[i].count <= 0) {
                    newGrid[i] = { id: 0, count: 0 };
                }
            }
        }
        setInvCraftGrid(newGrid);

        const s = useGameStore.getState();
        if (!s.cursorItem) {
            s.setCursorItem({ id: craftResult.result, count: craftResult.count });
        } else if (s.cursorItem.id === craftResult.result && s.cursorItem.count + craftResult.count <= 64) {
            s.setCursorItem({ ...s.cursorItem, count: s.cursorItem.count + craftResult.count });
        } else {
            s.addItem(craftResult.result, craftResult.count);
        }
    };

    // Interaction with 2x2 grid (Place 1 / Take 1)
    const handleCraftGridClick = (index: number) => {
        playSound('click');
        const newGrid = [...invCraftGrid];
        const slot = newGrid[index];

        if (cursorItem) {
            // Place 1 item from cursor
            if (slot.id === 0) {
                newGrid[index] = { id: cursorItem.id, count: 1, durability: cursorItem.durability };
                setInvCraftGrid(newGrid);
                if (gameMode === 'survival') {
                    const newCursor = { ...cursorItem, count: cursorItem.count - 1 };
                    setCursorItem(newCursor.count > 0 ? newCursor : null);
                }
            } else if (slot.id === cursorItem.id && slot.count < 64) {
                // Add 1 to stack
                newGrid[index] = { ...slot, count: slot.count + 1 };
                setInvCraftGrid(newGrid);
                if (gameMode === 'survival') {
                    const newCursor = { ...cursorItem, count: cursorItem.count - 1 };
                    setCursorItem(newCursor.count > 0 ? newCursor : null);
                }
            } else {
                // Swap
                const temp = { ...slot };
                newGrid[index] = cursorItem;
                setInvCraftGrid(newGrid);
                setCursorItem(temp);
            }
        } else if (slot.id !== 0) {
            // Pick up
            setCursorItem({ ...slot });
            newGrid[index] = { id: 0, count: 0 };
            setInvCraftGrid(newGrid);
        }
    };

    // Helper for Palette (fill crafting slot from inventory/creative)
    const setCraftSlotFromPalette = (index: number, blockId: number) => {
        const newGrid = [...invCraftGrid];
        if (gameMode === 'survival' && blockId !== 0) {
            const s = useGameStore.getState();
            // Consume 1 item from inventory
            const newHotbar = s.hotbar.map(sl => ({ ...sl }));
            const newInv = s.inventory.map(sl => ({ ...sl }));
            let found = false;
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

        // If slot had item, return it
        if (gameMode === 'survival' && newGrid[index].id > 0) {
            useGameStore.getState().addItem(newGrid[index].id, newGrid[index].count, newGrid[index].durability);
        }
        newGrid[index] = { id: blockId, count: 1 };
        setInvCraftGrid(newGrid);
        playSound('click');
    };


    if (activeOverlay !== 'inventory') return null;

    const handleSlotClick = (source: 'hotbar' | 'inv', index: number) => {
        playSound('click');
        const arr = source === 'hotbar' ? hotbar : inventory;
        const setArr = source === 'hotbar' ? setHotbar : setInventory;
        const newArr = arr.map(s => ({ ...s }));

        if (cursorItem) {
            const old = newArr[index];
            if (old.id === cursorItem.id && old.count < 64) {
                const add = Math.min(cursorItem.count, 64 - old.count);
                newArr[index].count += add;
                const remaining = cursorItem.count - add;
                setArr(newArr);
                setCursorItem(remaining > 0 ? { id: cursorItem.id, count: remaining } : null);
            } else {
                newArr[index] = cursorItem;
                setArr(newArr);
                setCursorItem(old.id ? old : null);
            }
        } else if (arr[index].id) {
            setCursorItem({ ...arr[index] });
            newArr[index] = { id: 0, count: 0 };
            setArr(newArr);
        }
    };

    const handlePaletteClick = (blockId: number) => {
        playSound('click');
        setCursorItem({ id: blockId, count: 64 });
    };

    const renderSlot = (slot: InventorySlot, onClick: () => void, selected = false) => {
        const icon = slot.id ? getBlockIcon(slot.id) : null;
        const data = slot.id ? BLOCK_DATA[slot.id] : null;
        return (
            <div className={`inv-slot${selected ? ' selected' : ''}${cursorItem ? ' droppable' : ''}`}
                onClick={onClick} title={data?.name ?? ''}>
                {slot.id > 0 && icon && (
                    <>
                        <img src={icon} className="block-icon-3d" alt="" draggable={false} />
                        {slot.count > 1 && <span className="item-count">{slot.count}</span>}
                        {slot.durability !== undefined && data?.maxDurability && (
                            <div style={{
                                position: 'absolute', bottom: '2px', left: '2px', right: '2px',
                                height: '3px', backgroundColor: '#000', borderRadius: '1px'
                            }}>
                                <div style={{
                                    width: `${(slot.durability / data.maxDurability) * 100}%`,
                                    height: '100%',
                                    backgroundColor: `hsl(${((slot.durability / data.maxDurability) * 120).toString(10)}, 100%, 50%)`,
                                }} />
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };

    const allItems = [...PLACEABLE_BLOCKS, ...ITEM_BLOCKS];
    const filteredAllItems = useMemo(() => {
        if (!searchTerm) return allItems;
        const low = searchTerm.toLowerCase();
        return allItems.filter(id => BLOCK_DATA[id]?.name.toLowerCase().includes(low));
    }, [allItems, searchTerm]);

    const availableItems = gameMode === 'creative' ? filteredAllItems : getPlayerItems();

    const close = () => {
        closeInv();
    };



    return (
        <div className="inventory-overlay" onClick={close}>
            <div className="inventory-window" onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3>📦 Ekwipunek</h3>
                    {gameMode === 'creative' && (
                        <input
                            type="text"
                            placeholder="Szukaj..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="mc-search-input"
                            autoFocus
                        />
                    )}
                </div>

                {/* 2x2 Crafting Grid (top section) */}
                <div className="inv-crafting-section">
                    <div className="inv-section-label">Craftowanie (2×2)</div>
                    <div className="inv-crafting-layout">
                        <div className="inv-crafting-grid">
                            {invCraftGrid.map((slot, i) => {
                                const icon = slot.id ? getBlockIcon(slot.id) : null;
                                return (
                                    <div key={i} className={`craft-slot${slot.id ? ' filled' : ''}`}
                                        onClick={() => handleCraftGridClick(i)}
                                        title={slot.id ? BLOCK_DATA[slot.id]?.name : ''}>
                                        {slot.id > 0 && icon && (
                                            <>
                                                <img src={icon} className="block-icon-3d" alt="" draggable={false} />
                                                {slot.count > 1 && <span className="item-count">{slot.count}</span>}
                                            </>
                                        )}
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
                                    const emptyIdx = invCraftGrid.findIndex(v => v.id === 0);
                                    if (emptyIdx >= 0) setCraftSlotFromPalette(emptyIdx, id);
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
                            {filteredAllItems.map((id) => {
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

            {/* Floating Cursor Item */}
            {cursorItem && (
                <div style={{
                    position: 'fixed',
                    left: mousePos.x,
                    top: mousePos.y,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    zIndex: 9999,
                    width: '48px',
                    height: '48px',
                }}>
                    <img
                        src={getBlockIcon(cursorItem.id)}
                        className="block-icon-3d"
                        alt=""
                        style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.5))' }}
                    />
                    {cursorItem.count > 1 && (
                        <span className="item-count" style={{ fontSize: '1.2rem', textShadow: '2px 2px 0 #000' }}>
                            {cursorItem.count}
                        </span>
                    )}
                </div>
            )}
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
