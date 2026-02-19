/**
 * Crafting Screen (3×3 crafting table) — Opens via right-click on Crafting Table block
 * Also accessible via C key as before
 */

import React, { useEffect, useState, useMemo } from 'react';
import useGameStore from '../store/gameStore';
import { BLOCK_DATA, PLACEABLE_BLOCKS, ITEM_BLOCKS } from '../core/blockTypes';
import { getBlockIcon } from '../core/textures';
import { RECIPES, matchRecipe } from '../core/crafting';
import { playSound } from '../audio/sounds';

const CraftingScreen: React.FC = () => {
    const activeOverlay = useGameStore((s) => s.activeOverlay);
    const setOverlay = useGameStore((s) => s.setOverlay);
    const craftingGrid = useGameStore((s) => s.craftingGrid);
    const setCraftingGrid = useGameStore((s) => s.setCraftingGrid);
    const screen = useGameStore((s) => s.screen);
    const gameMode = useGameStore((s) => s.gameMode);

    const [activeTab, setActiveTab] = useState<'grid' | 'recipes'>('grid');

    // C key closes crafting (if open) — opening is only via right-click on Crafting Table
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

    // ESC to close (capture phase!)
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
            for (const id of craftingGrid) {
                if (id) s.addItem(id, 1);
            }
        }
        setCraftingGrid(Array(9).fill(0));
        setOverlay('none');
        playSound('close');
        document.querySelector('canvas')?.requestPointerLock();
    };

    const result = useMemo(() => matchRecipe(craftingGrid, 3), [craftingGrid]);

    const setSlot = (index: number, blockId: number) => {
        const newGrid = [...craftingGrid];

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
        setCraftingGrid(newGrid);
        playSound('click');
    };

    const clearGrid = () => {
        if (gameMode === 'survival') {
            for (const id of craftingGrid) {
                if (id) useGameStore.getState().addItem(id, 1);
            }
        }
        setCraftingGrid(Array(9).fill(0));
    };

    const craftItem = () => {
        if (!result) return;
        playSound('craft');
        setCraftingGrid(Array(9).fill(0));
        useGameStore.getState().addItem(result.result, result.count);
        playSound('xp');
    };

    const loadRecipe = (recipeIndex: number) => {
        const recipe = RECIPES[recipeIndex];
        if (!recipe || recipe.type !== 'shaped') return;
        const pattern = recipe.ingredients as number[][];

        if (gameMode === 'survival') {
            for (const id of craftingGrid) {
                if (id) useGameStore.getState().addItem(id, 1);
            }
        }

        // Flatten pattern into 3x3 grid
        const flat = Array(9).fill(0);
        for (let r = 0; r < pattern.length && r < 3; r++) {
            for (let c = 0; c < (pattern[r]?.length ?? 0) && c < 3; c++) {
                flat[r * 3 + c] = pattern[r][c] ?? 0;
            }
        }

        if (gameMode === 'survival') {
            // Check availability
            const needed: Record<number, number> = {};
            for (const id of flat) { if (id) needed[id] = (needed[id] || 0) + 1; }
            const s = useGameStore.getState();
            const available: Record<number, number> = {};
            for (const sl of [...s.hotbar, ...s.inventory]) {
                if (sl.id) available[sl.id] = (available[sl.id] || 0) + sl.count;
            }
            for (const [id, n] of Object.entries(needed)) {
                if ((available[+id] || 0) < n) { playSound('click'); return; }
            }
            // Consume items
            const newHotbar = s.hotbar.map(sl => ({ ...sl }));
            const newInv = s.inventory.map(sl => ({ ...sl }));
            for (const [id, n] of Object.entries(needed)) {
                let rem = n;
                for (let i = 0; i < 9 && rem > 0; i++) {
                    if (newHotbar[i].id === +id) {
                        const take = Math.min(rem, newHotbar[i].count);
                        newHotbar[i].count -= take;
                        if (newHotbar[i].count <= 0) newHotbar[i] = { id: 0, count: 0 };
                        rem -= take;
                    }
                }
                for (let i = 0; i < 27 && rem > 0; i++) {
                    if (newInv[i].id === +id) {
                        const take = Math.min(rem, newInv[i].count);
                        newInv[i].count -= take;
                        if (newInv[i].count <= 0) newInv[i] = { id: 0, count: 0 };
                        rem -= take;
                    }
                }
            }
            s.setHotbar(newHotbar);
            s.setInventory(newInv);
        }
        setCraftingGrid(flat);
        playSound('click');
    };

    if (activeOverlay !== 'crafting') return null;

    const availableItems = gameMode === 'creative'
        ? [...PLACEABLE_BLOCKS, ...ITEM_BLOCKS]
        : getPlayerItems();

    return (
        <div className="crafting-overlay" onClick={closeCrafting}>
            <div className="crafting-window" onClick={(e) => e.stopPropagation()}>
                <h3>⚒ Stół Rzemieślniczy (3×3)</h3>

                <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', justifyContent: 'center' }}>
                    <button className={`mc-btn half${activeTab === 'grid' ? ' primary' : ''}`} onClick={() => setActiveTab('grid')}>Siatka</button>
                    <button className={`mc-btn half${activeTab === 'recipes' ? ' primary' : ''}`} onClick={() => setActiveTab('recipes')}>Przepisy</button>
                </div>

                {activeTab === 'grid' && (
                    <>
                        <div className="crafting-layout">
                            <div className="crafting-grid">
                                {craftingGrid.map((id, i) => {
                                    const icon = id ? getBlockIcon(id) : null;
                                    return (
                                        <div key={i} className={`craft-slot${id ? ' filled' : ''}`} onClick={() => setSlot(i, 0)} title={id ? BLOCK_DATA[id]?.name : ''}>
                                            {id > 0 && icon && <img src={icon} className="block-icon-3d" alt="" draggable={false} />}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="craft-arrow">→</div>

                            <div className={`craft-result${result ? ' has-result' : ''}`} onClick={result ? craftItem : undefined}>
                                {result ? (
                                    <>
                                        <img src={getBlockIcon(result.result)} className="block-icon-3d large" alt="" draggable={false} />
                                        {result.count > 1 && <span className="result-count">×{result.count}</span>}
                                        <span className="result-name">{result.name}</span>
                                    </>
                                ) : (
                                    <span className="no-result">?</span>
                                )}
                            </div>
                        </div>

                        <div className="craft-palette-label">
                            {gameMode === 'survival' ? 'Twoje przedmioty' : 'Wszystkie bloki'}
                        </div>
                        <div className="craft-palette">
                            {availableItems.map((id) => {
                                const data = BLOCK_DATA[id];
                                if (!data) return null;
                                const icon = getBlockIcon(id);
                                return (
                                    <div key={id} className="palette-slot" onClick={() => {
                                        const emptyIdx = craftingGrid.findIndex(v => v === 0);
                                        if (emptyIdx >= 0) setSlot(emptyIdx, id);
                                    }} title={data.name}>
                                        {icon && <img src={icon} className="block-icon-3d small" alt="" draggable={false} />}
                                    </div>
                                );
                            })}
                        </div>

                        <button className="mc-btn" onClick={clearGrid} style={{ marginTop: 8 }}>Wyczyść siatkę</button>
                    </>
                )}

                {activeTab === 'recipes' && (
                    <div className="recipe-list" style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxHeight: '300px' }}>
                        {RECIPES.map((recipe, ri) => {
                            const data = BLOCK_DATA[recipe.result];
                            if (!data) return null;
                            const icon = getBlockIcon(recipe.result);
                            return (
                                <div key={ri} className="recipe-item" onClick={() => { loadRecipe(ri); setActiveTab('grid'); }}>
                                    {icon && <img src={icon} className="block-icon-3d small" alt="" draggable={false} />}
                                    <span>{recipe.name} {recipe.count > 1 ? `×${recipe.count}` : ''}</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="inv-hint" style={{ marginTop: 8 }}>ESC — zamknij • Kliknij slot aby usunąć • Kliknij wynik aby skraftować</div>
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

export default CraftingScreen;
