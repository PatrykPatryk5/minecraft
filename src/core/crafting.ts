/**
 * Crafting Recipes Registry (Expanded)
 *
 * 30+ recipes including tools, blocks, and items.
 * Pattern-based matching (3x3 grid, position-flexible).
 */

import { BlockType } from './blockTypes';

export interface CraftingRecipe {
    pattern: (number | 0)[][];
    result: number;
    count: number;
    name: string;
    category: 'blocks' | 'tools' | 'items' | 'decoration';
}

const P = BlockType.PLANKS;
const S = BlockType.STICK;
const C = BlockType.COBBLE;
const I = BlockType.IRON_BLOCK; // iron ingot stand-in — we use iron ore
const IO = BlockType.IRON_ORE;

export const RECIPES: CraftingRecipe[] = [
    // ═══════════════════════════════════════════
    // BASIC ITEMS
    // ═══════════════════════════════════════════
    {
        pattern: [[0, 0, 0], [0, BlockType.OAK_LOG, 0], [0, 0, 0]],
        result: BlockType.PLANKS, count: 4, name: 'Dębowe Deski', category: 'blocks',
    },
    {
        pattern: [[0, 0, 0], [0, BlockType.SPRUCE, 0], [0, 0, 0]],
        result: BlockType.SPRUCE_PLANKS, count: 4, name: 'Świerkowe Deski', category: 'blocks',
    },
    {
        pattern: [[0, 0, 0], [0, BlockType.BIRCH_LOG, 0], [0, 0, 0]],
        result: BlockType.BIRCH_PLANKS, count: 4, name: 'Brzozowe Deski', category: 'blocks',
    },
    // Sticks: 2 planks vertically
    {
        pattern: [[0, 0, 0], [0, P, 0], [0, P, 0]],
        result: BlockType.STICK, count: 4, name: 'Patyki', category: 'items',
    },
    // Torch
    {
        pattern: [[0, 0, 0], [0, BlockType.COAL_ORE, 0], [0, S, 0]],
        result: BlockType.TORCH, count: 4, name: 'Pochodnie', category: 'items',
    },
    // Ladder
    {
        pattern: [[S, 0, S], [S, S, S], [S, 0, S]],
        result: BlockType.LADDER, count: 3, name: 'Drabina', category: 'items',
    },

    // ═══════════════════════════════════════════
    // WOODEN TOOLS
    // ═══════════════════════════════════════════
    {
        pattern: [[P, P, P], [0, S, 0], [0, S, 0]],
        result: BlockType.WOODEN_PICKAXE, count: 1, name: 'Drewniany Kilof', category: 'tools',
    },
    {
        pattern: [[P, P, 0], [P, S, 0], [0, S, 0]],
        result: BlockType.WOODEN_AXE, count: 1, name: 'Drewniana Siekiera', category: 'tools',
    },
    {
        pattern: [[0, P, 0], [0, S, 0], [0, S, 0]],
        result: BlockType.WOODEN_SHOVEL, count: 1, name: 'Drewniana Łopata', category: 'tools',
    },
    {
        pattern: [[0, P, 0], [0, P, 0], [0, S, 0]],
        result: BlockType.WOODEN_SWORD, count: 1, name: 'Drewniany Miecz', category: 'tools',
    },

    // ═══════════════════════════════════════════
    // STONE TOOLS
    // ═══════════════════════════════════════════
    {
        pattern: [[C, C, C], [0, S, 0], [0, S, 0]],
        result: BlockType.STONE_PICKAXE, count: 1, name: 'Kamienny Kilof', category: 'tools',
    },
    {
        pattern: [[C, C, 0], [C, S, 0], [0, S, 0]],
        result: BlockType.STONE_AXE, count: 1, name: 'Kamienna Siekiera', category: 'tools',
    },
    {
        pattern: [[0, C, 0], [0, S, 0], [0, S, 0]],
        result: BlockType.STONE_SHOVEL, count: 1, name: 'Kamienna Łopata', category: 'tools',
    },
    {
        pattern: [[0, C, 0], [0, C, 0], [0, S, 0]],
        result: BlockType.STONE_SWORD, count: 1, name: 'Kamienny Miecz', category: 'tools',
    },

    // ═══════════════════════════════════════════
    // IRON TOOLS (use iron ore as stand-in for ingots)
    // ═══════════════════════════════════════════
    {
        pattern: [[IO, IO, IO], [0, S, 0], [0, S, 0]],
        result: BlockType.IRON_PICKAXE, count: 1, name: 'Żelazny Kilof', category: 'tools',
    },
    {
        pattern: [[IO, IO, 0], [IO, S, 0], [0, S, 0]],
        result: BlockType.IRON_AXE, count: 1, name: 'Żelazna Siekiera', category: 'tools',
    },
    {
        pattern: [[0, IO, 0], [0, S, 0], [0, S, 0]],
        result: BlockType.IRON_SHOVEL, count: 1, name: 'Żelazna Łopata', category: 'tools',
    },
    {
        pattern: [[0, IO, 0], [0, IO, 0], [0, S, 0]],
        result: BlockType.IRON_SWORD, count: 1, name: 'Żelazny Miecz', category: 'tools',
    },

    // ═══════════════════════════════════════════
    // BUILDING BLOCKS
    // ═══════════════════════════════════════════
    {
        pattern: [[P, P, 0], [P, P, 0], [0, 0, 0]],
        result: BlockType.CRAFTING, count: 1, name: 'Stół Rzemieślniczy', category: 'blocks',
    },
    {
        pattern: [[C, C, C], [C, 0, C], [C, C, C]],
        result: BlockType.FURNACE, count: 1, name: 'Piec', category: 'blocks',
    },
    {
        pattern: [[BlockType.SAND, BlockType.SAND, 0], [BlockType.SAND, BlockType.SAND, 0], [0, 0, 0]],
        result: BlockType.SANDSTONE, count: 1, name: 'Piaskowiec', category: 'blocks',
    },
    {
        pattern: [[0, 0, 0], [0, C, 0], [0, 0, 0]],
        result: BlockType.STONE, count: 1, name: 'Kamień', category: 'blocks',
    },
    {
        pattern: [[BlockType.DIRT, BlockType.DIRT, 0], [BlockType.DIRT, BlockType.DIRT, 0], [0, 0, 0]],
        result: BlockType.BRICK, count: 1, name: 'Cegły', category: 'blocks',
    },
    {
        pattern: [[0, 0, 0], [0, BlockType.SAND, 0], [0, 0, 0]],
        result: BlockType.GLASS, count: 1, name: 'Szkło', category: 'blocks',
    },
    {
        pattern: [[BlockType.SAND, BlockType.GRAVEL, BlockType.SAND], [BlockType.GRAVEL, BlockType.SAND, BlockType.GRAVEL], [BlockType.SAND, BlockType.GRAVEL, BlockType.SAND]],
        result: BlockType.TNT, count: 1, name: 'TNT', category: 'blocks',
    },
    // Stone Bricks
    {
        pattern: [[BlockType.STONE, BlockType.STONE, 0], [BlockType.STONE, BlockType.STONE, 0], [0, 0, 0]],
        result: BlockType.STONE_BRICKS, count: 4, name: 'Kamienne Cegły', category: 'blocks',
    },
    // Iron Block
    {
        pattern: [[IO, IO, IO], [IO, IO, IO], [IO, IO, IO]],
        result: BlockType.IRON_BLOCK, count: 1, name: 'Blok Żelaza', category: 'blocks',
    },
    // Gold Block
    {
        pattern: [[BlockType.GOLD_ORE, BlockType.GOLD_ORE, BlockType.GOLD_ORE], [BlockType.GOLD_ORE, BlockType.GOLD_ORE, BlockType.GOLD_ORE], [BlockType.GOLD_ORE, BlockType.GOLD_ORE, BlockType.GOLD_ORE]],
        result: BlockType.GOLD_BLOCK, count: 1, name: 'Blok Złota', category: 'blocks',
    },
    // Diamond Block
    {
        pattern: [[BlockType.DIAMOND, BlockType.DIAMOND, BlockType.DIAMOND], [BlockType.DIAMOND, BlockType.DIAMOND, BlockType.DIAMOND], [BlockType.DIAMOND, BlockType.DIAMOND, BlockType.DIAMOND]],
        result: BlockType.DIAMOND_BLOCK, count: 1, name: 'Blok Diamentu', category: 'blocks',
    },
    // Bookshelf
    {
        pattern: [[P, P, P], [P, P, P], [P, P, P]],
        result: BlockType.BOOKSHELF, count: 1, name: 'Biblioteczka', category: 'decoration',
    },
    // Wool (from string-like = leaves)
    {
        pattern: [[BlockType.LEAVES, BlockType.LEAVES, 0], [BlockType.LEAVES, BlockType.LEAVES, 0], [0, 0, 0]],
        result: BlockType.WOOL_WHITE, count: 1, name: 'Biała Wełna', category: 'decoration',
    },
    // Hay Bale
    {
        pattern: [[BlockType.TALL_GRASS, BlockType.TALL_GRASS, BlockType.TALL_GRASS], [BlockType.TALL_GRASS, BlockType.TALL_GRASS, BlockType.TALL_GRASS], [BlockType.TALL_GRASS, BlockType.TALL_GRASS, BlockType.TALL_GRASS]],
        result: BlockType.HAY_BALE, count: 1, name: 'Bela Siana', category: 'decoration',
    },
];

/**
 * Match crafting grid against recipes.
 * Grid is flat 9-element array (row-major 3x3).
 */
export function matchRecipe(grid: number[]): { result: number; count: number; name: string } | null {
    for (const recipe of RECIPES) {
        const flat = recipe.pattern.flat();

        // Direct match
        if (flat.every((v, i) => v === grid[i])) {
            return { result: recipe.result, count: recipe.count, name: recipe.name };
        }

        // Try all horizontal/vertical offsets
        // Find bounding box of non-zero cells in pattern
        let minR = 3, maxR = -1, minC = 3, maxC = -1;
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                if (flat[r * 3 + c] !== 0) {
                    if (r < minR) minR = r;
                    if (r > maxR) maxR = r;
                    if (c < minC) minC = c;
                    if (c > maxC) maxC = c;
                }
            }
        }

        // Try shifting
        for (let dy = -minR; dy <= 2 - maxR; dy++) {
            for (let dx = -minC; dx <= 2 - maxC; dx++) {
                if (dy === 0 && dx === 0) continue; // Already checked
                let match = true;
                const testGrid = Array(9).fill(0);
                for (let r = 0; r < 3 && match; r++) {
                    for (let c = 0; c < 3 && match; c++) {
                        const val = flat[r * 3 + c];
                        if (val !== 0) {
                            const nr = r + dy, nc = c + dx;
                            if (nr < 0 || nr >= 3 || nc < 0 || nc >= 3) { match = false; break; }
                            testGrid[nr * 3 + nc] = val;
                        }
                    }
                }
                if (match && testGrid.every((v, i) => v === grid[i])) {
                    return { result: recipe.result, count: recipe.count, name: recipe.name };
                }
            }
        }
    }
    return null;
}
