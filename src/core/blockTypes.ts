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
    OAK_SAPLING = 3100, // High ID to avoid conflict

    // The End (Reusing existing IDs)
    // END_STONE, OBSIDIAN etc are already defined below

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
    NETHER_QUARTZ_ORE = 79,
    // ─── Utility Blocks ─────────────────────────────────
    CHEST = 59,
    TRAPDOOR = 60,
    FURNACE_ON = 61,
    LAVA = 62,
    BED = 63,
    BED_HEAD = 119,
    FENCE_OAK = 64,
    DOOR_OAK = 65,
    // ─── Redstone Devices ────────────────────────────────
    LEVER = 66,
    REDSTONE_TORCH = 67,
    REDSTONE_LAMP = 68,
    REDSTONE_WIRE = 69,
    REDSTONE_BLOCK = 70,
    // ─── Nether & End Blocks ────────────────────────────
    END_STONE = 71,
    NETHER_BRICKS = 72,
    SOUL_SAND = 73,
    CRYING_OBSIDIAN = 74,
    END_PORTAL_FRAME = 75,
    DRAGON_EGG = 76,
    NETHER_PORTAL_BLOCK = 77,
    END_PORTAL_BLOCK = 78,
    // ─── Advanced Blocks ────────────────────────────────
    PISTON = 81,
    PISTON_STICKY = 82,
    PISTON_HEAD = 110,
    JUKEBOX = 84,
    SPONGE = 85,
    ENCHANTING_TABLE = 86,
    ENDER_CHEST = 87,
    ANVIL = 88,
    BEACON = 89,
    NOTEBLOCK = 91,
    BUTTON = 92,
    // ─── Farming ────────────────────────────────────────
    FARMLAND = 160,
    WHEAT_0 = 161,
    WHEAT_1 = 162,
    WHEAT_2 = 163,
    WHEAT_3 = 164,
    WHEAT_4 = 165,
    WHEAT_5 = 166,
    WHEAT_6 = 167,
    WHEAT_7 = 168,
    SEEDS = 250,
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

    // ─── 1.17+ Stone & World ────────────────────────────
    GRANITE = 150,
    POLISHED_GRANITE = 151,
    DIORITE = 152,
    POLISHED_DIORITE = 153,
    ANDESITE = 154,
    POLISHED_ANDESITE = 155,
    DEEPSLATE = 156,
    COBBLED_DEEPSLATE = 157,
    POLISHED_DEEP_SLATE = 158,
    DEEPSLATE_BRICKS = 159,
    TUFF = 170,
    CALCITE = 171,
    AMETHYST_BLOCK = 172,
    BUDDING_AMETHYST = 173,
    AMETHYST_CLUSTER = 174,
    TINTED_GLASS = 175,

    // ─── Copper & Raw Ores ──────────────────────────────
    COPPER_ORE = 176,
    DEEPSLATE_COPPER_ORE = 177,
    RAW_COPPER_BLOCK = 178,
    COPPER_BLOCK = 179,
    CUT_COPPER = 180,
    RAW_IRON_BLOCK = 181,
    RAW_GOLD_BLOCK = 182,

    // ─── Nether Expansion ───────────────────────────────
    BLACKSTONE = 183,
    POLISHED_BLACKSTONE = 184,
    BASALT = 185,
    POLISHED_BASALT = 186,
    CRIMSON_STEM = 187,
    WARPED_STEM = 188,
    CRIMSON_PLANKS = 189,
    WARPED_PLANKS = 190,
    NETHER_WART_BLOCK = 191,

    // ─── Materials ───────────────────────────────────────
    COAL = 200,
    IRON_INGOT = 201,
    GOLD_INGOT = 202,
    DIAMOND_GEM = 203,
    EMERALD = 204,
    LAPIS = 205,
    REDSTONE = 206,
    QUARTZ = 227,
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
    GOLD_HELMET = 414,
    GOLD_CHESTPLATE = 415,
    GOLD_LEGGINGS = 416,
    GOLD_BOOTS = 417,
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
    // ─── Modern Items ───────────────────────────────────
    RAW_IRON = 510,
    RAW_GOLD = 511,
    RAW_COPPER = 512,
    AMETHYST_SHARD = 513,
    COPPER_INGOT = 514,

    // ─── Netherite & Advanced Materials ──────────────────
    ANCIENT_DEBRIS = 520,
    NETHERITE_BLOCK = 521,
    GILDED_BLACKSTONE = 522,
    CHISELED_POLISHED_BLACKSTONE = 523,
    SOUL_TORCH = 524,
    LANTERN = 525,
    SOUL_LANTERN = 526,
    CHAIN = 527,

    // ─── New Wood & Mud ──────────────────────────────────
    MUD = 530,
    MUD_BRICKS = 531,
    CHERRY_LOG = 532,
    CHERRY_PLANKS = 533,
    CHERRY_LEAVES = 534,
    MANGROVE_LOG = 535,
    MANGROVE_PLANKS = 536,
    MANGROVE_LEAVES = 537,

    // ─── Netherite Items ─────────────────────────────────
    NETHERITE_SCRAP = 439, // Changed ID
    NETHERITE_INGOT = 440,
    NETHERITE_PICKAXE = 441,
    NETHERITE_AXE = 442,
    NETHERITE_SHOVEL = 443,
    NETHERITE_SWORD = 444,
    NETHERITE_HOE = 445,
    NETHERITE_HELMET = 446,
    NETHERITE_CHESTPLATE = 447,
    NETHERITE_LEGGINGS = 448,
    NETHERITE_BOOTS = 449,
    MUSIC_DISC_1 = 505,
    MUSIC_DISC_2 = 506,
    MUSIC_DISC_3 = 508,
    MUSIC_DISC_4 = 509,
    JUKEBOX_PLAYING = 507, // Changed ID

    // ─── Deep Dark & Lush ──────────────────────────────
    SCULK = 700,
    SCULK_SENSOR = 701,
    SCULK_CATALYST = 702,
    SCULK_SHRIEKER = 703,
    SCULK_VEIN = 704,
    MOSS_BLOCK = 710,
    MOSS_CARPET = 711,
    AZALEA = 712,
    FLOWERING_AZALEA = 713,
    SPORE_BLOSSOM = 714,
    DRIPSTONE_BLOCK = 720,
    POINTED_DRIPSTONE = 721,
    REINFORCED_DEEPSLATE = 722,
    // ─── Froglights & Sea ──────────────────────────────
    OCHRE_FROGLIGHT = 740,
    VERDANT_FROGLIGHT = 741,
    PEARLESCENT_FROGLIGHT = 742,
    SEA_LANTERN = 743,
    // ─── Tiles & Construction ──────────────────────────
    DEEPSLATE_TILES = 750,
    CHISELED_DEEPSLATE = 751,
    END_STONE_BRICKS = 752,

    // ─── Quartz & Bamboo ───────────────────────────────
    QUARTZ_BLOCK = 760,
    SMOOTH_QUARTZ = 761,
    QUARTZ_BRICKS = 762,
    CHISELED_QUARTZ = 763,
    BAMBOO_BLOCK = 770,
    BAMBOO_PLANKS = 771,
    BAMBOO_MOSAIC = 772,
    END_CRYSTAL = 800,
    DRAGON_BREATH = 801,
    TOTEM_OF_UNDYING = 802,
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
    readonly tool?: 'pickaxe' | 'axe' | 'shovel' | 'hoe' | 'sword' | 'hand';
    readonly isItem?: boolean;     // not a placeable block, just an item
    readonly stackSize?: number;   // max per stack (default 64)
    readonly light?: number;       // emits light 0-15
    readonly foodRestore?: number; // hunger points restored
    readonly armorPoints?: number; // armor points provided
    readonly emissive?: boolean;   // emits light (visual glow)
    readonly maxDurability?: number; // amount of uses before tool breaks
    readonly toolPower?: number; // tool power for breaking blocks
    readonly isMusicDisc?: boolean; // if the item is a music disc
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
    [BlockType.NETHER_QUARTZ_ORE]: { name: 'Ruda Kwarcu', color: '#6a2020', ore: '#f0ece4', transparent: false, solid: true, breakTime: 2.0, tool: 'pickaxe' },
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
    [BlockType.TRAPDOOR]: { name: 'Klapa', color: '#806030', transparent: true, solid: true, breakTime: 3.0, tool: 'axe' },
    [BlockType.LAVA]: { name: 'Lawa', color: '#cc6622', transparent: true, solid: false, breakTime: 999, light: 15 },
    [BlockType.BED]: { name: 'Łóżko (Dół)', color: '#cc2222', top: '#cc2222', transparent: true, solid: true, breakTime: 0.2 },
    [BlockType.BED_HEAD]: { name: 'Łóżko (Góra)', color: '#cc2222', top: '#eeeeee', transparent: true, solid: true, breakTime: 0.2 },
    [BlockType.FENCE_OAK]: { name: 'Płot Dębowy', color: '#b8945f', transparent: true, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.DOOR_OAK]: { name: 'Drzwi Dębowe', color: '#b8945f', transparent: true, solid: true, breakTime: 3.0, tool: 'axe' },
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
    [BlockType.WOODEN_PICKAXE]: { name: 'Drewniany Kilof', color: '#b8945f', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 59 },
    [BlockType.WOODEN_AXE]: { name: 'Drewniana Siekiera', color: '#b8945f', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 59 },
    [BlockType.WOODEN_SHOVEL]: { name: 'Drewniana Łopata', color: '#b8945f', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 59 },
    [BlockType.WOODEN_SWORD]: { name: 'Drewniany Miecz', color: '#b8945f', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 59 },
    [BlockType.WOODEN_HOE]: { name: 'Drewniana Motyka', color: '#b8945f', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 59 },
    // ─── Stone Tools ────────────────────────────────────
    [BlockType.STONE_PICKAXE]: { name: 'Kamienny Kilof', color: '#888888', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 131 },
    [BlockType.STONE_AXE]: { name: 'Kamienna Siekiera', color: '#888888', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 131 },
    [BlockType.STONE_SHOVEL]: { name: 'Kamienna Łopata', color: '#888888', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 131 },
    [BlockType.STONE_SWORD]: { name: 'Kamienny Miecz', color: '#888888', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 131 },
    [BlockType.STONE_HOE]: { name: 'Kamienna Motyka', color: '#888888', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 131 },
    // ─── Iron Tools ─────────────────────────────────────
    [BlockType.IRON_PICKAXE]: { name: 'Żelazny Kilof', color: '#d8d8d8', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 250 },
    [BlockType.IRON_AXE]: { name: 'Żelazna Siekiera', color: '#d8d8d8', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 250 },
    [BlockType.IRON_SHOVEL]: { name: 'Żelazna Łopata', color: '#d8d8d8', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 250 },
    [BlockType.IRON_SWORD]: { name: 'Żelazny Miecz', color: '#d8d8d8', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 250 },
    [BlockType.IRON_HOE]: { name: 'Żelazna Motyka', color: '#d8d8d8', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 250 },
    // ─── Gold Tools ─────────────────────────────────────
    [BlockType.GOLD_PICKAXE]: { name: 'Złoty Kilof', color: '#ffd700', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 32 },
    [BlockType.GOLD_AXE]: { name: 'Złota Siekiera', color: '#ffd700', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 32 },
    [BlockType.GOLD_SHOVEL]: { name: 'Złota Łopata', color: '#ffd700', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 32 },
    [BlockType.GOLD_SWORD]: { name: 'Złoty Miecz', color: '#ffd700', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 32 },
    [BlockType.GOLD_HOE]: { name: 'Złota Motyka', color: '#ffd700', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 32 },
    // ─── Diamond Tools ──────────────────────────────────
    [BlockType.DIAMOND_PICKAXE]: { name: 'Diamentowy Kilof', color: '#44ffee', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 1561 },
    [BlockType.DIAMOND_AXE]: { name: 'Diamentowa Siekiera', color: '#44ffee', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 1561 },
    [BlockType.DIAMOND_SHOVEL]: { name: 'Diamentowa Łopata', color: '#44ffee', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 1561 },
    [BlockType.DIAMOND_SWORD]: { name: 'Diamentowy Miecz', color: '#44ffee', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 1561 },
    [BlockType.DIAMOND_HOE]: { name: 'Diamentowa Motyka', color: '#44ffee', transparent: false, solid: false, breakTime: 0, isItem: true, stackSize: 1, maxDurability: 1561 },
    // ─── Materials ───────────────────────────────────────
    [BlockType.COAL]: { name: 'Węgiel', color: '#222222', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.IRON_INGOT]: { name: 'Sztabka Żelaza', color: '#d8d8d8', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.GOLD_INGOT]: { name: 'Sztabka Złota', color: '#ffd700', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.DIAMOND_GEM]: { name: 'Diament', color: '#44ffee', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.EMERALD]: { name: 'Szmaragd', color: '#22cc44', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.LAPIS]: { name: 'Lapis Lazuli', color: '#2244aa', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.REDSTONE]: { name: 'Redstone', color: '#cc2222', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.QUARTZ]: { name: 'Kwarc', color: '#f0ece4', transparent: false, solid: false, breakTime: 0, isItem: true },
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
    // ─── Farming ────────────────────────────────────────
    [BlockType.FARMLAND]: { name: 'Ziemia Uprawna', color: '#6b4226', top: '#4b3216', transparent: false, solid: true, breakTime: 0.6, tool: 'shovel' },
    [BlockType.SEEDS]: { name: 'Nasiona', color: '#88cc44', transparent: false, solid: false, breakTime: 0, isItem: true },

    [BlockType.WHEAT_0]: { name: 'Pszenica (etap 0)', color: '#00cc00', transparent: true, solid: false, breakTime: 0 },
    [BlockType.WHEAT_1]: { name: 'Pszenica (etap 1)', color: '#22cc00', transparent: true, solid: false, breakTime: 0 },
    [BlockType.WHEAT_2]: { name: 'Pszenica (etap 2)', color: '#44cc00', transparent: true, solid: false, breakTime: 0 },
    [BlockType.WHEAT_3]: { name: 'Pszenica (etap 3)', color: '#66cc00', transparent: true, solid: false, breakTime: 0 },
    [BlockType.WHEAT_4]: { name: 'Pszenica (etap 4)', color: '#88cc00', transparent: true, solid: false, breakTime: 0 },
    [BlockType.WHEAT_5]: { name: 'Pszenica (etap 5)', color: '#aacc00', transparent: true, solid: false, breakTime: 0 },
    [BlockType.WHEAT_6]: { name: 'Pszenica (etap 6)', color: '#cccc00', transparent: true, solid: false, breakTime: 0 },
    [BlockType.WHEAT_7]: { name: 'Pszenica (gotowa)', color: '#dccfa0', transparent: true, solid: false, breakTime: 0 },
    // ─── Armor ───────────────────────────────────────────
    [BlockType.LEATHER_HELMET]: { name: 'Skórzany Hełm', color: '#8B4513', transparent: false, solid: false, breakTime: 0, isItem: true, armorPoints: 1, maxDurability: 55 },
    [BlockType.LEATHER_CHESTPLATE]: { name: 'Skórzany Napierśnik', color: '#8B4513', transparent: false, solid: false, breakTime: 0, isItem: true, armorPoints: 3, maxDurability: 80 },
    [BlockType.LEATHER_LEGGINGS]: { name: 'Skórzane Spodnie', color: '#8B4513', transparent: false, solid: false, breakTime: 0, isItem: true, armorPoints: 2, maxDurability: 75 },
    [BlockType.LEATHER_BOOTS]: { name: 'Skórzane Buty', color: '#8B4513', transparent: false, solid: false, breakTime: 0, isItem: true, armorPoints: 1, maxDurability: 65 },
    [BlockType.IRON_HELMET]: { name: 'Żelazny Hełm', color: '#c0c0c0', transparent: false, solid: false, breakTime: 0, isItem: true, armorPoints: 2, maxDurability: 165 },
    [BlockType.IRON_CHESTPLATE]: { name: 'Żelazny Napierśnik', color: '#c0c0c0', transparent: false, solid: false, breakTime: 0, isItem: true, armorPoints: 6, maxDurability: 240 },
    [BlockType.IRON_LEGGINGS]: { name: 'Żelazne Spodnie', color: '#c0c0c0', transparent: false, solid: false, breakTime: 0, isItem: true, armorPoints: 5, maxDurability: 225 },
    [BlockType.IRON_BOOTS]: { name: 'Żelazne Buty', color: '#c0c0c0', transparent: false, solid: false, breakTime: 0, isItem: true, armorPoints: 2, maxDurability: 195 },
    [BlockType.GOLD_HELMET]: { name: 'Złoty Hełm', color: '#ffd700', transparent: false, solid: false, breakTime: 0, isItem: true, armorPoints: 2, maxDurability: 77 },
    [BlockType.GOLD_CHESTPLATE]: { name: 'Złoty Napierśnik', color: '#ffd700', transparent: false, solid: false, breakTime: 0, isItem: true, armorPoints: 5, maxDurability: 112 },
    [BlockType.GOLD_LEGGINGS]: { name: 'Złote Spodnie', color: '#ffd700', transparent: false, solid: false, breakTime: 0, isItem: true, armorPoints: 3, maxDurability: 105 },
    [BlockType.GOLD_BOOTS]: { name: 'Złote Buty', color: '#ffd700', transparent: false, solid: false, breakTime: 0, isItem: true, armorPoints: 1, maxDurability: 91 },
    [BlockType.DIAMOND_HELMET]: { name: 'Diamentowy Hełm', color: '#55ffff', transparent: false, solid: false, breakTime: 0, isItem: true, armorPoints: 3, maxDurability: 363 },
    [BlockType.DIAMOND_CHESTPLATE]: { name: 'Diamentowy Napierśnik', color: '#55ffff', transparent: false, solid: false, breakTime: 0, isItem: true, armorPoints: 8, maxDurability: 528 },
    [BlockType.DIAMOND_LEGGINGS]: { name: 'Diamentowe Spodnie', color: '#55ffff', transparent: false, solid: false, breakTime: 0, isItem: true, armorPoints: 6, maxDurability: 495 },
    [BlockType.DIAMOND_BOOTS]: { name: 'Diamentowe Buty', color: '#55ffff', transparent: false, solid: false, breakTime: 0, isItem: true, armorPoints: 3, maxDurability: 429 },
    // ─── Progression Items ───────────────────────────────
    [BlockType.ENDER_PEARL]: { name: 'Perła Endera', color: '#1a7a5e', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.BLAZE_ROD]: { name: 'Pręt Blaze', color: '#ffaa00', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.BLAZE_POWDER]: { name: 'Proszek Blaze', color: '#ffcc00', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.EYE_OF_ENDER]: { name: 'Oko Endera', color: '#00cc77', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.NETHER_STAR]: { name: 'Gwiazda Netheru', color: '#ffffff', transparent: false, solid: false, breakTime: 0, isItem: true },
    // ─── Vegetation ──────────────────────────────────────
    [BlockType.OAK_SAPLING]: { name: 'Sadzonka Dębu', color: '#4a8c30', transparent: true, solid: false, breakTime: 0.0 },


    // The End blocks are defined below

    // ─── Redstone Devices ────────────────────────────────
    [BlockType.LEVER]: { name: 'Dźwignia', color: '#8b7355', top: '#666666', transparent: true, solid: false, breakTime: 0.3, tool: 'hand' },
    [BlockType.REDSTONE_TORCH]: { name: 'Pochodnia Redstone', color: '#cc0000', transparent: true, solid: false, breakTime: 0, tool: 'hand', emissive: true },
    [BlockType.REDSTONE_LAMP]: { name: 'Lampa Redstone', color: '#8b6914', top: '#aa8833', transparent: false, solid: true, breakTime: 0.3, tool: 'pickaxe' },
    [BlockType.REDSTONE_WIRE]: { name: 'Czerwony Proszek', color: '#cc2222', transparent: true, solid: false, breakTime: 0 },
    [BlockType.REDSTONE_BLOCK]: { name: 'Blok Redstone', color: '#ee1111', transparent: false, solid: true, breakTime: 1.0, tool: 'pickaxe' },
    [BlockType.BUTTON]: { name: 'Przycisk', color: '#888888', transparent: true, solid: false, breakTime: 0.1 },
    // ─── Nether & End Blocks ────────────────────────────
    [BlockType.END_STONE]: { name: 'Kamień Endu', color: '#e8e8aa', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.NETHER_BRICKS]: { name: 'Cegły Netheru', color: '#44222a', transparent: false, solid: true, breakTime: 2.0, tool: 'pickaxe' },
    [BlockType.SOUL_SAND]: { name: 'Piasek Dusz', color: '#5b4538', transparent: false, solid: true, breakTime: 0.5, tool: 'shovel' },
    [BlockType.CRYING_OBSIDIAN]: { name: 'Płaczący Obsydian', color: '#32006b', transparent: false, solid: true, breakTime: 50, tool: 'pickaxe', emissive: true },
    [BlockType.END_PORTAL_FRAME]: { name: 'Rama Portalu Endu', color: '#3b6b4b', top: '#1a4a4a', transparent: false, solid: true, breakTime: 999 },
    [BlockType.DRAGON_EGG]: { name: 'Smocze Jajo', color: '#0d0016', transparent: true, solid: true, breakTime: 3.0 },
    [BlockType.NETHER_PORTAL_BLOCK]: { name: 'Portal Netheru', color: '#7b0099', transparent: true, solid: false, breakTime: 999, emissive: true },
    [BlockType.END_PORTAL_BLOCK]: { name: 'Portal Endu', color: '#001122', transparent: true, solid: false, breakTime: 999, emissive: true },
    // ─── Advanced Blocks ────────────────────────────────
    [BlockType.PISTON]: { name: 'Tłok', color: '#8b7355', top: '#998877', transparent: false, solid: true, breakTime: 0.5 },
    [BlockType.PISTON_STICKY]: { name: 'Lepki Tłok', color: '#8b7355', top: '#66aa44', transparent: false, solid: true, breakTime: 0.5 },
    [BlockType.PISTON_HEAD]: { name: 'Głowica Tłoka', color: '#998877', top: '#998877', transparent: false, solid: true, breakTime: 0.5 },
    [BlockType.JUKEBOX]: { name: 'Szafa Grająca', color: '#6b4226', top: '#8b6240', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.SPONGE]: { name: 'Gąbka', color: '#c2b74e', transparent: false, solid: true, breakTime: 0.6 },
    [BlockType.ENCHANTING_TABLE]: { name: 'Stół Zaklęć', color: '#2b0000', top: '#cc0000', transparent: true, solid: true, breakTime: 5.0, tool: 'pickaxe' },
    [BlockType.ENDER_CHEST]: { name: 'Skrzynia Endera', color: '#0d1117', transparent: false, solid: true, breakTime: 22.5, tool: 'pickaxe' },
    [BlockType.ANVIL]: { name: 'Kowadło', color: '#444444', top: '#555555', transparent: true, solid: true, breakTime: 5.0, tool: 'pickaxe' },
    [BlockType.BEACON]: { name: 'Latarnia', color: '#7ae9e9', transparent: true, solid: true, breakTime: 3.0, emissive: true, light: 15 },
    [BlockType.NOTEBLOCK]: { name: 'Blok Nutowy', color: '#6b4226', top: '#8b5a2b', transparent: false, solid: true, breakTime: 0.8, tool: 'axe' },

    // ─── 1.17+ Stone & World ────────────────────────────
    [BlockType.GRANITE]: { name: 'Granit', color: '#b27464', transparent: false, solid: true, breakTime: 1.5, tool: 'pickaxe' },
    [BlockType.POLISHED_GRANITE]: { name: 'Gładki Granit', color: '#b27464', transparent: false, solid: true, breakTime: 1.5, tool: 'pickaxe' },
    [BlockType.DIORITE]: { name: 'Dioryt', color: '#cfcfcf', transparent: false, solid: true, breakTime: 1.5, tool: 'pickaxe' },
    [BlockType.POLISHED_DIORITE]: { name: 'Gładki Dioryt', color: '#cfcfcf', transparent: false, solid: true, breakTime: 1.5, tool: 'pickaxe' },
    [BlockType.ANDESITE]: { name: 'Andezyt', color: '#8b8b8b', transparent: false, solid: true, breakTime: 1.5, tool: 'pickaxe' },
    [BlockType.POLISHED_ANDESITE]: { name: 'Gładki Andezyt', color: '#8b8b8b', transparent: false, solid: true, breakTime: 1.5, tool: 'pickaxe' },
    [BlockType.DEEPSLATE]: { name: 'Łupek', color: '#4d4d50', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.COBBLED_DEEPSLATE]: { name: 'Bruk Łupkowy', color: '#4d4d50', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.POLISHED_DEEP_SLATE]: { name: 'Gładki Łupek', color: '#4d4d50', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.DEEPSLATE_BRICKS]: { name: 'Cegły Łupkowe', color: '#4d4d50', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.TUFF]: { name: 'Tuf', color: '#6d6d6e', transparent: false, solid: true, breakTime: 1.5, tool: 'pickaxe' },
    [BlockType.CALCITE]: { name: 'Kalcyt', color: '#e3e3e3', transparent: false, solid: true, breakTime: 0.75, tool: 'pickaxe' },
    [BlockType.AMETHYST_BLOCK]: { name: 'Blok Amethystu', color: '#9a5cc6', transparent: false, solid: true, breakTime: 1.5, tool: 'pickaxe' },
    [BlockType.BUDDING_AMETHYST]: { name: 'Pączkujący Amethyst', color: '#9a5cc6', transparent: false, solid: true, breakTime: 1.5, tool: 'pickaxe' },
    [BlockType.AMETHYST_CLUSTER]: { name: 'Gromada Amethystu', color: '#9a5cc6', transparent: true, solid: false, breakTime: 1.5, tool: 'pickaxe' },
    [BlockType.TINTED_GLASS]: { name: 'Przyciemniane Szkło', color: '#332345', transparent: true, solid: true, breakTime: 0.3 },

    // ─── Copper & Raw Ores ──────────────────────────────
    [BlockType.COPPER_ORE]: { name: 'Ruda Miedzi', color: '#888888', ore: '#d1725b', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.DEEPSLATE_COPPER_ORE]: { name: 'Głęboka Ruda Miedzi', color: '#4d4d50', ore: '#d1725b', transparent: false, solid: true, breakTime: 4.5, tool: 'pickaxe' },
    [BlockType.RAW_COPPER_BLOCK]: { name: 'Blok Surowej Miedzi', color: '#d1725b', transparent: false, solid: true, breakTime: 5.0, tool: 'pickaxe' },
    [BlockType.COPPER_BLOCK]: { name: 'Blok Miedzi', color: '#d1725b', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.CUT_COPPER]: { name: 'Wycinana Miedź', color: '#d1725b', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.RAW_IRON_BLOCK]: { name: 'Blok Surowego Żelaza', color: '#d8af93', transparent: false, solid: true, breakTime: 5.0, tool: 'pickaxe' },
    [BlockType.RAW_GOLD_BLOCK]: { name: 'Blok Surowego Złota', color: '#f0d12d', transparent: false, solid: true, breakTime: 5.0, tool: 'pickaxe' },

    // ─── Nether Expansion ───────────────────────────────
    [BlockType.BLACKSTONE]: { name: 'Czernit', color: '#272223', transparent: false, solid: true, breakTime: 1.5, tool: 'pickaxe' },
    [BlockType.POLISHED_BLACKSTONE]: { name: 'Gładki Czernit', color: '#272223', transparent: false, solid: true, breakTime: 1.5, tool: 'pickaxe' },
    [BlockType.BASALT]: { name: 'Bazalt', color: '#505151', top: '#3f3f40', transparent: false, solid: true, breakTime: 1.25, tool: 'pickaxe' },
    [BlockType.POLISHED_BASALT]: { name: 'Gładki Bazalt', color: '#505151', top: '#3f3f40', transparent: false, solid: true, breakTime: 1.25, tool: 'pickaxe' },
    [BlockType.CRIMSON_STEM]: { name: 'Szkarłatny Trzon', color: '#5a191d', top: '#5a191d', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.WARPED_STEM]: { name: 'Wypaczony Trzon', color: '#3a8e8c', top: '#3a8e8c', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.CRIMSON_PLANKS]: { name: 'Szkarłatne Deski', color: '#7a2d48', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.WARPED_PLANKS]: { name: 'Wypaczone Deski', color: '#3a8e8c', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.NETHER_WART_BLOCK]: { name: 'Blok Brodawek', color: '#730b0b', transparent: false, solid: true, breakTime: 1.0, tool: 'axe' },

    // ─── Modern Items ───────────────────────────────────
    [BlockType.RAW_IRON]: { name: 'Surowe Żelazo', color: '#d8af93', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.RAW_GOLD]: { name: 'Surowe Złoto', color: '#f0d12d', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.RAW_COPPER]: { name: 'Surowa Miedź', color: '#d1725b', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.AMETHYST_SHARD]: { name: 'Odłamek Amethystu', color: '#9a5cc6', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.COPPER_INGOT]: { name: 'Sztabka Miedzi', color: '#d1725b', transparent: false, solid: false, breakTime: 0, isItem: true },

    // ─── Netherite & Advanced ──────────────────────────
    [BlockType.ANCIENT_DEBRIS]: { name: 'Starożytne Zgliszcza', color: '#4d3b3b', top: '#5d4b4b', transparent: false, solid: true, breakTime: 30.0, tool: 'pickaxe' },
    [BlockType.NETHERITE_BLOCK]: { name: 'Blok Netheritu', color: '#312e2e', transparent: false, solid: true, breakTime: 50.0, tool: 'pickaxe' },
    [BlockType.GILDED_BLACKSTONE]: { name: 'Pozłacany Czernit', color: '#272223', ore: '#ffd700', transparent: false, solid: true, breakTime: 1.5, tool: 'pickaxe' },
    [BlockType.CHISELED_POLISHED_BLACKSTONE]: { name: 'Rzeźbiony Czernit', color: '#272223', transparent: false, solid: true, breakTime: 1.5, tool: 'pickaxe' },
    [BlockType.SOUL_TORCH]: { name: 'Pochodnia Dusz', color: '#00ccff', transparent: true, solid: false, breakTime: 0, light: 10, emissive: true },
    [BlockType.LANTERN]: { name: 'Latarnia', color: '#ffcc00', transparent: true, solid: false, breakTime: 0.2, light: 15, emissive: true },
    [BlockType.SOUL_LANTERN]: { name: 'Latarnia Dusz', color: '#00ccff', transparent: true, solid: false, breakTime: 0.2, light: 10, emissive: true },
    [BlockType.CHAIN]: { name: 'Łańcuch', color: '#444444', transparent: true, solid: false, breakTime: 0.1, tool: 'pickaxe' },

    // ─── New Wood & Mud ───────────────────────────────
    [BlockType.MUD]: { name: 'Błoto', color: '#3d342d', transparent: false, solid: true, breakTime: 0.5, tool: 'shovel' },
    [BlockType.MUD_BRICKS]: { name: 'Cegły Błotne', color: '#4d453d', transparent: false, solid: true, breakTime: 0.8, tool: 'pickaxe' },
    [BlockType.CHERRY_LOG]: { name: 'Wiśniowy Pień', color: '#4d3b3b', top: '#ee99aa', bottom: '#ee99aa', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.CHERRY_PLANKS]: { name: 'Wiśniowe Deski', color: '#eab0be', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.CHERRY_LEAVES]: { name: 'Liście Wiśni', color: '#ee99aa', transparent: true, solid: true, breakTime: 0.2 },
    [BlockType.MANGROVE_LOG]: { name: 'Namorzynowy Pień', color: '#4a3d34', top: '#7a2d48', bottom: '#7a2d48', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.MANGROVE_PLANKS]: { name: 'Namorzynowe Deski', color: '#7a2d48', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.MANGROVE_LEAVES]: { name: 'Liście Namorzynu', color: '#3b5a22', transparent: true, solid: true, breakTime: 0.2 },

    // ─── Food Fixes ──────────────────────────────────
    [BlockType.CAKE]: { name: 'Ciasto', color: '#ffffff', top: '#cc2222', transparent: true, solid: true, breakTime: 0.1, foodRestore: 14 },

    // ─── Netherite Items ──────────────────────────────
    [BlockType.NETHERITE_SCRAP]: { name: 'Odłamek Netheritu', color: '#4d3b3b', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.NETHERITE_INGOT]: { name: 'Sztabka Netheritu', color: '#312e2e', transparent: false, solid: false, breakTime: 0, isItem: true },
    [BlockType.NETHERITE_PICKAXE]: { name: 'Netheritowy Kilof', color: '#312e2e', transparent: false, solid: false, breakTime: 0, isItem: true, toolPower: 6, maxDurability: 2031 },
    [BlockType.NETHERITE_AXE]: { name: 'Netheritowa Siekiera', color: '#312e2e', transparent: false, solid: false, breakTime: 0, isItem: true, toolPower: 6, maxDurability: 2031 },
    [BlockType.NETHERITE_SHOVEL]: { name: 'Netheritowa Łopata', color: '#312e2e', transparent: false, solid: false, breakTime: 0, isItem: true, toolPower: 6, maxDurability: 2031 },
    [BlockType.NETHERITE_SWORD]: { name: 'Netheritowy Miecz', color: '#312e2e', transparent: false, solid: false, breakTime: 0, isItem: true, toolPower: 6, maxDurability: 2031 },
    [BlockType.NETHERITE_HOE]: { name: 'Netheritowa Motyka', color: '#312e2e', transparent: false, solid: false, breakTime: 0, isItem: true, toolPower: 6, maxDurability: 2031 },
    [BlockType.NETHERITE_HELMET]: { name: 'Netheritowy Hełm', color: '#312e2e', transparent: false, solid: false, breakTime: 0, isItem: true, armorPoints: 3, maxDurability: 407 },
    [BlockType.NETHERITE_CHESTPLATE]: { name: 'Netheritowy Napierśnik', color: '#312e2e', transparent: false, solid: false, breakTime: 0, isItem: true, armorPoints: 8, maxDurability: 592 },
    [BlockType.NETHERITE_LEGGINGS]: { name: 'Netheritowe Spodnie', color: '#312e2e', transparent: false, solid: false, breakTime: 0, isItem: true, armorPoints: 6, maxDurability: 555 },
    [BlockType.NETHERITE_BOOTS]: { name: 'Netheritowe Buty', color: '#312e2e', transparent: false, solid: false, breakTime: 0, isItem: true, armorPoints: 3, maxDurability: 481 },
    [BlockType.MUSIC_DISC_1]: { name: 'Płyta Muzyczna (Muzo)', color: '#1db954', transparent: false, solid: false, breakTime: 0, isItem: true, isMusicDisc: true },
    [BlockType.MUSIC_DISC_2]: { name: 'Płyta Muzyczna (Retro)', color: '#ff5555', transparent: false, solid: false, breakTime: 0, isItem: true, isMusicDisc: true },
    [BlockType.MUSIC_DISC_3]: { name: 'Płyta Muzyczna (Creepy)', color: '#60a5fa', transparent: false, solid: false, breakTime: 0, isItem: true, isMusicDisc: true },
    [BlockType.MUSIC_DISC_4]: { name: 'Płyta Muzyczna (Chill)', color: '#fbbf24', transparent: false, solid: false, breakTime: 0, isItem: true, isMusicDisc: true },
    [BlockType.JUKEBOX_PLAYING]: { name: 'Szafa grająca (gra)', color: '#4d3b3b', transparent: false, solid: true, breakTime: 0.8, tool: 'axe' },

    // ─── Deep Dark ──────────────────────────────────────
    [BlockType.SCULK]: { name: 'Szkulk', color: '#0b1d21', transparent: false, solid: true, breakTime: 0.6, tool: 'hoe' },
    [BlockType.SCULK_SENSOR]: { name: 'Czujnik Szkulkowy', color: '#0b1d21', top: '#00ccff', transparent: true, solid: true, breakTime: 1.5, tool: 'hoe', light: 1 },
    [BlockType.SCULK_CATALYST]: { name: 'Katalizator Szkulkowy', color: '#0b1d21', top: '#00ccff', transparent: false, solid: true, breakTime: 3.0, tool: 'hoe', light: 6 },
    [BlockType.SCULK_SHRIEKER]: { name: 'Wrzeszczak Szkulkowy', color: '#0b1d21', top: '#ffffff', transparent: true, solid: true, breakTime: 3.0, tool: 'hoe' },
    [BlockType.SCULK_VEIN]: { name: 'Żyła Szkulkowa', color: '#0b1d21', transparent: true, solid: false, breakTime: 0.2, tool: 'hoe' },

    // ─── Lush Caves ────────────────────────────────────
    [BlockType.MOSS_BLOCK]: { name: 'Blok Mchu', color: '#597d30', transparent: false, solid: true, breakTime: 0.1, tool: 'hoe' },
    [BlockType.MOSS_CARPET]: { name: 'Dywan z Mchu', color: '#597d30', transparent: true, solid: false, breakTime: 0.1 },
    [BlockType.AZALEA]: { name: 'Azalia', color: '#597d30', top: '#70922d', transparent: true, solid: false, breakTime: 0.0 },
    [BlockType.FLOWERING_AZALEA]: { name: 'Kwitnąca Azalia', color: '#597d30', top: '#ff99cc', transparent: true, solid: false, breakTime: 0.0 },
    [BlockType.SPORE_BLOSSOM]: { name: 'Zarodnikowiec', color: '#ffb3cc', transparent: true, solid: false, breakTime: 0.0 },
    [BlockType.DRIPSTONE_BLOCK]: { name: 'Blok Naciekowiec', color: '#846752', transparent: false, solid: true, breakTime: 1.5, tool: 'pickaxe' },
    [BlockType.POINTED_DRIPSTONE]: { name: 'Naciek', color: '#846752', transparent: true, solid: false, breakTime: 0.1, tool: 'pickaxe' },
    [BlockType.REINFORCED_DEEPSLATE]: { name: 'Wzmocniony Łupek', color: '#4d4d50', transparent: false, solid: true, breakTime: 999, tool: 'pickaxe' },

    // ─── Froglights & Sea ──────────────────────────────
    [BlockType.OCHRE_FROGLIGHT]: { name: 'Żabi Blask (Ochra)', color: '#f7e39c', transparent: false, solid: true, breakTime: 0.3, light: 15, emissive: true },
    [BlockType.VERDANT_FROGLIGHT]: { name: 'Żabi Blask (Zieleń)', color: '#e3f79c', transparent: false, solid: true, breakTime: 0.3, light: 15, emissive: true },
    [BlockType.PEARLESCENT_FROGLIGHT]: { name: 'Żabi Blask (Perła)', color: '#f79ce3', transparent: false, solid: true, breakTime: 0.3, light: 15, emissive: true },
    [BlockType.SEA_LANTERN]: { name: 'Morska Latarnia', color: '#b3d1d1', transparent: false, solid: true, breakTime: 0.3, light: 15, emissive: true },

    // ─── Construction ──────────────────────────────────
    [BlockType.DEEPSLATE_TILES]: { name: 'Płytki Łupkowe', color: '#3d3d40', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.CHISELED_DEEPSLATE]: { name: 'Rzeźbiony Łupek', color: '#3d3d40', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },
    [BlockType.END_STONE_BRICKS]: { name: 'Cegły Endu', color: '#e8e8aa', transparent: false, solid: true, breakTime: 3.0, tool: 'pickaxe' },

    // ─── Quartz & Bamboo ───────────────────────────────
    [BlockType.QUARTZ_BLOCK]: { name: 'Blok Kwarcu', color: '#f0ece4', transparent: false, solid: true, breakTime: 0.8, tool: 'pickaxe' },
    [BlockType.SMOOTH_QUARTZ]: { name: 'Gładki Kwarc', color: '#f0ece4', transparent: false, solid: true, breakTime: 0.8, tool: 'pickaxe' },
    [BlockType.QUARTZ_BRICKS]: { name: 'Cegły Kwarcowe', color: '#f0ece4', transparent: false, solid: true, breakTime: 0.8, tool: 'pickaxe' },
    [BlockType.CHISELED_QUARTZ]: { name: 'Rzeźbiony Kwarc', color: '#f0ece4', top: '#e0dcd4', transparent: false, solid: true, breakTime: 0.8, tool: 'pickaxe' },
    [BlockType.BAMBOO_BLOCK]: { name: 'Blok Bambusa', color: '#597d30', top: '#70922d', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.BAMBOO_PLANKS]: { name: 'Bambusowe Deski', color: '#978c4a', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.BAMBOO_MOSAIC]: { name: 'Mozaika Bambusowa', color: '#978c4a', transparent: false, solid: true, breakTime: 2.0, tool: 'axe' },
    [BlockType.END_CRYSTAL]: { name: 'Kryształ Endu', color: '#ff55ff', transparent: true, solid: false, breakTime: 0, isItem: true },
    [BlockType.DRAGON_BREATH]: { name: 'Smoczy Oddech', color: '#ff33ff', transparent: true, solid: false, breakTime: 0, isItem: true },
    [BlockType.TOTEM_OF_UNDYING]: { name: 'Totem Nieśmiertelności', color: '#ffff55', transparent: true, solid: false, breakTime: 0, isItem: true },
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
        return d && !d.isItem && id !== BlockType.WATER && id !== BlockType.LAVA && id !== BlockType.BEDROCK && id !== BlockType.FURNACE_ON && id !== BlockType.BED_HEAD;
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
        case BlockType.NETHER_QUARTZ_ORE: return BlockType.QUARTZ;
        case BlockType.GLOWSTONE: return BlockType.GLOWSTONE_DUST;
        case BlockType.CLAY: return BlockType.CLAY_BALL;
        case BlockType.MELON: return BlockType.MELON_SLICE;
        case BlockType.LEAVES: return Math.random() < 0.05 ? BlockType.APPLE : (Math.random() < 0.08 ? BlockType.STICK : 0);
        case BlockType.TALL_GRASS: return Math.random() < 0.12 ? BlockType.WHEAT : 0;
        case BlockType.GLASS: return 0;
        case BlockType.GRAVEL: return Math.random() < 0.1 ? BlockType.FLINT : BlockType.GRAVEL;
        // ─── Modern Ore Drops ───────────────────────────
        case BlockType.IRON_ORE: return BlockType.RAW_IRON;
        case BlockType.GOLD_ORE: return BlockType.RAW_GOLD;
        case BlockType.COPPER_ORE:
        case BlockType.DEEPSLATE_COPPER_ORE: return BlockType.RAW_COPPER;
        // ─── 1.17+ Materials ───────────────────────────
        case BlockType.AMETHYST_CLUSTER: return BlockType.AMETHYST_SHARD;
        case BlockType.BUDDING_AMETHYST: return 0; // Does not drop itself
        case BlockType.DEEPSLATE: return BlockType.COBBLED_DEEPSLATE;
        case BlockType.ANCIENT_DEBRIS: return BlockType.ANCIENT_DEBRIS; // Drops itself
        case BlockType.SCULK: return 0; // Does not drop without Silk Touch
        case BlockType.SCULK_SENSOR:
        case BlockType.SCULK_CATALYST:
        case BlockType.SCULK_SHRIEKER:
            return type; // Drops themselves
        default: return type;
    }
}
