/**
 * Crafting Screen (3×3 crafting table) — Opens via right-click on Crafting Table block
 * Also accessible via C key as before
 */

import React, { useEffect, useState, useMemo } from 'react';
import useGameStore from '../store/gameStore';
import { BLOCK_DATA, PLACEABLE_BLOCKS, ITEM_BLOCKS } from '../core/blockTypes';
import { getBlockIcon } from '../core/textures';
import { matchRecipe } from '../core/crafting';
import type { InventorySlot } from '../store/gameStore';
import { playSound } from '../audio/sounds';

const CraftingScreen: React.FC = () => {
    const activeOverlay = useGameStore((s) => s.activeOverlay);
    const setOverlay = useGameStore((s) => s.setOverlay);
    const craftingGrid = useGameStore((s) => s.craftingGrid);
    const setCraftingGrid = useGameStore((s) => s.setCraftingGrid);
    const hotbar = useGameStore((s) => s.hotbar);
    const setHotbar = useGameStore((s) => s.setHotbar);
    const inventory = useGameStore((s) => s.inventory);
    const setInventory = useGameStore((s) => s.setInventory);
    const gameMode = useGameStore((s) => s.gameMode);
    const screen = useGameStore((s) => s.screen);

    const cursorItem = useGameStore((s) => s.cursorItem);
    const setCursorItem = useGameStore((s) => s.setCursorItem);

    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            setMousePos({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener('mousemove', onMouseMove);
        return () => window.removeEventListener('mousemove', onMouseMove);
    }, []);

    // C key closing
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.code !== 'KeyC' || screen !== 'playing') return;
            const s = useGameStore.getState();
            if (s.isChatOpen) return;
            if (s.activeOverlay === 'crafting') {
                closeCrafting();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [screen]);

    // ESC to close
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.code === 'Escape' && useGameStore.getState().activeOverlay === 'crafting') {
                e.preventDefault(); e.stopPropagation();
                closeCrafting();
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, []);

    const closeCrafting = () => {
        const s = useGameStore.getState();
        if (s.gameMode === 'survival') {
            for (const slot of craftingGrid) {
                if (slot.id > 0) s.addItem(slot.id, slot.count, slot.durability);
            }
            if (s.cursorItem) {
                s.addItem(s.cursorItem.id, s.cursorItem.count, s.cursorItem.durability);
                s.setCursorItem(null);
            }
        } else {
            s.setCursorItem(null);
        }
        setCraftingGrid(Array(9).fill({ id: 0, count: 0 }));
        setOverlay('none');
        playSound('close');
        document.querySelector('canvas')?.requestPointerLock();
    };

    const craftResult = useMemo(() => matchRecipe(craftingGrid.map(s => s.id), 3), [craftingGrid]);

    const craftItem = () => {
        if (!craftResult) return;
        playSound('craft');

        // Consume ingredients
        const newGrid = [...craftingGrid];
        for (let i = 0; i < newGrid.length; i++) {
            if (newGrid[i].id > 0) {
                newGrid[i] = { ...newGrid[i], count: newGrid[i].count - 1 };
                if (newGrid[i].count <= 0) {
                    newGrid[i] = { id: 0, count: 0 };
                }
            }
        }
        setCraftingGrid(newGrid);

        const s = useGameStore.getState();
        if (!s.cursorItem) {
            s.setCursorItem({ id: craftResult.result, count: craftResult.count });
        } else if (s.cursorItem.id === craftResult.result && s.cursorItem.count + craftResult.count <= 64) {
            s.setCursorItem({ ...s.cursorItem, count: s.cursorItem.count + craftResult.count });
        } else {
            s.addItem(craftResult.result, craftResult.count);
        }
    };

    const handleCraftGridClick = (index: number) => {
        playSound('click');
        const newGrid = [...craftingGrid];
        const slot = newGrid[index];

        if (cursorItem) {
            if (slot.id === 0) {
                // Place 1 from cursor
                newGrid[index] = { id: cursorItem.id, count: 1, durability: cursorItem.durability };
                setCraftingGrid(newGrid);
                if (gameMode === 'survival') {
                    const newCursor = { ...cursorItem, count: cursorItem.count - 1 };
                    setCursorItem(newCursor.count > 0 ? newCursor : null);
                }
            } else if (slot.id === cursorItem.id && slot.count < 64) {
                // Add 1 to stack
                newGrid[index] = { ...slot, count: slot.count + 1 };
                setCraftingGrid(newGrid);
                if (gameMode === 'survival') {
                    const newCursor = { ...cursorItem, count: cursorItem.count - 1 };
                    setCursorItem(newCursor.count > 0 ? newCursor : null);
                }
            } else {
                // Swap cursor and slot
                const temp = { ...slot };
                newGrid[index] = cursorItem;
                setCraftingGrid(newGrid);
                setCursorItem(temp);
            }
        } else if (slot.id !== 0) {
            // Pick up half stack if right clicked? For now just pick up all.
            // Oh, we just pick all.
            setCursorItem({ ...slot });
            newGrid[index] = { id: 0, count: 0 };
            setCraftingGrid(newGrid);
        }
    };

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

    const clearGrid = () => {
        if (gameMode === 'survival') {
            for (const slot of craftingGrid) {
                if (slot.id > 0) useGameStore.getState().addItem(slot.id, slot.count, slot.durability);
            }
        }
        setCraftingGrid(Array(9).fill({ id: 0, count: 0 }));
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

    if (activeOverlay !== 'crafting') return null;

    const allItems = [...PLACEABLE_BLOCKS, ...ITEM_BLOCKS];

    return (
        <div className="inventory-overlay" onClick={closeCrafting}>
            <div className="inventory-window" onClick={(e) => e.stopPropagation()}>
                <h3>⚒ Stół Rzemieślniczy</h3>

                <div className="inv-crafting-section">
                    <div className="inv-section-label">Craftowanie (3×3)</div>
                    <div className="inv-crafting-layout" style={{ justifyContent: 'center' }}>
                        <div className="crafting-grid" style={{
                            display: 'grid', gridTemplateColumns: 'repeat(3, 44px)', gap: '4px',
                            background: 'rgba(0,0,0,0.5)', padding: '6px', borderRadius: '4px'
                        }}>
                            {craftingGrid.map((slot, i) => {
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
                        <div className="craft-arrow" style={{ padding: '0 20px' }}>→</div>
                        <div className={`craft-result${craftResult ? ' has-result' : ''}`}
                            onClick={craftResult ? craftItem : undefined}>
                            {craftResult ? (
                                <>
                                    <img src={getBlockIcon(craftResult.result)} className="block-icon-3d large" alt="" draggable={false} />
                                    {craftResult.count > 1 && <span className="result-count">×{craftResult.count}</span>}
                                </>
                            ) : (
                                <span className="no-result">?</span>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                    <button className="mc-btn" onClick={clearGrid} style={{ maxWidth: '200px' }}>Wyczyść siatkę</button>
                </div>

                {/* Creative palette */}
                {gameMode === 'creative' && (
                    <>
                        <div className="inv-section-label">Bloki (kliknij aby wziąć)</div>
                        <div className="craft-palette" style={{ maxHeight: '120px' }}>
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

                <div className="inv-hint">Kliknij slot aby przenieść • ESC — zamknij</div>
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

export default CraftingScreen;
