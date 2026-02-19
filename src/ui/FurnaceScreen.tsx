/**
 * Furnace Screen — Opens via right-click on Furnace block
 * Smelting with fuel, progress bar, input/fuel/output slots
 * Fully supports inventory drag-and-drop
 */

import React, { useEffect, useState } from 'react';
import useGameStore from '../store/gameStore';
import { BLOCK_DATA } from '../core/blockTypes';
import { getBlockIcon } from '../core/textures';
import type { InventorySlot } from '../store/gameStore';
import { playSound } from '../audio/sounds';

const FurnaceScreen: React.FC = () => {
    const activeOverlay = useGameStore((s) => s.activeOverlay);
    const setOverlay = useGameStore((s) => s.setOverlay);
    const furnace = useGameStore((s) => s.furnace);
    const setFurnace = useGameStore((s) => s.setFurnace);
    const gameMode = useGameStore((s) => s.gameMode);

    const inventory = useGameStore((s) => s.inventory);
    const setInventory = useGameStore((s) => s.setInventory);
    const hotbar = useGameStore((s) => s.hotbar);
    const setHotbar = useGameStore((s) => s.setHotbar);

    const cursorItem = useGameStore((s) => s.cursorItem);
    const setCursorItem = useGameStore((s) => s.setCursorItem);

    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    // Track mouse for cursor item
    useEffect(() => {
        if (activeOverlay !== 'furnace') return;
        const onMouseMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
        window.addEventListener('mousemove', onMouseMove);
        return () => window.removeEventListener('mousemove', onMouseMove);
    }, [activeOverlay]);

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

    const closeFurnace = () => {
        setOverlay('none');
        playSound('close');

        // Return cursor item to inventory
        const s = useGameStore.getState();
        if (s.cursorItem) {
            if (s.gameMode === 'survival') {
                s.addItem(s.cursorItem.id, s.cursorItem.count, s.cursorItem.durability);
            }
            s.setCursorItem(null);
        }
        document.querySelector('canvas')?.requestPointerLock();
    };

    const handleFurnaceSlotClick = (slotType: 'input' | 'fuel' | 'output') => {
        playSound('click');
        const s = useGameStore.getState();
        const f = { ...s.furnace };

        // Define references for readability
        let slotVal = slotType === 'input' ? f.inputSlot : slotType === 'fuel' ? f.fuelSlot : f.outputSlot;

        if (cursorItem) {
            // Cannot place items into output!
            if (slotType === 'output') return;

            if (slotVal.id === 0) {
                // Place cursor fully
                slotVal = { ...cursorItem };
                setCursorItem(null);
            } else if (slotVal.id === cursorItem.id && slotVal.count < 64) {
                // Stack
                const space = 64 - slotVal.count;
                const toAdd = Math.min(space, cursorItem.count);
                slotVal.count += toAdd;
                const remain = cursorItem.count - toAdd;
                if (remain > 0) {
                    setCursorItem({ ...cursorItem, count: remain });
                } else {
                    setCursorItem(null);
                }
            } else {
                // Swap
                const temp = { ...slotVal };
                slotVal = { ...cursorItem };
                setCursorItem(temp);
            }
        } else if (slotVal.id !== 0) {
            // Pick up
            setCursorItem({ ...slotVal });
            slotVal = { id: 0, count: 0 };
        }

        // Apply back
        if (slotType === 'input') f.inputSlot = slotVal;
        else if (slotType === 'fuel') f.fuelSlot = slotVal;
        else f.outputSlot = slotVal;

        s.setFurnace(f);
    };

    const handleInvClick = (type: 'inv' | 'hotbar', index: number) => {
        playSound('click');
        const isInv = type === 'inv';
        const arr = isInv ? [...inventory] : [...hotbar];
        const slot = arr[index];

        if (cursorItem) {
            if (slot.id === 0) {
                // Place fully
                arr[index] = { ...cursorItem };
                setCursorItem(null);
            } else if (slot.id === cursorItem.id && slot.count < 64) {
                const space = 64 - slot.count;
                const toAdd = Math.min(space, cursorItem.count);
                arr[index] = { ...slot, count: slot.count + toAdd };
                const remain = cursorItem.count - toAdd;
                if (remain > 0) setCursorItem({ ...cursorItem, count: remain });
                else setCursorItem(null);
            } else {
                const temp = { ...slot };
                arr[index] = { ...cursorItem };
                setCursorItem(temp);
            }
        } else if (slot.id !== 0) {
            setCursorItem({ ...slot });
            arr[index] = { id: 0, count: 0 };
        }

        if (isInv) setInventory(arr);
        else setHotbar(arr);
    };

    const renderSlot = (slot: InventorySlot, onClick: () => void, isOutput = false) => {
        const data = BLOCK_DATA[slot.id];
        const icon = slot.id ? getBlockIcon(slot.id) : null;
        return (
            <div className={`inv-slot furnace-slot${isOutput ? ' output' : ''}${slot.id ? ' filled' : ''}`}
                onClick={onClick}
                title={data ? data.name : 'Puste'}>
                {slot.id > 0 && icon && (
                    <>
                        <img src={icon} className="block-icon-3d" alt="" draggable={false} />
                        {slot.count > 1 && <span className="item-count">{slot.count}</span>}
                        {slot.durability !== undefined && data?.maxDurability && (
                            <div className="durability-bar" style={{
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

    if (activeOverlay !== 'furnace') return null;

    const burnPct = furnace.burnTimeTotal > 0 ? (furnace.burnTimeRemaining / furnace.burnTimeTotal) * 100 : 0;
    const cookPct = furnace.cookTimeTotal > 0 ? (furnace.cookProgress / furnace.cookTimeTotal) * 100 : 0;

    return (
        <div className="crafting-overlay" onClick={closeFurnace} style={{ cursor: cursorItem ? 'none' : 'default' }}>
            <div className="crafting-window furnace-window" onClick={(e) => e.stopPropagation()} style={{ cursor: cursorItem ? 'none' : 'default' }}>
                <h3 style={{ marginBottom: 12 }}>🔥 Piec</h3>

                {/* Furnace Top Section */}
                <div className="furnace-layout" style={{ marginBottom: 20 }}>
                    <div className="furnace-column">
                        <div className="inv-section-label">Surowiec</div>
                        {renderSlot(furnace.inputSlot, () => handleFurnaceSlotClick('input'))}
                        <div className="inv-section-label" style={{ marginTop: 8 }}>Opał</div>
                        {renderSlot(furnace.fuelSlot, () => handleFurnaceSlotClick('fuel'))}
                    </div>

                    <div className="furnace-progress">
                        <div className="furnace-fire" style={{ opacity: burnPct > 0 ? 1 : 0.2 }}>🔥</div>
                        <div className="furnace-bar-container">
                            <div className="furnace-bar" style={{ width: `${cookPct}%` }} />
                        </div>
                        <div className="craft-arrow">→</div>
                    </div>

                    <div className="furnace-column" style={{ alignSelf: 'center' }}>
                        <div className="inv-section-label">Wynik</div>
                        {renderSlot(furnace.outputSlot, () => handleFurnaceSlotClick('output'), true)}
                    </div>
                </div>

                {/* Inventory Bottom Section */}
                <div className="inv-section-label">Plecak</div>
                <div className="inv-grid">
                    {inventory.map((slot, i) => (
                        <React.Fragment key={i}>{renderSlot(slot, () => handleInvClick('inv', i))}</React.Fragment>
                    ))}
                </div>

                <div className="inv-section-label" style={{ marginTop: 12 }}>Pasek szybkiego dostępu</div>
                <div className="inv-hotbar">
                    {hotbar.map((slot, i) => (
                        <React.Fragment key={i}>{renderSlot(slot, () => handleInvClick('hotbar', i))}</React.Fragment>
                    ))}
                </div>

            </div>

            {/* Floating Cursor Item */}
            {cursorItem && cursorItem.id > 0 && (
                <div style={{
                    position: 'fixed',
                    left: mousePos.x,
                    top: mousePos.y,
                    pointerEvents: 'none',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 9999,
                    width: '36px', height: '36px'
                }}>
                    <img src={getBlockIcon(cursorItem.id)!} className="block-icon-3d" alt="" style={{ width: '100%', height: '100%' }} />
                    {cursorItem.count > 1 && <span className="item-count">{cursorItem.count}</span>}
                    {cursorItem.durability !== undefined && BLOCK_DATA[cursorItem.id]?.maxDurability && (
                        <div className="durability-bar" style={{
                            position: 'absolute', bottom: '-4px', left: '0px', right: '0px',
                            height: '4px', backgroundColor: '#000', borderRadius: '1px'
                        }}>
                            <div style={{
                                width: `${(cursorItem.durability / BLOCK_DATA[cursorItem.id]!.maxDurability!) * 100}%`,
                                height: '100%',
                                backgroundColor: `hsl(${((cursorItem.durability / BLOCK_DATA[cursorItem.id]!.maxDurability!) * 120).toString(10)}, 100%, 50%)`,
                            }} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default FurnaceScreen;
