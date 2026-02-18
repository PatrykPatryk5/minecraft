/**
 * Crafting & Smelting Recipes Registry
 *
 * Supports:
 * - Shaped recipes: pattern must match (position-flexible, can shift)
 * - Shapeless recipes: ingredients can be anywhere
 * - Smelting recipes: for furnace
 * - Works with both 2x2 (inventory) and 3x3 (crafting table) grids
 */

import { BlockType } from './blockTypes';

export type RecipeType = 'shaped' | 'shapeless';

export interface CraftingRecipe {
    type: RecipeType;
    /** For shaped: 2D array (rows of columns). For shapeless: flat array of required IDs */
    ingredients: number[][] | number[];
    result: number;
    count: number;
    name: string;
}

export interface SmeltingRecipe {
    input: number;
    output: number;
    count: number;
    name: string;
    /** Duration in ticks (20 tps, so 200 = 10 seconds) */
    duration: number;
}

// Shorthand aliases
const B = BlockType;

// ══════════════════════════════════════════════════════════
// CRAFTING RECIPES
// ══════════════════════════════════════════════════════════
export const RECIPES: CraftingRecipe[] = [
    // ─── Basic Items ────────────────────────────────────
    { type: 'shapeless', name: 'Dębowe Deski', result: B.PLANKS, count: 4, ingredients: [B.OAK_LOG] },
    { type: 'shapeless', name: 'Świerkowe Deski', result: B.SPRUCE_PLANKS, count: 4, ingredients: [B.SPRUCE] },
    { type: 'shapeless', name: 'Brzozowe Deski', result: B.BIRCH_PLANKS, count: 4, ingredients: [B.BIRCH_LOG] },
    {
        type: 'shaped', name: 'Patyki', result: B.STICK, count: 4,
        ingredients: [[B.PLANKS], [B.PLANKS]]
    },
    {
        type: 'shaped', name: 'Pochodnia', result: B.TORCH, count: 4,
        ingredients: [[B.COAL], [B.STICK]]
    },
    {
        type: 'shaped', name: 'Drabina', result: B.LADDER, count: 3,
        ingredients: [[B.STICK, 0, B.STICK], [B.STICK, B.STICK, B.STICK], [B.STICK, 0, B.STICK]]
    },

    // ─── Crafting / Utility ─────────────────────────────
    {
        type: 'shaped', name: 'Stół Rzemieślniczy', result: B.CRAFTING, count: 1,
        ingredients: [[B.PLANKS, B.PLANKS], [B.PLANKS, B.PLANKS]]
    },
    {
        type: 'shaped', name: 'Piec', result: B.FURNACE, count: 1,
        ingredients: [[B.COBBLE, B.COBBLE, B.COBBLE], [B.COBBLE, 0, B.COBBLE], [B.COBBLE, B.COBBLE, B.COBBLE]]
    },
    {
        type: 'shaped', name: 'Skrzynia', result: B.CHEST, count: 1,
        ingredients: [[B.PLANKS, B.PLANKS, B.PLANKS], [B.PLANKS, 0, B.PLANKS], [B.PLANKS, B.PLANKS, B.PLANKS]]
    },
    {
        type: 'shaped', name: 'Klapa', result: B.TRAPDOOR, count: 2,
        ingredients: [[B.PLANKS, B.PLANKS, B.PLANKS], [B.PLANKS, B.PLANKS, B.PLANKS]]
    },

    // ─── Wooden Tools ───────────────────────────────────
    {
        type: 'shaped', name: 'Drewniany Kilof', result: B.WOODEN_PICKAXE, count: 1,
        ingredients: [[B.PLANKS, B.PLANKS, B.PLANKS], [0, B.STICK, 0], [0, B.STICK, 0]]
    },
    {
        type: 'shaped', name: 'Drewniana Siekiera', result: B.WOODEN_AXE, count: 1,
        ingredients: [[B.PLANKS, B.PLANKS], [B.PLANKS, B.STICK], [0, B.STICK]]
    },
    {
        type: 'shaped', name: 'Drewniana Łopata', result: B.WOODEN_SHOVEL, count: 1,
        ingredients: [[B.PLANKS], [B.STICK], [B.STICK]]
    },
    {
        type: 'shaped', name: 'Drewniany Miecz', result: B.WOODEN_SWORD, count: 1,
        ingredients: [[B.PLANKS], [B.PLANKS], [B.STICK]]
    },
    {
        type: 'shaped', name: 'Drewniana Motyka', result: B.WOODEN_HOE, count: 1,
        ingredients: [[B.PLANKS, B.PLANKS], [0, B.STICK], [0, B.STICK]]
    },

    // ─── Stone Tools ────────────────────────────────────
    {
        type: 'shaped', name: 'Kamienny Kilof', result: B.STONE_PICKAXE, count: 1,
        ingredients: [[B.COBBLE, B.COBBLE, B.COBBLE], [0, B.STICK, 0], [0, B.STICK, 0]]
    },
    {
        type: 'shaped', name: 'Kamienna Siekiera', result: B.STONE_AXE, count: 1,
        ingredients: [[B.COBBLE, B.COBBLE], [B.COBBLE, B.STICK], [0, B.STICK]]
    },
    {
        type: 'shaped', name: 'Kamienna Łopata', result: B.STONE_SHOVEL, count: 1,
        ingredients: [[B.COBBLE], [B.STICK], [B.STICK]]
    },
    {
        type: 'shaped', name: 'Kamienny Miecz', result: B.STONE_SWORD, count: 1,
        ingredients: [[B.COBBLE], [B.COBBLE], [B.STICK]]
    },
    {
        type: 'shaped', name: 'Kamienna Motyka', result: B.STONE_HOE, count: 1,
        ingredients: [[B.COBBLE, B.COBBLE], [0, B.STICK], [0, B.STICK]]
    },

    // ─── Iron Tools ─────────────────────────────────────
    {
        type: 'shaped', name: 'Żelazny Kilof', result: B.IRON_PICKAXE, count: 1,
        ingredients: [[B.IRON_INGOT, B.IRON_INGOT, B.IRON_INGOT], [0, B.STICK, 0], [0, B.STICK, 0]]
    },
    {
        type: 'shaped', name: 'Żelazna Siekiera', result: B.IRON_AXE, count: 1,
        ingredients: [[B.IRON_INGOT, B.IRON_INGOT], [B.IRON_INGOT, B.STICK], [0, B.STICK]]
    },
    {
        type: 'shaped', name: 'Żelazna Łopata', result: B.IRON_SHOVEL, count: 1,
        ingredients: [[B.IRON_INGOT], [B.STICK], [B.STICK]]
    },
    {
        type: 'shaped', name: 'Żelazny Miecz', result: B.IRON_SWORD, count: 1,
        ingredients: [[B.IRON_INGOT], [B.IRON_INGOT], [B.STICK]]
    },
    {
        type: 'shaped', name: 'Żelazna Motyka', result: B.IRON_HOE, count: 1,
        ingredients: [[B.IRON_INGOT, B.IRON_INGOT], [0, B.STICK], [0, B.STICK]]
    },

    // ─── Gold Tools ─────────────────────────────────────
    {
        type: 'shaped', name: 'Złoty Kilof', result: B.GOLD_PICKAXE, count: 1,
        ingredients: [[B.GOLD_INGOT, B.GOLD_INGOT, B.GOLD_INGOT], [0, B.STICK, 0], [0, B.STICK, 0]]
    },
    {
        type: 'shaped', name: 'Złota Siekiera', result: B.GOLD_AXE, count: 1,
        ingredients: [[B.GOLD_INGOT, B.GOLD_INGOT], [B.GOLD_INGOT, B.STICK], [0, B.STICK]]
    },
    {
        type: 'shaped', name: 'Złota Łopata', result: B.GOLD_SHOVEL, count: 1,
        ingredients: [[B.GOLD_INGOT], [B.STICK], [B.STICK]]
    },
    {
        type: 'shaped', name: 'Złoty Miecz', result: B.GOLD_SWORD, count: 1,
        ingredients: [[B.GOLD_INGOT], [B.GOLD_INGOT], [B.STICK]]
    },
    {
        type: 'shaped', name: 'Złota Motyka', result: B.GOLD_HOE, count: 1,
        ingredients: [[B.GOLD_INGOT, B.GOLD_INGOT], [0, B.STICK], [0, B.STICK]]
    },

    // ─── Diamond Tools ──────────────────────────────────
    {
        type: 'shaped', name: 'Diamentowy Kilof', result: B.DIAMOND_PICKAXE, count: 1,
        ingredients: [[B.DIAMOND_GEM, B.DIAMOND_GEM, B.DIAMOND_GEM], [0, B.STICK, 0], [0, B.STICK, 0]]
    },
    {
        type: 'shaped', name: 'Diamentowa Siekiera', result: B.DIAMOND_AXE, count: 1,
        ingredients: [[B.DIAMOND_GEM, B.DIAMOND_GEM], [B.DIAMOND_GEM, B.STICK], [0, B.STICK]]
    },
    {
        type: 'shaped', name: 'Diamentowa Łopata', result: B.DIAMOND_SHOVEL, count: 1,
        ingredients: [[B.DIAMOND_GEM], [B.STICK], [B.STICK]]
    },
    {
        type: 'shaped', name: 'Diamentowy Miecz', result: B.DIAMOND_SWORD, count: 1,
        ingredients: [[B.DIAMOND_GEM], [B.DIAMOND_GEM], [B.STICK]]
    },
    {
        type: 'shaped', name: 'Diamentowa Motyka', result: B.DIAMOND_HOE, count: 1,
        ingredients: [[B.DIAMOND_GEM, B.DIAMOND_GEM], [0, B.STICK], [0, B.STICK]]
    },

    // ─── Utility Items ──────────────────────────────────
    {
        type: 'shaped', name: 'Wiadro', result: B.BUCKET, count: 1,
        ingredients: [[B.IRON_INGOT, 0, B.IRON_INGOT], [0, B.IRON_INGOT, 0]]
    },
    {
        type: 'shapeless', name: 'Krzesiwo', result: B.FLINT_AND_STEEL, count: 1,
        ingredients: [B.IRON_INGOT, B.FLINT]
    },
    {
        type: 'shaped', name: 'Nożyce', result: B.SHEARS, count: 1,
        ingredients: [[0, B.IRON_INGOT], [B.IRON_INGOT, 0]]
    },
    {
        type: 'shaped', name: 'Kompas', result: B.COMPASS, count: 1,
        ingredients: [[0, B.IRON_INGOT, 0], [B.IRON_INGOT, B.REDSTONE, B.IRON_INGOT], [0, B.IRON_INGOT, 0]]
    },
    {
        type: 'shaped', name: 'Zegar', result: B.CLOCK, count: 1,
        ingredients: [[0, B.GOLD_INGOT, 0], [B.GOLD_INGOT, B.REDSTONE, B.GOLD_INGOT], [0, B.GOLD_INGOT, 0]]
    },
    {
        type: 'shaped', name: 'Łuk', result: B.BOW, count: 1,
        ingredients: [[0, B.STICK, B.STRING], [B.STICK, 0, B.STRING], [0, B.STICK, B.STRING]]
    },
    {
        type: 'shaped', name: 'Strzała', result: B.ARROW, count: 4,
        ingredients: [[B.FLINT], [B.STICK], [B.FEATHER]]
    },

    // ─── Building Blocks ────────────────────────────────
    {
        type: 'shaped', name: 'Piaskowiec', result: B.SANDSTONE, count: 1,
        ingredients: [[B.SAND, B.SAND], [B.SAND, B.SAND]]
    },
    {
        type: 'shaped', name: 'Kamienne Cegły', result: B.STONE_BRICKS, count: 4,
        ingredients: [[B.STONE, B.STONE], [B.STONE, B.STONE]]
    },
    {
        type: 'shaped', name: 'Cegły', result: B.BRICK, count: 1,
        ingredients: [[B.BRICK_ITEM, B.BRICK_ITEM], [B.BRICK_ITEM, B.BRICK_ITEM]]
    },
    {
        type: 'shaped', name: 'TNT', result: B.TNT, count: 1,
        ingredients: [[B.GUNPOWDER, B.SAND, B.GUNPOWDER], [B.SAND, B.GUNPOWDER, B.SAND], [B.GUNPOWDER, B.SAND, B.GUNPOWDER]]
    },
    {
        type: 'shaped', name: 'Płyta Brukowa', result: B.COBBLE_SLAB, count: 6,
        ingredients: [[B.COBBLE, B.COBBLE, B.COBBLE]]
    },

    // ─── Metal Blocks ───────────────────────────────────
    {
        type: 'shaped', name: 'Blok Żelaza', result: B.IRON_BLOCK, count: 1,
        ingredients: [[B.IRON_INGOT, B.IRON_INGOT, B.IRON_INGOT], [B.IRON_INGOT, B.IRON_INGOT, B.IRON_INGOT], [B.IRON_INGOT, B.IRON_INGOT, B.IRON_INGOT]]
    },
    { type: 'shapeless', name: 'Sztabki Żelaza', result: B.IRON_INGOT, count: 9, ingredients: [B.IRON_BLOCK] },
    {
        type: 'shaped', name: 'Blok Złota', result: B.GOLD_BLOCK, count: 1,
        ingredients: [[B.GOLD_INGOT, B.GOLD_INGOT, B.GOLD_INGOT], [B.GOLD_INGOT, B.GOLD_INGOT, B.GOLD_INGOT], [B.GOLD_INGOT, B.GOLD_INGOT, B.GOLD_INGOT]]
    },
    { type: 'shapeless', name: 'Sztabki Złota', result: B.GOLD_INGOT, count: 9, ingredients: [B.GOLD_BLOCK] },
    {
        type: 'shaped', name: 'Blok Diamentu', result: B.DIAMOND_BLOCK, count: 1,
        ingredients: [[B.DIAMOND_GEM, B.DIAMOND_GEM, B.DIAMOND_GEM], [B.DIAMOND_GEM, B.DIAMOND_GEM, B.DIAMOND_GEM], [B.DIAMOND_GEM, B.DIAMOND_GEM, B.DIAMOND_GEM]]
    },
    { type: 'shapeless', name: 'Diamenty', result: B.DIAMOND_GEM, count: 9, ingredients: [B.DIAMOND_BLOCK] },
    {
        type: 'shaped', name: 'Blok Szmaragdu', result: B.EMERALD_BLOCK, count: 1,
        ingredients: [[B.EMERALD, B.EMERALD, B.EMERALD], [B.EMERALD, B.EMERALD, B.EMERALD], [B.EMERALD, B.EMERALD, B.EMERALD]]
    },
    { type: 'shapeless', name: 'Szmaragdy', result: B.EMERALD, count: 9, ingredients: [B.EMERALD_BLOCK] },
    {
        type: 'shaped', name: 'Blok Lapis', result: B.LAPIS_BLOCK, count: 1,
        ingredients: [[B.LAPIS, B.LAPIS, B.LAPIS], [B.LAPIS, B.LAPIS, B.LAPIS], [B.LAPIS, B.LAPIS, B.LAPIS]]
    },
    { type: 'shapeless', name: 'Lapis Lazuli', result: B.LAPIS, count: 9, ingredients: [B.LAPIS_BLOCK] },

    // ─── Decoration ─────────────────────────────────────
    {
        type: 'shaped', name: 'Biblioteczka', result: B.BOOKSHELF, count: 1,
        ingredients: [[B.PLANKS, B.PLANKS, B.PLANKS], [B.BOOK, B.BOOK, B.BOOK], [B.PLANKS, B.PLANKS, B.PLANKS]]
    },
    {
        type: 'shaped', name: 'Bela Siana', result: B.HAY_BALE, count: 1,
        ingredients: [[B.WHEAT, B.WHEAT, B.WHEAT], [B.WHEAT, B.WHEAT, B.WHEAT], [B.WHEAT, B.WHEAT, B.WHEAT]]
    },
    { type: 'shapeless', name: 'Pszenica', result: B.WHEAT, count: 9, ingredients: [B.HAY_BALE] },
    {
        type: 'shaped', name: 'Jasnokamień', result: B.GLOWSTONE, count: 1,
        ingredients: [[B.GLOWSTONE_DUST, B.GLOWSTONE_DUST], [B.GLOWSTONE_DUST, B.GLOWSTONE_DUST]]
    },

    // ─── Wool (dye + wool) ──────────────────────────────
    {
        type: 'shaped', name: 'Biała Wełna', result: B.WOOL_WHITE, count: 1,
        ingredients: [[B.STRING, B.STRING], [B.STRING, B.STRING]]
    },
    { type: 'shapeless', name: 'Czerwona Wełna', result: B.WOOL_RED, count: 1, ingredients: [B.WOOL_WHITE, B.DYE_RED] },
    { type: 'shapeless', name: 'Niebieska Wełna', result: B.WOOL_BLUE, count: 1, ingredients: [B.WOOL_WHITE, B.DYE_BLUE] },
    { type: 'shapeless', name: 'Zielona Wełna', result: B.WOOL_GREEN, count: 1, ingredients: [B.WOOL_WHITE, B.DYE_GREEN] },
    { type: 'shapeless', name: 'Żółta Wełna', result: B.WOOL_YELLOW, count: 1, ingredients: [B.WOOL_WHITE, B.DYE_YELLOW] },
    { type: 'shapeless', name: 'Czarna Wełna', result: B.WOOL_BLACK, count: 1, ingredients: [B.WOOL_WHITE, B.DYE_BLACK] },

    // ─── Crafting Materials ─────────────────────────────
    {
        type: 'shaped', name: 'Papier', result: B.PAPER, count: 3,
        ingredients: [[B.SUGAR, B.SUGAR, B.SUGAR]]
    },
    {
        type: 'shapeless', name: 'Książka', result: B.BOOK, count: 1,
        ingredients: [B.PAPER, B.PAPER, B.PAPER, B.LEATHER]
    },
    {
        type: 'shapeless', name: 'Mączka Kostna', result: B.BONE_MEAL, count: 3,
        ingredients: [B.BONE]
    },

    // ─── Food ────────────────────────────────────────────
    {
        type: 'shaped', name: 'Chleb', result: B.BREAD, count: 1,
        ingredients: [[B.WHEAT, B.WHEAT, B.WHEAT]]
    },
    {
        type: 'shaped', name: 'Złote Jabłko', result: B.GOLDEN_APPLE, count: 1,
        ingredients: [[B.GOLD_INGOT, B.GOLD_INGOT, B.GOLD_INGOT], [B.GOLD_INGOT, B.APPLE, B.GOLD_INGOT], [B.GOLD_INGOT, B.GOLD_INGOT, B.GOLD_INGOT]]
    },
    {
        type: 'shapeless', name: 'Ciasteczko', result: B.COOKIE, count: 8,
        ingredients: [B.WHEAT, B.WHEAT]
    },
];

// ══════════════════════════════════════════════════════════
// SMELTING RECIPES (for Furnace)
// ══════════════════════════════════════════════════════════
export const SMELTING_RECIPES: SmeltingRecipe[] = [
    { input: B.IRON_ORE, output: B.IRON_INGOT, count: 1, name: 'Sztabka Żelaza', duration: 200 },
    { input: B.GOLD_ORE, output: B.GOLD_INGOT, count: 1, name: 'Sztabka Złota', duration: 200 },
    { input: B.SAND, output: B.GLASS, count: 1, name: 'Szkło', duration: 200 },
    { input: B.COBBLE, output: B.STONE, count: 1, name: 'Kamień', duration: 200 },
    { input: B.OAK_LOG, output: B.COAL, count: 1, name: 'Węgiel Drzewny', duration: 200 },
    { input: B.CLAY_BALL, output: B.BRICK_ITEM, count: 1, name: 'Cegła', duration: 200 },
    { input: B.PORKCHOP_RAW, output: B.PORKCHOP_COOKED, count: 1, name: 'Pieczona Wieprzowina', duration: 200 },
    { input: B.BEEF_RAW, output: B.STEAK, count: 1, name: 'Stek', duration: 200 },
    { input: B.CHICKEN_RAW, output: B.CHICKEN_COOKED, count: 1, name: 'Pieczony Kurczak', duration: 200 },
    { input: B.POTATO, output: B.BAKED_POTATO, count: 1, name: 'Pieczony Ziemniak', duration: 200 },
    { input: B.NETHERRACK, output: B.BRICK_ITEM, count: 1, name: 'Cegła Netheru', duration: 200 },
];

/** Fuel values: how many items one piece of fuel can smelt */
export const FUEL_VALUES: Record<number, number> = {
    [B.COAL]: 8,
    [B.OAK_LOG]: 1.5,
    [B.SPRUCE]: 1.5,
    [B.BIRCH_LOG]: 1.5,
    [B.PLANKS]: 1.5,
    [B.SPRUCE_PLANKS]: 1.5,
    [B.BIRCH_PLANKS]: 1.5,
    [B.STICK]: 0.5,
    [B.CRAFTING]: 1.5,
    [B.BOOKSHELF]: 1.5,
    [B.CHEST]: 1.5,
    [B.TRAPDOOR]: 1.5,
    [B.LADDER]: 1.5,
    [B.WOOL_WHITE]: 0.5,
    [B.WOOL_RED]: 0.5,
    [B.WOOL_BLUE]: 0.5,
    [B.WOOL_GREEN]: 0.5,
    [B.WOOL_YELLOW]: 0.5,
    [B.WOOL_BLACK]: 0.5,
    [B.LAVA_BUCKET]: 100,
};

// ══════════════════════════════════════════════════════════
// RECIPE MATCHING ENGINE
// ══════════════════════════════════════════════════════════

/**
 * Match a crafting grid against all recipes.
 * @param grid Flat array (length 4 for 2x2, length 9 for 3x3). Row-major.
 * @param gridSize 2 or 3 (grid dimension)
 */
export function matchRecipe(
    grid: number[],
    gridSize: number = 3
): { result: number; count: number; name: string } | null {
    // Collect non-empty items from grid
    const gridItems: { id: number; r: number; c: number }[] = [];
    for (let i = 0; i < grid.length; i++) {
        if (grid[i] !== 0) {
            gridItems.push({ id: grid[i], r: Math.floor(i / gridSize), c: i % gridSize });
        }
    }
    if (gridItems.length === 0) return null;

    for (const recipe of RECIPES) {
        if (recipe.type === 'shapeless') {
            // ─── Shapeless Matching ─────────────────────────
            const ingredients = [...(recipe.ingredients as number[])];
            if (ingredients.length !== gridItems.length) continue;

            const remaining = gridItems.map(g => g.id);
            let match = true;
            for (const ing of ingredients) {
                const idx = remaining.indexOf(ing);
                if (idx === -1) { match = false; break; }
                remaining.splice(idx, 1);
            }
            if (match) return { result: recipe.result, count: recipe.count, name: recipe.name };
        } else {
            // ─── Shaped Matching ────────────────────────────
            const pattern = recipe.ingredients as number[][];
            const pRows = pattern.length;
            const pCols = Math.max(...pattern.map(r => r.length));

            // Skip if pattern doesn't fit in grid
            if (pRows > gridSize || pCols > gridSize) continue;

            // Get pattern non-empty items
            const pItems: { id: number; r: number; c: number }[] = [];
            for (let r = 0; r < pRows; r++) {
                for (let c = 0; c < pCols; c++) {
                    const id = pattern[r]?.[c] ?? 0;
                    if (id !== 0) pItems.push({ id, r, c });
                }
            }

            if (pItems.length !== gridItems.length) continue;

            // Find bounding boxes
            let pMinR = pRows, pMaxR = -1, pMinC = pCols, pMaxC = -1;
            for (const p of pItems) {
                if (p.r < pMinR) pMinR = p.r;
                if (p.r > pMaxR) pMaxR = p.r;
                if (p.c < pMinC) pMinC = p.c;
                if (p.c > pMaxC) pMaxC = p.c;
            }

            let gMinR = gridSize, gMaxR = -1, gMinC = gridSize, gMaxC = -1;
            for (const g of gridItems) {
                if (g.r < gMinR) gMinR = g.r;
                if (g.r > gMaxR) gMaxR = g.r;
                if (g.c < gMinC) gMinC = g.c;
                if (g.c > gMaxC) gMaxC = g.c;
            }

            const pw = pMaxC - pMinC + 1;
            const ph = pMaxR - pMinR + 1;
            const gw = gMaxC - gMinC + 1;
            const gh = gMaxR - gMinR + 1;

            if (pw !== gw || ph !== gh) continue;

            // Compare relative positions
            let match = true;
            for (const p of pItems) {
                const targetR = gMinR + (p.r - pMinR);
                const targetC = gMinC + (p.c - pMinC);
                const found = gridItems.find(g => g.r === targetR && g.c === targetC && g.id === p.id);
                if (!found) { match = false; break; }
            }
            if (match) return { result: recipe.result, count: recipe.count, name: recipe.name };
        }
    }

    return null;
}

/** Find smelting recipe for an input item */
export function findSmeltingRecipe(inputId: number): SmeltingRecipe | null {
    return SMELTING_RECIPES.find(r => r.input === inputId) ?? null;
}

/** Get fuel value (number of items it can smelt) */
export function getFuelValue(id: number): number {
    return FUEL_VALUES[id] ?? 0;
}
