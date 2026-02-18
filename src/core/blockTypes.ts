/**
 * Block Type Registry (Comprehensive)
 *
 * Central definition for all block types, items, tools, food.
 * To add a new block: add an ID constant and a BLOCK_DATA entry.
 * Everything else (textures, world gen, inventory) adapts automatically.
 */

// ─── Block Type IDs ──────────────────────────────────────
export enum BlockType {
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
    // ─── Additional Blocks ──────────────────────────────
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
    // ─── Utility Blocks ─────────────────────────────────
    CHEST = 59,
    TRAPDOOR = 60,
    FURNACE_ON = 61,
    // ─── Tool Items ─────────────────────────────────────
    STICK = 100,
    // Wooden tools
    WOODEN_PICKAXE = 101,
    WOODEN_AXE = 102,
    WOODEN_SHOVEL = 103,
    WOODEN_SWORD = 104,
    WOODEN_HOE = 105,
    // Stone tools
    STONE_PICKAXE = 111,
    STONE_AXE = 112,
    STONE_SHOVEL = 113,
    STONE_SWORD = 114,
    STONE_HOE = 115,
    // Iron tools
    IRON_PICKAXE = 121,
    IRON_AXE = 122,
    IRON_SHOVEL = 123,
    IRON_SWORD = 124,
    IRON_HOE = 125,
    // Gold tools
    GOLD_PICKAXE = 131,
    GOLD_AXE = 132,
    GOLD_SHOVEL = 133,
    GOLD_SWORD = 134,
    GOLD_HOE = 135,
    // Diamond tools
    DIAMOND_PICKAXE = 141,
    DIAMOND_AXE = 142,
    DIAMOND_SHOVEL = 143,
    DIAMOND_SWORD = 144,
    DIAMOND_HOE = 145,
    // ─── Materials ───────────────────────────────────────
    COAL = 200,
    IRON_INGOT = 201,
    GOLD_INGOT = 202,
    DIAMOND_GEM = 203,
    EMERALD = 204,
    LAPIS = 205,
    REDSTONE = 206,
    STRING = 207,
    FEATHER = 208,
    GUNPOWDER = 209,
    WHEAT = 210,
    FLINT = 211,
    BRICK_ITEM = 212,
    CLAY_BALL = 213,
    PAPER = 214,
    BOOK = 215,
    SLIME_BALL = 216,
    DYE_RED = 217,
    DYE_BLUE = 218,
    DYE_GREEN = 219,
    DYE_YELLOW = 220,
    DYE_BLACK = 221,
    GLOWSTONE_DUST = 222,
    SUGAR = 223,
    LEATHER = 224,
    BONE = 225,
    BONE_MEAL = 226,
    // ─── Utility Items ──────────────────────────────────
    BUCKET = 230,
    WATER_BUCKET = 231,
    LAVA_BUCKET = 232,
    FLINT_AND_STEEL = 233,
    SHEARS = 234,
    BOW = 235,
    ARROW = 236,
    COMPASS = 237,
    CLOCK = 238,
    // ─── Food ────────────────────────────────────────────
    APPLE = 300,
    BREAD = 301,
    PORKCHOP_RAW = 302,
    PORKCHOP_COOKED = 303,
    BEEF_RAW = 304,
    STEAK = 305,
    CHICKEN_RAW = 306,
    CHICKEN_COOKED = 307,
    CARROT = 308,
    POTATO = 309,
    BAKED_POTATO = 310,
    GOLDEN_APPLE = 311,
    CAKE = 312,
    COOKIE = 313,
    MELON_SLICE = 314,
    MUSHROOM_STEW = 315,
    // ─── Armor ───────────────────────────────────────────
    LEATHER_HELMET = 400,
    LEATHER_CHESTPLATE = 401,
    LEATHER_LEGGINGS = 402,
    LEATHER_BOOTS = 403,
    IRON_HELMET = 410,
    IRON_CHESTPLATE = 411,
    IRON_LEGGINGS = 412,
    IRON_BOOTS = 413,
    DIAMOND_HELMET = 420,
    DIAMOND_CHESTPLATE = 421,
    DIAMOND_LEGGINGS = 422,
    DIAMOND_BOOTS = 423,
    // ─── Progression Items ───────────────────────────────
    ENDER_PEARL = 500,
    BLAZE_ROD = 501,
    BLAZE_POWDER = 502,
    EYE_OF_ENDER = 503,
    NETHER_STAR = 504,
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
    readonly foodRestore?: number; // hunger points restored
}

// ─── Block Data Map ──────────────────────────────────────
export const BLOCK_DATA: Record<number, BlockInfo> = {
    // ─── Natural Blocks ─────────────────────────────────
    [BlockType.GRASS]: { name: 'Trawa', color: '#8B6B3E', top: '#5da83a', bottom: '#8B6B3E', sideOverlay: '#5da83a', transparent: false, solid: true, breakTime: 0.6, tool: 'shovel' },
    [BlockType.DIRT]: { name: 'Ziemia', color: '#8B6B3E', transparent: false, solid: true, breakTime: 0.5, tool: 'shovel' },
    [BlockType.STONE]: { name: 'Kamień', color: '#888888', transparent: false, solid: true, breakTime: 1.5, tool: 'pickaxe' },
    [BlockType.COBBLE]: { name: 'Bruk', color: '#777777', transparent: false, solid: true, breakTime: 2.0, tool: 'pickaxe' },
    [BlockType.SAND]: { name: 'Piasek', color: '#e6d5a8', transparent: false, solid: true, breakTime: 0.5, tool: 'shovel' },
    [BlockType.OAK_LOG]: { name: 'Dębowy Pień', color: '#6b4226', top: '#a68050', bottom: '#a68050', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.LEAVES]: { name: 'Liście', color: '#3a8c27', transparent: true, solid: true, breakTime: 0.2 },
    [BlockType.WATER]: { name: 'Woda', color: '#2244aa', transparent: true, solid: false, breakTime: 999 },
    [BlockType.BEDROCK]: { name: 'Podłoże', color: '#333333', transparent: false, solid: true, breakTime: 999 },
    [BlockType.SNOW]: { name: 'Śnieg', color: '#f0f0f5', transparent: false, solid: true, breakTime: 0.5, tool: 'shovel' },
    [BlockType.GRAVEL]: { name: 'Żwir', color: '#7a7a7a', transparent: false, solid: true, breakTime: 0.6, tool: 'shovel' },
    [BlockType.CLAY]: { name: 'Glina', color: '#9eaab7', transparent: false, solid: true, breakTime: 0.6, tool: 'shovel' },
    // ─── Ores ───────────────────────────────────────────
    [BlockType.DIAMOND]: { name: 'Ruda Diamentu', color: '#888888', ore: '#44ffee', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.COAL_ORE]: { name: 'Ruda Węgla', color: '#888888', ore: '#222222', transparent: false, solid: true, breakTime: 2.0, tool: 'pickaxe' },
    [BlockType.IRON_ORE]: { name: 'Ruda Żelaza', color: '#888888', ore: '#c4a882', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.GOLD_ORE]: { name: 'Ruda Złota', color: '#888888', ore: '#ffd700', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.EMERALD_ORE]: { name: 'Ruda Szmaragdu', color: '#888888', ore: '#22cc44', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.LAPIS_ORE]: { name: 'Ruda Lapis', color: '#888888', ore: '#2244aa', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.REDSTONE_ORE]: { name: 'Ruda Redstone', color: '#888888', ore: '#cc2222', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    // ─── Wood & Planks ──────────────────────────────────
    [BlockType.SPRUCE]: { name: 'Świerkowy Pień', color: '#3d2813', top: '#6b4226', bottom: '#6b4226', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.BIRCH_LOG]: { name: 'Brzozowy Pień', color: '#d4cca0', top: '#b8a880', bottom: '#b8a880', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.PLANKS]: { name: 'Dębowe Deski', color: '#b8945f', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.SPRUCE_PLANKS]: { name: 'Świerkowe Deski', color: '#6b4226', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.BIRCH_PLANKS]: { name: 'Brzozowe Deski', color: '#d4c8a0', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    // ─── Building Blocks ────────────────────────────────
    [BlockType.GLASS]: { name: 'Szkło', color: '#c8e8ff', transparent: true, solid: true, breakTime: 0.3 },
    [BlockType.BRICK]: { name: 'Cegły', color: '#9b4a3c', transparent: false, solid: true, breakTime: 2.0, tool: 'pickaxe' },
    [BlockType.OBSIDIAN]: { name: 'Obsydian', color: '#1a0a2e', transparent: false, solid: true, breakTime: 10.0, tool: 'pickaxe' },
    [BlockType.SANDSTONE]: { name: 'Piaskowiec', color: '#e6d5a8', top: '#d4c494', transparent: false, solid: true, breakTime: 2.0, tool: 'pickaxe' },
    [BlockType.STONE_BRICKS]: { name: 'Kamienne Cegły', color: '#888888', transparent: false, solid: true, breakTime: 1.5, tool: 'pickaxe' },
    [BlockType.MOSSY_STONE_BRICKS]: { name: 'Omszony Kamień', color: '#6a8a5a', transparent: false, solid: true, breakTime: 1.5, tool: 'pickaxe' },
    [BlockType.MOSSY_COBBLE]: { name: 'Omszony Bruk', color: '#6a7a5a', transparent: false, solid: true, breakTime: 2.0, tool: 'pickaxe' },
    [BlockType.COBBLE_SLAB]: { name: 'Płyta Brukowa', color: '#777777', transparent: false, solid: true, breakTime: 2.0, tool: 'pickaxe' },
    [BlockType.NETHERRACK]: { name: 'Netherrak', color: '#6a2020', transparent: false, solid: true, breakTime: 0.4, tool: 'pickaxe' },
    // ─── Metal & Gem Blocks ─────────────────────────────
    [BlockType.IRON_BLOCK]: { name: 'Blok Żelaza', color: '#d8d8d8', transparent: false, solid: true, breakTime: 5.0, tool: 'pickaxe' },
    [BlockType.GOLD_BLOCK]: { name: 'Blok Złota', color: '#ffd700', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.DIAMOND_BLOCK]: { name: 'Blok Diamentu', color: '#44eeee', transparent: false, solid: true, breakTime: 5.0, tool: 'pickaxe' },
    [BlockType.EMERALD_BLOCK]: { name: 'Blok Szmaragdu', color: '#22cc44', transparent: false, solid: true, breakTime: 5.0, tool: 'pickaxe' },
    [BlockType.LAPIS_BLOCK]: { name: 'Blok Lapis', color: '#2244aa', transparent: false, solid: true, breakTime: 5.0, tool: 'pickaxe' },
    // ─── Functional Blocks ──────────────────────────────
    [BlockType.CRAFTING]: { name: 'Stół Rzemieślniczy', color: '#b8945f', top: '#8B6B3E', transparent: false, solid: true, breakTime: 2.5, tool: 'axe' },
    [BlockType.FURNACE]: { name: 'Piec', color: '#777777', transparent: false, solid: true, breakTime: 3.5, tool: 'pickaxe' },
    [BlockType.FURNACE_ON]: { name: 'Piec (aktywny)', color: '#997755', transparent: false, solid: true, breakTime: 3.5, tool: 'pickaxe' },
    [BlockType.CHEST]: { name: 'Skrzynia', color: '#a08050', top: '#907040', transparent: false, solid: true, breakTime: 2.5, tool: 'axe' },
    [BlockType.TNT]: { name: 'TNT', color: '#cc3333', top: '#ddaa44', transparent: false, solid: true, breakTime: 0.0 },
    [BlockType.BOOKSHELF]: { name: 'Biblioteczka', color: '#b8945f', transparent: false, solid: true, breakTime: 1.5, tool: 'axe' },
    [BlockType.TRAPDOOR]: { name: 'Klapa', color: '#806030', transparent: true, solid: false, breakTime: 3.0, tool: 'axe' },
    // ─── Decorative Blocks ──────────────────────────────
    [BlockType.TORCH]: { name: 'Pochodnia', color: '#ffcc00', transparent: true, solid: false, breakTime: 0.0, light: 14 },
    [BlockType.LADDER]: { name: 'Drabina', color: '#a08050', transparent: true, solid: false, breakTime: 0.4, tool: 'axe' },
    [BlockType.GLOWSTONE]: { name: 'Jasnokamień', color: '#eedd66', transparent: false, solid: true, breakTime: 0.3, light: 15 },
    [BlockType.FLOWER_RED]: { name: 'Czerwony Kwiat', color: '#ff3333', transparent: true, solid: false, breakTime: 0.0 },
    [BlockType.FLOWER_YELLOW]: { name: 'Żółty Kwiat', color: '#ffdd33', transparent: true, solid: false, breakTime: 0.0 },
    [BlockType.TALL_GRASS]: { name: 'Wysoka Trawa', color: '#4a8c30', transparent: true, solid: false, breakTime: 0.0 },
    [BlockType.CACTUS]: { name: 'Kaktus', color: '#2a6a1a', top: '#3a8a2a', transparent: false, solid: true, breakTime: 0.4 },
    [BlockType.MELON]: { name: 'Arbuz', color: '#5a8a2a', top: '#758f50', transparent: false, solid: true, breakTime: 1.0, tool: 'axe' },
    [BlockType.PUMPKIN]: { name: 'Dynia', color: '#cc7722', top: '#997722', transparent: false, solid: true, breakTime: 1.0, tool: 'axe' },
    // ─── Wool ───────────────────────────────────────────
    [BlockType.WOOL_WHITE]: { name: 'Biała Wełna', color: '#e8e8e8', transparent: false, solid: true, breakTime: 0.8 },
    [BlockType.WOOL_RED]: { name: 'Czerwona Wełna', color: '#b82020', transparent: false, solid: true, breakTime: 0.8 },
    [BlockType.WOOL_BLUE]: { name: 'Niebieska Wełna', color: '#2020b8', transparent: false, solid: true, breakTime: 0.8 },
    [BlockType.WOOL_GREEN]: { name: 'Zielona Wełna', color: '#20b820', transparent: false, solid: true, breakTime: 0.8 },
    [BlockType.WOOL_YELLOW]: { name: 'Żółta Wełna', color: '#d4d420', transparent: false, solid: true, breakTime: 0.8 },
    [BlockType.WOOL_BLACK]: { name: 'Czarna Wełna', color: '#222222', transparent: false, solid: true, breakTime: 0.8 },
    [BlockType.HAY_BALE]: { name: 'Bela Siana', color: '#c8a830', top: '#b89820', transparent: false, solid: true, breakTime: 0.5 },
    // ─── Wooden Tools ───────────────────────────────────
    [BlockType.STICK]: { name: 'Patyk', color: '#a08050', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 64 },
    [BlockType.WOODEN_PICKAXE]: { name: 'Drewniany Kilof', color: '#b8945f', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.WOODEN_AXE]: { name: 'Drewniana Siekiera', color: '#b8945f', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.WOODEN_SHOVEL]: { name: 'Drewniana Łopata', color: '#b8945f', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.WOODEN_SWORD]: { name: 'Drewniany Miecz', color: '#b8945f', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.WOODEN_HOE]: { name: 'Drewniana Motyka', color: '#b8945f', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    // ─── Stone Tools ────────────────────────────────────
    [BlockType.STONE_PICKAXE]: { name: 'Kamienny Kilof', color: '#888888', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.STONE_AXE]: { name: 'Kamienna Siekiera', color: '#888888', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.STONE_SHOVEL]: { name: 'Kamienna Łopata', color: '#888888', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.STONE_SWORD]: { name: 'Kamienny Miecz', color: '#888888', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.STONE_HOE]: { name: 'Kamienna Motyka', color: '#888888', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    // ─── Iron Tools ─────────────────────────────────────
    [BlockType.IRON_PICKAXE]: { name: 'Żelazny Kilof', color: '#d8d8d8', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.IRON_AXE]: { name: 'Żelazna Siekiera', color: '#d8d8d8', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.IRON_SHOVEL]: { name: 'Żelazna Łopata', color: '#d8d8d8', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.IRON_SWORD]: { name: 'Żelazny Miecz', color: '#d8d8d8', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.IRON_HOE]: { name: 'Żelazna Motyka', color: '#d8d8d8', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    // ─── Gold Tools ─────────────────────────────────────
    [BlockType.GOLD_PICKAXE]: { name: 'Złoty Kilof', color: '#ffd700', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.GOLD_AXE]: { name: 'Złota Siekiera', color: '#ffd700', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.GOLD_SHOVEL]: { name: 'Złota Łopata', color: '#ffd700', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.GOLD_SWORD]: { name: 'Złoty Miecz', color: '#ffd700', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.GOLD_HOE]: { name: 'Złota Motyka', color: '#ffd700', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    // ─── Diamond Tools ──────────────────────────────────
    [BlockType.DIAMOND_PICKAXE]: { name: 'Diamentowy Kilof', color: '#44ffee', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.DIAMOND_AXE]: { name: 'Diamentowa Siekiera', color: '#44ffee', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.DIAMOND_SHOVEL]: { name: 'Diamentowa Łopata', color: '#44ffee', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.DIAMOND_SWORD]: { name: 'Diamentowy Miecz', color: '#44ffee', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.DIAMOND_HOE]: { name: 'Diamentowa Motyka', color: '#44ffee', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    // ─── Materials ───────────────────────────────────────
    [BlockType.COAL]: { name: 'Węgiel', color: '#222222', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.IRON_INGOT]: { name: 'Sztabka Żelaza', color: '#d8d8d8', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.GOLD_INGOT]: { name: 'Sztabka Złota', color: '#ffd700', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.DIAMOND_GEM]: { name: 'Diament', color: '#44ffee', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.EMERALD]: { name: 'Szmaragd', color: '#22cc44', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.LAPIS]: { name: 'Lapis Lazuli', color: '#2244aa', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.REDSTONE]: { name: 'Redstone', color: '#cc2222', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.STRING]: { name: 'Nić', color: '#eeeeee', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.FEATHER]: { name: 'Pióro', color: '#e8e8e8', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.GUNPOWDER]: { name: 'Proch', color: '#555555', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.WHEAT]: { name: 'Pszenica', color: '#dccfa0', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.FLINT]: { name: 'Krzemień', color: '#444444', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.BRICK_ITEM]: { name: 'Cegła', color: '#9b4a3c', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.CLAY_BALL]: { name: 'Kulka Gliny', color: '#9eaab7', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.PAPER]: { name: 'Papier', color: '#eeeeee', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.BOOK]: { name: 'Książka', color: '#8b6b3e', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.SLIME_BALL]: { name: 'Kula Szlamu', color: '#77cc44', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.GLOWSTONE_DUST]: { name: 'Pył Jasnokamienia', color: '#eedd66', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.SUGAR]: { name: 'Cukier', color: '#eeeeee', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.LEATHER]: { name: 'Skóra', color: '#8b5a2b', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.BONE]: { name: 'Kość', color: '#e8e0d0', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.BONE_MEAL]: { name: 'Mączka Kostna', color: '#e8e0d0', transparent: false, solid: false, breakTime: 0, isItem: true },
    // ─── Dyes ────────────────────────────────────────────
    [BlockType.DYE_RED]: { name: 'Czerwony Barwnik', color: '#cc2222', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.DYE_BLUE]: { name: 'Niebieski Barwnik', color: '#2222cc', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.DYE_GREEN]: { name: 'Zielony Barwnik', color: '#22cc22', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.DYE_YELLOW]: { name: 'Żółty Barwnik', color: '#cccc22', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.DYE_BLACK]: { name: 'Czarny Barwnik', color: '#222222', transparent: false, solid: false, breakTime: 0, isItem: true },
    // ─── Utility Items ──────────────────────────────────
    [BlockType.BUCKET]: { name: 'Wiadro', color: '#aaaaaa', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 16 },
    [BlockType.WATER_BUCKET]: { name: 'Wiadro Wody', color: '#4488cc', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.LAVA_BUCKET]: { name: 'Wiadro Lawy', color: '#cc6622', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.FLINT_AND_STEEL]: { name: 'Krzesiwo', color: '#aaaaaa', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.SHEARS]: { name: 'Nożyce', color: '#aaaaaa', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.BOW]: { name: 'Łuk', color: '#a08050', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1 },
    [BlockType.ARROW]: { name: 'Strzała', color: '#eeeeee', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.COMPASS]: { name: 'Kompas', color: '#cccccc', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.CLOCK]: { name: 'Zegar', color: '#ffd700', transparent: false, solid: false, breakTime: 0, isItem: true },
    // ─── Food ────────────────────────────────────────────
    [BlockType.APPLE]: { name: 'Jabłko', color: '#cc2222', transparent: false, solid: false, breakTime: 0, isItem: true, foodRestore: 4 },
    [BlockType.BREAD]: { name: 'Chleb', color: '#c8a030', transparent: false, solid: false, breakTime: 0, isItem: true, foodRestore: 5 },
    [BlockType.PORKCHOP_RAW]: { name: 'Surowa Wieprzowina', color: '#ee9988', transparent: false, solid: false, breakTime: 0, isItem: true, foodRestore: 3 },
    [BlockType.PORKCHOP_COOKED]: { name: 'Pieczona Wieprzowina', color: '#cc7744', transparent: false, solid: false, breakTime: 0, isItem: true, foodRestore: 8 },
    [BlockType.BEEF_RAW]: { name: 'Surowa Wołowina', color: '#cc6655', transparent: false, solid: false, breakTime: 0, isItem: true, foodRestore: 3 },
    [BlockType.STEAK]: { name: 'Stek', color: '#bb5533', transparent: false, solid: false, breakTime: 0, isItem: true, foodRestore: 8 },
    [BlockType.CHICKEN_RAW]: { name: 'Surowy Kurczak', color: '#ffbbaa', transparent: false, solid: false, breakTime: 0, isItem: true, foodRestore: 2 },
    [BlockType.CHICKEN_COOKED]: { name: 'Pieczony Kurczak', color: '#cc8855', transparent: false, solid: false, breakTime: 0, isItem: true, foodRestore: 6 },
    [BlockType.CARROT]: { name: 'Marchewka', color: '#ee8822', transparent: false, solid: false, breakTime: 0, isItem: true, foodRestore: 3 },
    [BlockType.POTATO]: { name: 'Ziemniak', color: '#ccaa55', transparent: false, solid: false, breakTime: 0, isItem: true, foodRestore: 1 },
    [BlockType.BAKED_POTATO]: { name: 'Pieczony Ziemniak', color: '#bb9944', transparent: false, solid: false, breakTime: 0, isItem: true, foodRestore: 5 },
    [BlockType.GOLDEN_APPLE]: { name: 'Złote Jabłko', color: '#ffd700', transparent: false, solid: false, breakTime: 0, isItem: true, foodRestore: 4 },
    [BlockType.COOKIE]: { name: 'Ciasteczko', color: '#cc8833', transparent: false, solid: false, breakTime: 0, isItem: true, foodRestore: 2 },
    [BlockType.MELON_SLICE]: { name: 'Kawałek Arbuza', color: '#cc3333', transparent: false, solid: false, breakTime: 0, isItem: true, foodRestore: 2 },
    [BlockType.MUSHROOM_STEW]: { name: 'Zupa Grzybowa', color: '#bb6644', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, foodRestore: 6 },
    // ─── Armor ───────────────────────────────────────────
    [BlockType.LEATHER_HELMET]: { name: 'Skórzany Hełm', color: '#8B4513', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.LEATHER_CHESTPLATE]: { name: 'Skórzany Napierśnik', color: '#8B4513', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.LEATHER_LEGGINGS]: { name: 'Skórzane Spodnie', color: '#8B4513', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.LEATHER_BOOTS]: { name: 'Skórzane Buty', color: '#8B4513', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.IRON_HELMET]: { name: 'Żelazny Hełm', color: '#c0c0c0', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.IRON_CHESTPLATE]: { name: 'Żelazny Napierśnik', color: '#c0c0c0', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.IRON_LEGGINGS]: { name: 'Żelazne Spodnie', color: '#c0c0c0', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.IRON_BOOTS]: { name: 'Żelazne Buty', color: '#c0c0c0', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.DIAMOND_HELMET]: { name: 'Diamentowy Hełm', color: '#55ffff', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.DIAMOND_CHESTPLATE]: { name: 'Diamentowy Napierśnik', color: '#55ffff', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.DIAMOND_LEGGINGS]: { name: 'Diamentowe Spodnie', color: '#55ffff', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.DIAMOND_BOOTS]: { name: 'Diamentowe Buty', color: '#55ffff', transparent: false, solid: false, breakTime: 0, isItem: true },
    // ─── Progression Items ───────────────────────────────
    [BlockType.ENDER_PEARL]: { name: 'Perła Endera', color: '#1a7a5e', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.BLAZE_ROD]: { name: 'Pręt Blaze', color: '#ffaa00', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.BLAZE_POWDER]: { name: 'Proszek Blaze', color: '#ffcc00', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.EYE_OF_ENDER]: { name: 'Oko Endera', color: '#00cc77', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.NETHER_STAR]: { name: 'Gwiazda Netheru', color: '#ffffff', transparent: false, solid: false, breakTime: 0, isItem: true },
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
        return d && !d.isItem && id !== BlockType.WATER && id !== BlockType.BEDROCK && id !== BlockType.FURNACE_ON;
    });

/** All item IDs (tools etc.) */
export const ITEM_BLOCKS: number[] = Object.keys(BLOCK_DATA)
    .map(Number)
    .filter((id) => BLOCK_DATA[id]?.isItem);

/** All items (blocks + items) for creative */
export const ALL_ITEMS: number[] = Object.keys(BLOCK_DATA)
    .map(Number)
    .filter((id) => id !== BlockType.AIR && id !== BlockType.WATER && id !== BlockType.BEDROCK && id !== BlockType.FURNACE_ON);

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

/** What a block drops when broken */
export function getBlockDrop(type: number): number {
    switch (type) {
        case BlockType.STONE: return BlockType.COBBLE;
        case BlockType.GRASS: return BlockType.DIRT;
        case BlockType.COAL_ORE: return BlockType.COAL;
        case BlockType.DIAMOND: return BlockType.DIAMOND_GEM;
        case BlockType.EMERALD_ORE: return BlockType.EMERALD;
        case BlockType.LAPIS_ORE: return BlockType.LAPIS;
        case BlockType.REDSTONE_ORE: return BlockType.REDSTONE;
        case BlockType.GLOWSTONE: return BlockType.GLOWSTONE_DUST;
        case BlockType.CLAY: return BlockType.CLAY_BALL;
        case BlockType.MELON: return BlockType.MELON_SLICE;
        case BlockType.LEAVES: return Math.random() < 0.05 ? BlockType.APPLE : (Math.random() < 0.08 ? BlockType.STICK : 0);
        case BlockType.TALL_GRASS: return Math.random() < 0.12 ? BlockType.WHEAT : 0;
        case BlockType.GLASS: return 0;
        case BlockType.GRAVEL: return Math.random() < 0.1 ? BlockType.FLINT : BlockType.GRAVEL;
        // Iron & Gold ore drop themselves (need smelting)
        case BlockType.IRON_ORE: return BlockType.IRON_ORE;
        case BlockType.GOLD_ORE: return BlockType.GOLD_ORE;
        default: return type;
    }
}
