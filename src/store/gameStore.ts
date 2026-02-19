/**
 * Game Store — Zustand (Expanded with Inventory System)
 *
 * Includes:
 *   - Survival inventory with item collection
 *   - Game modes (survival/creative/spectator)
 *   - Main menu state
 *   - Settings
 *   - Crafting grid
 *   - Multiplayer-ready
 *   - GUI lock management (prevents ESC overlap)
 */

import { create } from 'zustand';
import { BlockType, DEFAULT_HOTBAR, EMPTY_HOTBAR, BLOCK_DATA } from '../core/blockTypes';
import type { ChunkData } from '../core/terrainGen';
import { blockIndex, CHUNK_VOLUME } from '../core/terrainGen';

// ─── Helpers ─────────────────────────────────────────────
export const chunkKey = (cx: number, cz: number): string => `${cx},${cz}`;
export const blockKey = (lx: number, y: number, lz: number): string => `${lx},${y},${lz}`;

// ─── Types ───────────────────────────────────────────────
export type GameMode = 'survival' | 'creative' | 'spectator';
export type GameScreen = 'mainMenu' | 'worldCreate' | 'settings' | 'keybinds' | 'multiplayer' | 'playing' | 'paused' | 'credits';
export type Dimension = 'overworld' | 'nether' | 'end';

/** Which overlay is open (only one at a time) */
export type ActiveOverlay = 'none' | 'pause' | 'inventory' | 'crafting' | 'furnace' | 'chest';

export interface InventorySlot {
    id: number;   // block/item type
    count: number;
}

export type Difficulty = 'peaceful' | 'easy' | 'normal' | 'hard';

export interface Keybinds {
    forward: string;
    backward: string;
    left: string;
    right: string;
    jump: string;
    sprint: string;
    sneak: string;
    inventory: string;
    drop: string;
    chat: string;
    command: string;
    [key: string]: string;
}

export interface GameSettings {
    renderDistance: number;
    fov: number;
    sensitivity: number;
    soundVolume: number;
    musicVolume: number;
    graphics: 'fast' | 'fancy' | 'fabulous';
    showFps: boolean;
    viewBobbing: boolean;
    difficulty: Difficulty;
    guiScale: number;
    particles: 'all' | 'decreased' | 'minimal';
    smoothLighting: boolean;
    fullscreen: boolean;
    keybinds: Keybinds;
}

export interface ArmorSlots {
    helmet: InventorySlot;
    chestplate: InventorySlot;
    leggings: InventorySlot;
    boots: InventorySlot;
}

export interface ChestData {
    slots: InventorySlot[];
}

export interface FurnaceState {
    inputSlot: InventorySlot;
    fuelSlot: InventorySlot;
    outputSlot: InventorySlot;
    burnTimeRemaining: number;   // ticks remaining of current fuel
    burnTimeTotal: number;       // total burn time of current fuel
    cookProgress: number;        // ticks cooked so far
    cookTimeTotal: number;       // ticks needed (200 = 10s at 20tps)
}

export interface PistonData {
    x: number;
    y: number;
    z: number;
    direction: number; // 0-5
    extended: boolean;
    type: 'normal' | 'sticky';
}

export interface GameState {
    // ── Screen / Menu ─────────────────────────────────────
    screen: GameScreen;
    setScreen: (s: GameScreen) => void;

    // ── Overlay Management (prevents ESC conflicts) ───────
    activeOverlay: ActiveOverlay;
    setOverlay: (o: ActiveOverlay) => void;

    // ── Game Mode ─────────────────────────────────────────
    gameMode: GameMode;
    setGameMode: (m: GameMode) => void;

    // ── World ─────────────────────────────────────────────
    chunks: Record<string, ChunkData>;
    chunkVersions: Record<string, number>;
    generatedChunks: Set<string>;
    worldSeed: number;
    worldName: string;

    setChunkData: (cx: number, cz: number, dimension: string, data: ChunkData) => void;
    getBlock: (x: number, y: number, z: number) => number;
    addBlock: (x: number, y: number, z: number, typeId: number) => void;
    removeBlock: (x: number, y: number, z: number) => void;
    bumpVersion: (cx: number, cz: number) => void;
    resetWorld: () => void;
    setWorldSeed: (seed: number) => void;

    // ── Player ────────────────────────────────────────────
    playerPos: [number, number, number];
    setPlayerPos: (p: [number, number, number]) => void;

    health: number;
    maxHealth: number;
    hunger: number;
    maxHunger: number;
    setHealth: (h: number) => void;
    setHunger: (h: number) => void;

    // ── XP System ──────────────────────────────────────────
    xp: number;
    xpLevel: number;
    xpProgress: number;
    addXp: (amount: number) => void;

    // ── Oxygen (underwater) ────────────────────────────────
    oxygen: number;
    maxOxygen: number;
    setOxygen: (o: number) => void;

    // ── Death ──────────────────────────────────────────────
    isDead: boolean;
    setDead: (v: boolean) => void;

    // ── Hotbar / Inventory / Item Collection ──────────────
    hotbarSlot: number;
    setHotbarSlot: (s: number) => void;
    hotbar: InventorySlot[];
    setHotbar: (h: InventorySlot[]) => void;
    inventory: InventorySlot[];
    setInventory: (inv: InventorySlot[]) => void;
    addItem: (id: number, count?: number) => boolean;
    consumeHotbarItem: (slot: number) => void;
    getSelectedBlock: () => number;

    // ── Global Cursor ─────────────────────────────────────
    cursorItem: InventorySlot | null;
    setCursorItem: (item: InventorySlot | null) => void;

    // ── Crafting ──────────────────────────────────────────
    craftingGrid: number[];           // 3x3 for table
    setCraftingGrid: (g: number[]) => void;
    inventoryCraftingGrid: number[];  // 2x2 for inventory
    setInventoryCraftingGrid: (g: number[]) => void;

    // ── Furnace ───────────────────────────────────────────
    furnace: FurnaceState;
    setFurnace: (f: FurnaceState) => void;

    // ── Food / Eat ────────────────────────────────────────
    eatFood: () => void;

    // ── Mining Progress ────────────────────────────────────
    miningProgressValue: number;
    setMiningProgress: (p: number) => void;

    // ── Day/Night ─────────────────────────────────────────
    dayTime: number;
    setDayTime: (t: number) => void;
    skipNight: () => void;

    // ── Mobs ──────────────────────────────────────────────
    mobs: any[];
    setMobs: (m: any[]) => void;

    // ── UI State ──────────────────────────────────────────
    isPaused: boolean;
    setPaused: (v: boolean) => void;
    showDebug: boolean;
    toggleDebug: () => void;
    isLocked: boolean;
    setLocked: (v: boolean) => void;
    showHUD: boolean;
    toggleHUD: () => void;
    isChatOpen: boolean;
    setChatOpen: (v: boolean) => void;

    // ── Settings ──────────────────────────────────────────
    settings: GameSettings;
    updateSettings: (partial: Partial<GameSettings>) => void;
    renderDistance: number;
    setRenderDistance: (d: number) => void;
    fov: number;
    setFov: (f: number) => void;

    // ── Perf ──────────────────────────────────────────────
    fps: number;
    setFps: (f: number) => void;

    // ── Mining Progress ────────────────────────────────────
    // (implementation below)

    // ── Multiplayer Prep ──────────────────────────────────
    playerId: string;
    playerName: string;
    setPlayerName: (n: string) => void;
    isMultiplayer: boolean;
    connectedPlayers: Record<string, { name: string; pos: [number, number, number] }>;
    addConnectedPlayer: (id: string, name: string, pos: [number, number, number]) => void;
    removeConnectedPlayer: (id: string) => void;
    chatMessages: { sender: string; text: string; time: number }[];
    addChatMessage: (sender: string, text: string) => void;

    // ── Armor ──────────────────────────────────────────────
    armor: ArmorSlots;
    setArmor: (a: ArmorSlots) => void;
    getArmorPoints: () => number;

    // ── Chests ─────────────────────────────────────────────
    chests: Record<string, ChestData>;
    getChest: (key: string) => ChestData | null;
    setChest: (key: string, data: ChestData) => void;

    // ── Pistons ────────────────────────────────────────────
    pistons: Record<string, PistonData>;
    getPiston: (key: string) => PistonData | null;
    setPiston: (key: string, data: PistonData) => void;

    // ── Fall Damage ────────────────────────────────────────
    fallDistance: number;
    setFallDistance: (d: number) => void;

    // ── Dimensions ────────────────────────────────────────
    dimension: Dimension;
    setDimension: (d: Dimension) => void;
    dimensionChunks: Record<string, {
        chunks: Record<string, ChunkData>;
        chunkVersions: Record<string, number>;
        generatedChunks: Set<string>;
    }>;
    dragonDefeated: boolean;
    setDragonDefeated: (v: boolean) => void;
}

const defaultKeybinds: Keybinds = {
    forward: 'KeyW',
    backward: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    jump: 'Space',
    sprint: 'ShiftLeft',
    sneak: 'ControlLeft',
    inventory: 'KeyE',
    drop: 'KeyQ',
    chat: 'KeyT',
    command: 'Slash',
};

const defaultSettings: GameSettings = {
    renderDistance: 6,
    fov: 75,
    sensitivity: 0.5,
    soundVolume: 0.8,
    musicVolume: 0.3,
    graphics: 'fancy',
    showFps: false,
    viewBobbing: true,
    difficulty: 'normal',
    guiScale: 2,
    particles: 'all',
    smoothLighting: true,
    fullscreen: false,
    keybinds: { ...defaultKeybinds },
};

const emptyArmor = (): ArmorSlots => ({
    helmet: { id: 0, count: 0 },
    chestplate: { id: 0, count: 0 },
    leggings: { id: 0, count: 0 },
    boots: { id: 0, count: 0 },
});

const emptySlot = (): InventorySlot => ({ id: 0, count: 0 });
const makeSlots = (n: number): InventorySlot[] => Array.from({ length: n }, emptySlot);
const hotbarFromIds = (ids: number[]): InventorySlot[] =>
    ids.map(id => id ? { id, count: 64 } : emptySlot());

const useGameStore = create<GameState>((set, get) => ({
    // ── Screen ────────────────────────────────────────────
    screen: 'mainMenu' as GameScreen,
    setScreen: (s) => set({ screen: s }),

    // ── Overlay ───────────────────────────────────────────
    activeOverlay: 'none' as ActiveOverlay,
    setOverlay: (o) => set({ activeOverlay: o }),

    // ── Game Mode ─────────────────────────────────────────
    gameMode: 'survival' as GameMode,
    setGameMode: (m) => {
        const hotbar = m === 'creative'
            ? hotbarFromIds(DEFAULT_HOTBAR)
            : get().hotbar; // Keep current in survival
        set({ gameMode: m, hotbar });
    },

    // ── World ─────────────────────────────────────────────
    chunks: {},
    chunkVersions: {},
    generatedChunks: new Set(),
    worldSeed: Math.floor(Math.random() * 999999),
    worldName: 'Nowy Świat',

    setChunkData: (cx, cz, dimension, data) => {
        // If received chunk is for a different dimension than currently active, discard it
        if (dimension !== get().dimension) return;

        const key = chunkKey(cx, cz);
        set((s) => {
            const newGen = new Set(s.generatedChunks);
            newGen.add(key);

            // Bump version for self and neighbors to force re-mesh (fixes culling seams)
            const versions = { ...s.chunkVersions };
            const bump = (k: string) => { versions[k] = (versions[k] ?? 0) + 1; };

            bump(key);
            bump(chunkKey(cx + 1, cz));
            bump(chunkKey(cx - 1, cz));
            bump(chunkKey(cx, cz + 1));
            bump(chunkKey(cx, cz - 1));

            return {
                chunks: { ...s.chunks, [key]: data },
                generatedChunks: newGen,
                chunkVersions: versions,
            };
        });
    },

    getBlock: (x, y, z) => {
        if (y < 0 || y > 255) return 0;
        const cx = Math.floor(x / 16);
        const cz = Math.floor(z / 16);
        const chunk = get().chunks[chunkKey(cx, cz)];
        if (!chunk) return 0;
        const lx = ((x % 16) + 16) % 16;
        const lz = ((z % 16) + 16) % 16;
        return chunk[blockIndex(lx, y, lz)];
    },

    addBlock: (x, y, z, typeId) => {
        if (y < 0 || y > 255) return;
        const cx = Math.floor(x / 16);
        const cz = Math.floor(z / 16);
        const key = chunkKey(cx, cz);
        const lx = ((x % 16) + 16) % 16;
        const lz = ((z % 16) + 16) % 16;
        const state = get();
        let chunk = state.chunks[key];
        if (!chunk) {
            chunk = new Uint16Array(CHUNK_VOLUME);
            set((s) => ({ chunks: { ...s.chunks, [key]: chunk! } }));
        }
        chunk[blockIndex(lx, y, lz)] = typeId;
    },

    removeBlock: (x, y, z) => {
        if (y < 0 || y > 255) return;
        const cx = Math.floor(x / 16);
        const cz = Math.floor(z / 16);
        const key = chunkKey(cx, cz);
        const lx = ((x % 16) + 16) % 16;
        const lz = ((z % 16) + 16) % 16;
        const chunk = get().chunks[key];
        if (!chunk) return;
        chunk[blockIndex(lx, y, lz)] = 0;
    },

    bumpVersion: (cx, cz) => {
        const key = chunkKey(cx, cz);
        set((s) => ({
            chunkVersions: { ...s.chunkVersions, [key]: (s.chunkVersions[key] ?? 0) + 1 },
        }));
    },

    resetWorld: () => set({
        chunks: {},
        chunkVersions: {},
        generatedChunks: new Set(),
        playerPos: [0, 80, 0] as [number, number, number],
        health: 20,
        hunger: 20,
        dayTime: 0.3,
        activeOverlay: 'none' as ActiveOverlay,
    }),

    setWorldSeed: (seed) => set({ worldSeed: seed }),

    // ── Player ────────────────────────────────────────────
    playerPos: [0, 80, 0] as [number, number, number],
    setPlayerPos: (p) => set({ playerPos: p }),

    health: 20,
    maxHealth: 20,
    hunger: 20,
    maxHunger: 20,
    setHealth: (h) => {
        const clamped = Math.max(0, Math.min(get().maxHealth, h));
        set({ health: clamped });
        if (clamped <= 0 && !get().isDead) set({ isDead: true });
    },
    setHunger: (h) => set({ hunger: Math.max(0, Math.min(get().maxHunger, h)) }),

    // ── XP ────────────────────────────────────────────────
    xp: 0,
    xpLevel: 0,
    xpProgress: 0,
    addXp: (amount) => {
        const s = get();
        let totalXp = s.xp + amount;
        let level = s.xpLevel;
        const xpForLevel = (lvl: number) => 7 + (lvl * 3); // simplified MC formula
        let needed = xpForLevel(level);
        while (totalXp >= needed) {
            totalXp -= needed;
            level++;
            needed = xpForLevel(level);
        }
        set({ xp: totalXp, xpLevel: level, xpProgress: totalXp / needed });
    },

    // ── Oxygen ─────────────────────────────────────────────
    oxygen: 300,
    maxOxygen: 300,
    setOxygen: (o) => set({ oxygen: Math.max(0, Math.min(get().maxOxygen, o)) }),

    // ── Death ──────────────────────────────────────────────
    isDead: false,
    setDead: (v) => set({ isDead: v }),

    // ── Hotbar / Inventory ────────────────────────────────
    hotbarSlot: 0,
    setHotbarSlot: (s) => set({ hotbarSlot: s }),
    hotbar: makeSlots(9), // Starts empty in survival
    setHotbar: (h) => set({ hotbar: h }),
    inventory: makeSlots(27),
    setInventory: (inv) => set({ inventory: inv }),

    addItem: (id, count = 1) => {
        const s = get();
        const newHotbar = s.hotbar.map(sl => ({ ...sl }));
        const newInv = s.inventory.map(sl => ({ ...sl }));
        let remaining = count;

        // Try to stack in existing hotbar slots
        for (let i = 0; i < 9 && remaining > 0; i++) {
            if (newHotbar[i].id === id && newHotbar[i].count < 64) {
                const add = Math.min(remaining, 64 - newHotbar[i].count);
                newHotbar[i].count += add;
                remaining -= add;
            }
        }
        // Try to stack in existing inventory slots
        for (let i = 0; i < 27 && remaining > 0; i++) {
            if (newInv[i].id === id && newInv[i].count < 64) {
                const add = Math.min(remaining, 64 - newInv[i].count);
                newInv[i].count += add;
                remaining -= add;
            }
        }
        // Try empty hotbar slot
        for (let i = 0; i < 9 && remaining > 0; i++) {
            if (newHotbar[i].id === 0) {
                newHotbar[i] = { id, count: remaining };
                remaining = 0;
            }
        }
        // Try empty inventory slot
        for (let i = 0; i < 27 && remaining > 0; i++) {
            if (newInv[i].id === 0) {
                newInv[i] = { id, count: remaining };
                remaining = 0;
            }
        }

        set({ hotbar: newHotbar, inventory: newInv });
        return remaining === 0;
    },

    consumeHotbarItem: (slot) => {
        const s = get();
        if (s.gameMode === 'creative') return; // Infinite in creative
        const newHotbar = s.hotbar.map(sl => ({ ...sl }));
        if (newHotbar[slot].count > 0) {
            newHotbar[slot].count--;
            if (newHotbar[slot].count <= 0) {
                newHotbar[slot] = emptySlot();
            }
            set({ hotbar: newHotbar });
        }
    },

    getSelectedBlock: () => {
        const s = get();
        return s.hotbar[s.hotbarSlot]?.id ?? 0;
    },

    // ── Global Cursor ─────────────────────────────────────
    cursorItem: null,
    setCursorItem: (item) => set({ cursorItem: item }),

    // ── Crafting ──────────────────────────────────────────
    craftingGrid: Array(9).fill(0),
    setCraftingGrid: (g) => set({ craftingGrid: g }),
    inventoryCraftingGrid: Array(4).fill(0),
    setInventoryCraftingGrid: (g) => set({ inventoryCraftingGrid: g }),

    // ── Furnace ───────────────────────────────────────────
    furnace: {
        inputSlot: emptySlot(),
        fuelSlot: emptySlot(),
        outputSlot: emptySlot(),
        burnTimeRemaining: 0,
        burnTimeTotal: 0,
        cookProgress: 0,
        cookTimeTotal: 200,
    },
    setFurnace: (f) => set({ furnace: f }),

    // ── Food / Eat ────────────────────────────────────────
    eatFood: () => {
        const s = get();
        const slot = s.hotbar[s.hotbarSlot];
        if (!slot || !slot.id) return;
        const info = BLOCK_DATA[slot.id];
        if (!info?.foodRestore) return;
        if (s.hunger >= s.maxHunger) return;
        s.setHunger(Math.min(s.maxHunger, s.hunger + info.foodRestore));
        s.consumeHotbarItem(s.hotbarSlot);
    },

    // ── Day/Night ─────────────────────────────────────────
    dayTime: 0.3,
    setDayTime: (t) => set({ dayTime: t }),
    skipNight: () => set({ dayTime: 0.3 }),


    // ── Mobs ──────────────────────────────────────────────
    mobs: [],
    setMobs: (m) => set({ mobs: m }),

    // ── UI ────────────────────────────────────────────────
    isPaused: false,
    setPaused: (v) => set({ isPaused: v, activeOverlay: v ? 'pause' as ActiveOverlay : 'none' as ActiveOverlay }),
    showDebug: false,
    toggleDebug: () => set((s) => ({ showDebug: !s.showDebug })),
    isLocked: false,
    setLocked: (v) => set({ isLocked: v }),
    showHUD: true,
    toggleHUD: () => set((s) => ({ showHUD: !s.showHUD })),
    isChatOpen: false,
    setChatOpen: (v) => set({ isChatOpen: v }),

    // ── Settings ──────────────────────────────────────────
    settings: { ...defaultSettings },
    updateSettings: (partial) => set((s) => {
        const newSettings = { ...s.settings, ...partial };
        return { settings: newSettings, renderDistance: newSettings.renderDistance, fov: newSettings.fov };
    }),
    renderDistance: defaultSettings.renderDistance,
    setRenderDistance: (d) => set((s) => ({
        renderDistance: d, settings: { ...s.settings, renderDistance: d },
    })),
    fov: defaultSettings.fov,
    setFov: (f) => set((s) => ({
        fov: f, settings: { ...s.settings, fov: f },
    })),

    // ── Perf ──────────────────────────────────────────────
    fps: 0,
    setFps: (f) => set({ fps: f }),

    // ── Mining Progress ──────────────────────────────────
    miningProgressValue: 0,
    setMiningProgress: (p) => set({ miningProgressValue: p }),

    // ── Multiplayer ───────────────────────────────────────
    playerId: crypto.randomUUID(),
    playerName: 'Player',
    setPlayerName: (n) => set({ playerName: n }),
    isMultiplayer: false,
    connectedPlayers: {},
    addConnectedPlayer: (id, name, pos) => set((s) => ({
        connectedPlayers: { ...s.connectedPlayers, [id]: { name, pos } },
    })),
    removeConnectedPlayer: (id) => set((s) => {
        const { [id]: _, ...rest } = s.connectedPlayers;
        return { connectedPlayers: rest };
    }),
    chatMessages: [],
    addChatMessage: (sender, text) => set((s) => ({
        chatMessages: [...s.chatMessages.slice(-99), { sender, text, time: Date.now() }],
    })),

    // ── Armor ──────────────────────────────────────────────
    armor: emptyArmor(),
    setArmor: (a) => set({ armor: a }),
    getArmorPoints: () => {
        const a = get().armor;
        let pts = 0;
        // Simple: each non-empty slot = +2 armor points
        if (a.helmet.id) pts += 2;
        if (a.chestplate.id) pts += 6;
        if (a.leggings.id) pts += 5;
        if (a.boots.id) pts += 2;
        return pts;
    },

    // ── Chests ─────────────────────────────────────────────
    chests: {},
    getChest: (key) => get().chests[key] || null,
    setChest: (key, data) => set((s) => ({
        chests: { ...s.chests, [key]: data },
    })),

    // ── Pistons ────────────────────────────────────────────
    pistons: {},
    getPiston: (key) => get().pistons[key] || null,
    setPiston: (key, data) => set((s) => ({
        pistons: { ...s.pistons, [key]: data },
    })),

    // ── Fall Damage ────────────────────────────────────────
    fallDistance: 0,
    setFallDistance: (d) => set({ fallDistance: d }),

    // ── Dimensions ────────────────────────────────────────
    dimension: 'overworld' as Dimension,
    setDimension: (d) => set((s) => {
        if (s.dimension === d) return {};

        const oldDim = s.dimension;
        // Save current state
        const savedChunks = { ...s.chunks };
        const savedVersions = { ...s.chunkVersions };
        const savedGenerated = new Set(s.generatedChunks);

        const newDimStore = s.dimensionChunks[d] || { chunks: {}, chunkVersions: {}, generatedChunks: new Set() };

        return {
            dimension: d,
            chunks: newDimStore.chunks || {},
            chunkVersions: newDimStore.chunkVersions || {},
            generatedChunks: newDimStore.generatedChunks || new Set(),
            // Save old to storage
            dimensionChunks: {
                ...s.dimensionChunks,
                [oldDim]: {
                    chunks: savedChunks,
                    chunkVersions: savedVersions,
                    generatedChunks: savedGenerated
                }
            }
        };
    }),
    dimensionChunks: {
        overworld: { chunks: {}, chunkVersions: {}, generatedChunks: new Set() },
        nether: { chunks: {}, chunkVersions: {}, generatedChunks: new Set() },
        end: { chunks: {}, chunkVersions: {}, generatedChunks: new Set() }
    },
    dragonDefeated: false,
    setDragonDefeated: (v) => set({ dragonDefeated: v }),
}));

export default useGameStore;
