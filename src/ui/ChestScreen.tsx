import React, { useEffect, useState } from 'react';
import useGameStore from '../store/gameStore';
import { playSound } from '../audio/sounds';
import { getBlockIcon } from '../core/textures';
import { BLOCK_DATA } from '../core/blockTypes';
import type { InventorySlot } from '../store/gameStore';

const ChestScreen: React.FC = () => {
    const activeOverlay = useGameStore((s) => s.activeOverlay);
    const setOverlay = useGameStore((s) => s.setOverlay);
    const screen = useGameStore((s) => s.screen);
    const chests = useGameStore((s) => s.chests);
    const setChest = useGameStore((s) => s.setChest);
    const toggleChestOpen = useGameStore((s) => s.toggleChestOpen);

    const hotbar = useGameStore((s) => s.hotbar);
    const setHotbar = useGameStore((s) => s.setHotbar);
    const inventory = useGameStore((s) => s.inventory);
    const setInventory = useGameStore((s) => s.setInventory);

    const cursorItem = useGameStore((s) => s.cursorItem);
    const setCursorItem = useGameStore((s) => s.setCursorItem);

    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const activeChestKey = Object.keys(chests).find(k => chests[k].isOpen);
    const chestData = activeChestKey ? chests[activeChestKey] : null;

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            setMousePos({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener('mousemove', onMouseMove);
        return () => window.removeEventListener('mousemove', onMouseMove);
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.code === 'Escape' || e.code === 'KeyE') {
                if (useGameStore.getState().activeOverlay === 'chest') {
                    e.preventDefault(); e.stopPropagation();
                    closeChest();
                }
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, []);

    const closeChest = () => {
        if (activeChestKey) {
            toggleChestOpen(activeChestKey, false);
        }
        setOverlay('none');
        playSound('close');
        document.querySelector('canvas')?.requestPointerLock();
    };

    const handleSlotClick = (source: 'chest' | 'inv' | 'hotbar', index: number) => {
        if (!chestData || !activeChestKey) return;

        playSound('click');
        const isChest = source === 'chest';
        const isHotbar = source === 'hotbar';
        const arr = isChest ? chestData.slots : (isHotbar ? hotbar : inventory);
        const setArr = isChest
            ? (newSlots: InventorySlot[]) => setChest(activeChestKey, { ...chestData, slots: newSlots })
            : (isHotbar ? setHotbar : setInventory);

        const newArr = arr.map(s => ({ ...s }));

        if (cursorItem) {
            const old = newArr[index];
            if (old.id === cursorItem.id && old.count < 64) {
                const add = Math.min(cursorItem.count, 64 - old.count);
                newArr[index].count += add;
                const remaining = cursorItem.count - add;
                setArr(newArr);
                setCursorItem(remaining > 0 ? { id: cursorItem.id, count: remaining, durability: cursorItem.durability } : null);
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

    const renderSlot = (slot: InventorySlot, onClick: () => void) => {
        const data = slot.id ? BLOCK_DATA[slot.id] : null;
        const icon = slot.id ? getBlockIcon(slot.id) : null;
        const durPct = (slot.durability !== undefined && data?.maxDurability)
            ? slot.durability / data.maxDurability
            : null;
        const durColor = durPct !== null
            ? `hsl(${Math.round(durPct * 120)}, 100%, 45%)`
            : 'transparent';

        return (
            <div className={`inv-slot${slot.id ? ' filled' : ''}`} onClick={onClick} title={data?.name ?? ''}>
                {slot.id > 0 && icon && (
                    <>
                        <img src={icon} className="block-icon-3d" alt={data?.name ?? ''} draggable={false} />
                        {slot.count > 1 && <span className="item-count">{slot.count}</span>}
                        {durPct !== null && durPct < 1 && (
                            <div className="durability-bar-bg" style={{ position: 'absolute', bottom: '2px', left: '4px', right: '4px', height: '3px', background: '#000' }}>
                                <div style={{ height: '100%', width: `${durPct * 100}%`, backgroundColor: durColor }} />
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };

    if (activeOverlay !== 'chest' || !chestData) return null;

    return (
        <div className="inventory-overlay" onClick={closeChest}>
            <div className="inventory-window chest-window" onClick={(e) => e.stopPropagation()} style={{ background: '#c6c6c6', border: '2px solid #555' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <h3 style={{ color: '#373737', margin: 0, fontSize: '12px' }}>Skrzynia (Duża Skrzynia)</h3>
                </div>

                <div className="inv-grid chest-grid" style={{ marginBottom: '14px', gridTemplateColumns: 'repeat(9, 36px)', justifyContent: 'center', gap: '2px' }}>
                    {chestData.slots.map((slot, i) => (
                        <React.Fragment key={`chest-${i}`}>{renderSlot(slot, () => handleSlotClick('chest', i))}</React.Fragment>
                    ))}
                </div>

                <div className="inv-section-label" style={{ color: '#373737', marginBottom: '2px', textAlign: 'left', marginLeft: '32px' }}>Ekwipunek gracza</div>

                <div className="inv-grid" style={{ marginBottom: '8px', gridTemplateColumns: 'repeat(9, 36px)', justifyContent: 'center', gap: '2px' }}>
                    {inventory.map((slot, i) => (
                        <React.Fragment key={`inv-${i}`}>{renderSlot(slot, () => handleSlotClick('inv', i))}</React.Fragment>
                    ))}
                </div>

                <div className="inv-hotbar" style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 36px)', justifyContent: 'center', gap: '2px', background: 'transparent', padding: 0 }}>
                    {hotbar.map((slot, i) => (
                        <React.Fragment key={`hotbar-${i}`}>{renderSlot(slot, () => handleSlotClick('hotbar', i))}</React.Fragment>
                    ))}
                </div>
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
                    width: '36px',
                    height: '36px',
                }}>
                    <img
                        src={getBlockIcon(cursorItem.id)}
                        className="block-icon-3d"
                        alt=""
                        style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.5))' }}
                    />
                    {cursorItem.count > 1 && (
                        <span className="item-count" style={{ position: 'absolute', right: '-4px', bottom: '-4px', textShadow: '1px 1px 0 #000' }}>
                            {cursorItem.count}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default ChestScreen;
