/**
 * Inventory Screen (E key) — with 3D block icons
 */

import React, { useEffect, useState } from 'react';
import useGameStore from '../store/gameStore';
import { BLOCK_DATA, PLACEABLE_BLOCKS, ITEM_BLOCKS } from '../core/blockTypes';
import { getBlockIcon } from '../core/textures';
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

    const [held, setHeld] = useState<InventorySlot | null>(null);

    // E key toggle
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.code !== 'KeyE' || screen !== 'playing') return;
            const s = useGameStore.getState();
            if (s.isChatOpen) return; // Don't interfere with chat
            if (s.activeOverlay === 'none') {
                setOverlay('inventory');
                playSound('open');
                document.exitPointerLock();
            } else if (s.activeOverlay === 'inventory') {
                setOverlay('none');
                setHeld(null);
                playSound('close');
                document.querySelector('canvas')?.requestPointerLock();
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
                setOverlay('none'); setHeld(null);
                playSound('close');
                document.querySelector('canvas')?.requestPointerLock();
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [setOverlay]);

    if (activeOverlay !== 'inventory') return null;

    const handleSlotClick = (source: 'hotbar' | 'inv', index: number) => {
        playSound('click');
        const arr = source === 'hotbar' ? hotbar : inventory;
        const setArr = source === 'hotbar' ? setHotbar : setInventory;
        const newArr = arr.map(s => ({ ...s }));

        if (held) {
            const old = newArr[index];
            // If same item type, stack
            if (old.id === held.id && old.count < 64) {
                const add = Math.min(held.count, 64 - old.count);
                newArr[index].count += add;
                const remaining = held.count - add;
                setArr(newArr);
                setHeld(remaining > 0 ? { id: held.id, count: remaining } : null);
            } else {
                // Swap
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
    const close = () => {
        setOverlay('none'); setHeld(null); playSound('close');
        document.querySelector('canvas')?.requestPointerLock();
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

export default Inventory;
