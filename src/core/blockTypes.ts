/**
 * Block Type Registry (Expanded)
 *
 * Central definition for all block types.
 * To add a new block: add an ID constant and a BLOCK_DATA entry.
 * Everything else (textures, world gen, inventory) adapts automatically.
 */

// ─── Block Type IDs ──────────────────────────────────────
export const enum BlockType {
    AIR = 0,
    GRASS = 1,
    DIRT = 2,
    STONE = 3,
    COBBLE = 4,
    SAND = 5,
    OAK_LOG = 6,
    LEAVES = 7,
    WATER = 8,
    BEDROCK = 9,
    DIAMOND = 10,
    COAL_ORE = 11,
    IRON_ORE = 12,
    GLASS = 13,
    PLANKS = 14,
    BRICK = 15,
    SNOW = 16,
    GRAVEL = 17,
    SPRUCE = 18,
    GOLD_ORE = 19,
    OBSIDIAN = 20,
    TNT = 21,
    BOOKSHELF = 22,
    CRAFTING = 23,
    FURNACE = 24,
    SANDSTONE = 25,
    // ─── New Blocks ──────────────────────────────────
    CLAY = 26,
    MOSSY_COBBLE = 27,
    FLOWER_RED = 28,
    FLOWER_YELLOW = 29,
    TALL_GRASS = 30,
    CACTUS = 31,
    MELON = 32,
    PUMPKIN = 33,
    WOOL_WHITE = 34,
    WOOL_RED = 35,
    WOOL_BLUE = 36,
    WOOL_GREEN = 37,
    WOOL_YELLOW = 38,
    WOOL_BLACK = 39,
    HAY_BALE = 40,
    COBBLE_SLAB = 41,
    TORCH = 42,
    LADDER = 43,
    IRON_BLOCK = 44,
    GOLD_BLOCK = 45,
    DIAMOND_BLOCK = 46,
    EMERALD_ORE = 47,
    EMERALD_BLOCK = 48,
    LAPIS_ORE = 49,
    LAPIS_BLOCK = 50,
    REDSTONE_ORE = 51,
    SPRUCE_PLANKS = 52,
    BIRCH_LOG = 53,
    BIRCH_PLANKS = 54,
    STONE_BRICKS = 55,
    MOSSY_STONE_BRICKS = 56,
    GLOWSTONE = 57,
    NETHERRACK = 58,
    // ─── Tool Items (not placeable, used in crafting) ──
    STICK = 100,
    WOODEN_PICKAXE = 101,
    WOODEN_AXE = 102,
    WOODEN_SHOVEL = 103,
    WOODEN_SWORD = 104,
    STONE_PICKAXE = 105,
    STONE_AXE = 106,
    STONE_SHOVEL = 107,
    STONE_SWORD = 108,
    IRON_PICKAXE = 109,
    IRON_AXE = 110,
    IRON_SHOVEL = 111,
    IRON_SWORD = 112,
}

// ─── Block Data Interface ────────────────────────────────
export interface BlockInfo {
    readonly name: string;
    readonly color: string;        // base / side color
    readonly top?: string;         // optional top face color
    readonly bottom?: string;      // optional bottom face color
    readonly sideOverlay?: string; // grass-style side overlay
    readonly ore?: string;         // ore spot color
    readonly transparent: boolean;
    readonly solid: boolean;
    readonly breakTime: number;    // seconds to break (0 = instant)
    readonly tool?: 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'hand';
    readonly isItem?: boolean;     // not a placeable block, just an item
    readonly stackSize?: number;   // max per stack (default 64)
    readonly light?: number;       // emits light 0-15
}

// ─── Block Data Map ──────────────────────────────────────
export const BLOCK_DATA: Record<number, BlockInfo> = {
    [BlockType.GRASS]: { name: 'Trawa', color: '#8B6B3E', top: '#5da83a', bottom: '#8B6B3E', sideOverlay: '#5da83a', transparent: false, solid: true, breakTime: 0.6, tool: 'shovel' },
    [BlockType.DIRT]: { name: 'Ziemia', color: '#8B6B3E', transparent: false, solid: true, breakTime: 0.5, tool: 'shovel' },
    [BlockType.STONE]: { name: 'Kamień', color: '#888888', transparent: false, solid: true, breakTime: 1.5, tool: 'pickaxe' },
    [BlockType.COBBLE]: { name: 'Bruk', color: '#777777', transparent: false, solid: true, breakTime: 2.0, tool: 'pickaxe' },
    [BlockType.SAND]: { name: 'Piasek', color: '#e6d5a8', transparent: false, solid: true, breakTime: 0.5, tool: 'shovel' },
    [BlockType.OAK_LOG]: { name: 'Dębowy Pień', color: '#6b4226', top: '#a68050', bottom: '#a68050', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.LEAVES]: { name: 'Liście', color: '#3a8c27', transparent: true, solid: true, breakTime: 0.2 },
    [BlockType.WATER]: { name: 'Woda', color: '#2244aa', transparent: true, solid: false, breakTime: 999 },
    [BlockType.BEDROCK]: { name: 'Podłoże', color: '#333333', transparent: false, solid: true, breakTime: 999 },
    [BlockType.DIAMOND]: { name: 'Ruda Diamentu', color: '#888888', ore: '#44ffee', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.COAL_ORE]: { name: 'Ruda Węgla', color: '#888888', ore: '#222222', transparent: false, solid: true, breakTime: 2.0, tool: 'pickaxe' },
    [BlockType.IRON_ORE]: { name: 'Ruda Żelaza', color: '#888888', ore: '#c4a882', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.GLASS]: { name: 'Szkło', color: '#c8e8ff', transparent: true, solid: true, breakTime: 0.3 },
    [BlockType.PLANKS]: { name: 'Dębowe Deski', color: '#b8945f', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.BRICK]: { name: 'Cegły', color: '#9b4a3c', transparent: false, solid: true, breakTime: 2.0, tool: 'pickaxe' },
    [BlockType.SNOW]: { name: 'Śnieg', color: '#f0f0f5', transparent: false, solid: true, breakTime: 0.5, tool: 'shovel' },
    [BlockType.GRAVEL]: { name: 'Żwir', color: '#7a7a7a', transparent: false, solid: true, breakTime: 0.6, tool: 'shovel' },
    [BlockType.SPRUCE]: { name: 'Świerkowy Pień', color: '#3d2813', top: '#6b4226', bottom: '#6b4226', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.GOLD_ORE]: { name: 'Ruda Złota', color: '#888888', ore: '#ffd700', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.OBSIDIAN]: { name: 'Obsydian', color: '#1a0a2e', transparent: false, solid: true, breakTime: 10.0, tool: 'pickaxe' },
    [BlockType.TNT]: { name: 'TNT', color: '#cc3333', top: '#ddaa44', transparent: false, solid: true, breakTime: 0.0 },
    [BlockType.BOOKSHELF]: { name: 'Biblioteczka', color: '#b8945f', transparent: false, solid: true, breakTime: 1.5, tool: 'axe' },
    [BlockType.CRAFTING]: { name: 'Stół Rzemieślniczy', color: '#b8945f', top: '#8B6B3E', transparent: false, solid: true, breakTime: 2.5, tool: 'axe' },
    [BlockType.FURNACE]: { name: 'Piec', color: '#777777', transparent: false, solid: true, breakTime: 3.5, tool: 'pickaxe' },
    [BlockType.SANDSTONE]: { name: 'Piaskowiec', color: '#e6d5a8', top: '#d4c494', transparent: false, solid: true, breakTime: 2.0, tool: 'pickaxe' },
    // ─── New Blocks ──────────────────────────────────
    [BlockType.CLAY]: { name: 'Glina', color: '#9eaab7', transparent: false, solid: true, breakTime: 0.6, tool: 'shovel' },
    [BlockType.MOSSY_COBBLE]: { name: 'Omszony Bruk', color: '#6a7a5a', transparent: false, solid: true, breakTime: 2.0, tool: 'pickaxe' },
    [BlockType.FLOWER_RED]: { name: 'Czerwony Kwiat', color: '#ff3333', transparent: true, solid: false, breakTime: 0.0 },
    [BlockType.FLOWER_YELLOW]: { name: 'Żółty Kwiat', color: '#ffdd33', transparent: true, solid: false, breakTime: 0.0 },
    [BlockType.TALL_GRASS]: { name: 'Wysoka Trawa', color: '#4a8c30', transparent: true, solid: false, breakTime: 0.0 },
    [BlockType.CACTUS]: { name: 'Kaktus', color: '#2a6a1a', top: '#3a8a2a', transparent: false, solid: true, breakTime: 0.4 },
    [BlockType.MELON]: { name: 'Arbuz', color: '#5a8a2a', top: '#758f50', transparent: false, solid: true, breakTime: 1.0, tool: 'axe' },
    [BlockType.PUMPKIN]: { name: 'Dynia', color: '#cc7722', top: '#997722', transparent: false, solid: true, breakTime: 1.0, tool: 'axe' },
    [BlockType.WOOL_WHITE]: { name: 'Biała Wełna', color: '#e8e8e8', transparent: false, solid: true, breakTime: 0.8 },
    [BlockType.WOOL_RED]: { name: 'Czerwona Wełna', color: '#b82020', transparent: false, solid: true, breakTime: 0.8 },
    [BlockType.WOOL_BLUE]: { name: 'Niebieska Wełna', color: '#2020b8', transparent: false, solid: true, breakTime: 0.8 },
    [BlockType.WOOL_GREEN]: { name: 'Zielona Wełna', color: '#20b820', transparent: false, solid: true, breakTime: 0.8 },
    [BlockType.WOOL_YELLOW]: { name: 'Żółta Wełna', color: '#d4d420', transparent: false, solid: true, breakTime: 0.8 },
    [BlockType.WOOL_BLACK]: { name: 'Czarna Wełna', color: '#222222', transparent: false, solid: true, breakTime: 0.8 },
    [BlockType.HAY_BALE]: { name: 'Bela Siana', color: '#c8a830', top: '#b89820', transparent: false, solid: true, breakTime: 0.5 },
    [BlockType.COBBLE_SLAB]: { name: 'Płyta Brukowa', color: '#777777', transparent: false, solid: true, breakTime: 2.0, tool: 'pickaxe' },
    [BlockType.TORCH]: { name: 'Pochodnia', color: '#ffcc00', transparent: true, solid: false, breakTime: 0.0, light: 14 },
    [BlockType.LADDER]: { name: 'Drabina', color: '#a08050', transparent: true, solid: false, breakTime: 0.4, tool: 'axe' },
    [BlockType.IRON_BLOCK]: { name: 'Blok Żelaza', color: '#d8d8d8', transparent: false, solid: true, breakTime: 5.0, tool: 'pickaxe' },
    [BlockType.GOLD_BLOCK]: { name: 'Blok Złota', color: '#ffd700', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.DIAMOND_BLOCK]: { name: 'Blok Diamentu', color: '#44eeee', transparent: false, solid: true, breakTime: 5.0, tool: 'pickaxe' },
    [BlockType.EMERALD_ORE]: { name: 'Ruda Szmaragdu', color: '#888888', ore: '#22cc44', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.EMERALD_BLOCK]: { name: 'Blok Szmaragdu', color: '#22cc44', transparent: false, solid: true, breakTime: 5.0, tool: 'pickaxe' },
    [BlockType.LAPIS_ORE]: { name: 'Ruda Lapis', color: '#888888', ore: '#2244aa', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.LAPIS_BLOCK]: { name: 'Blok Lapis', color: '#2244aa', transparent: false, solid: true, breakTime: 5.0, tool: 'pickaxe' },
    [BlockType.REDSTONE_ORE]: { name: 'Ruda Redstone', color: '#888888', ore: '#cc2222', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.SPRUCE_PLANKS]: { name: 'Świerkowe Deski', color: '#6b4226', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.BIRCH_LOG]: { name: 'Brzozowy Pień', color: '#d4cca0', top: '#b8a880', bottom: '#b8a880', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.BIRCH_PLANKS]: { name: 'Brzozowe Deski', color: '#d4c8a0', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.STONE_BRICKS]: { name: 'Kamienne Cegły', color: '#888888', transparent: false, solid: true, breakTime: 1.5, tool: 'pickaxe' },
    [BlockType.MOSSY_STONE_BRICKS]: { name: 'Omszony Kamień', color: '#6a8a5a', transparent: false, solid: true, breakTime: 1.5, tool: 'pickaxe' },
    [BlockType.GLOWSTONE]: { name: 'Jasnokamień', color: '#eedd66', transparent: false, solid: true, breakTime: 0.3, light: 15 },
    [BlockType.NETHERRACK]: { name: 'Netherrak', color: '#6a2020', transparent: false, solid: true, breakTime: 0.4, tool: 'pickaxe' },
    // ─── Tool Items ──────────────────────────────────
    [BlockType.STICK]: { name: 'Patyk', color: '#a08050', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.WOODEN_PICKAXE]: { name: 'Drewniany Kilof', color: '#b8945f', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.WOODEN_AXE]: { name: 'Drewniana Siekiera', color: '#b8945f', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.WOODEN_SHOVEL]: { name: 'Drewniana Łopata', color: '#b8945f', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.WOODEN_SWORD]: { name: 'Drewniany Miecz', color: '#b8945f', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.STONE_PICKAXE]: { name: 'Kamienny Kilof', color: '#888888', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.STONE_AXE]: { name: 'Kamienna Siekiera', color: '#888888', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.STONE_SHOVEL]: { name: 'Kamienna Łopata', color: '#888888', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.STONE_SWORD]: { name: 'Kamienny Miecz', color: '#888888', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.IRON_PICKAXE]: { name: 'Żelazny Kilof', color: '#d8d8d8', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.IRON_AXE]: { name: 'Żelazna Siekiera', color: '#d8d8d8', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.IRON_SHOVEL]: { name: 'Żelazna Łopata', color: '#d8d8d8', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.IRON_SWORD]: { name: 'Żelazny Miecz', color: '#d8d8d8', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
};

/** Get block info safely */
export function getBlockInfo(type: number): BlockInfo | null {
    return BLOCK_DATA[type] ?? null;
}

/** All placeable block IDs (for inventory/creative) */
export const PLACEABLE_BLOCKS: number[] = Object.keys(BLOCK_DATA)
    .map(Number)
    .filter((id) => {
        const d = BLOCK_DATA[id];
        return d && id !== BlockType.WATER && id !== BlockType.BEDROCK && !d.isItem;
    });

/** All item IDs (tools etc.) */
export const ITEM_BLOCKS: number[] = Object.keys(BLOCK_DATA)
    .map(Number)
    .filter((id) => BLOCK_DATA[id]?.isItem);

/** All craftable IDs (blocks + items) */
export const ALL_ITEMS: number[] = Object.keys(BLOCK_DATA)
    .map(Number)
    .filter((id) => id !== BlockType.AIR && id !== BlockType.WATER && id !== BlockType.BEDROCK);

/** Default hotbar (creative mode) */
export const DEFAULT_HOTBAR: number[] = [
    BlockType.GRASS,
    BlockType.DIRT,
    BlockType.STONE,
    BlockType.OAK_LOG,
    BlockType.PLANKS,
    BlockType.COBBLE,
    BlockType.SAND,
    BlockType.GLASS,
    BlockType.BRICK,
];

/** Empty hotbar for survival */
export const EMPTY_HOTBAR: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];

/** What a block drops when broken (usually itself, stone drops cobble) */
export function getBlockDrop(type: number): number {
    switch (type) {
        case BlockType.STONE: return BlockType.COBBLE;
        case BlockType.GRASS: return BlockType.DIRT;
        case BlockType.LEAVES: return Math.random() < 0.05 ? BlockType.OAK_LOG : 0; // Small chance for stick
        case BlockType.TALL_GRASS: return 0;
        case BlockType.GLASS: return 0; // Glass breaks, doesn't drop
        case BlockType.GLOWSTONE: return BlockType.GLOWSTONE;
        default: return type;
    }
}
