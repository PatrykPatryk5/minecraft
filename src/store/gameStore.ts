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
import { BlockType, DEFAULT_HOTBAR, EMPTY_HOTBAR } from '../core/blockTypes';
import type { ChunkData } from '../core/terrainGen';

// ─── Helpers ─────────────────────────────────────────────
export const chunkKey = (cx: number, cz: number): string => `${cx},${cz}`;
export const blockKey = (lx: number, y: number, lz: number): string => `${lx},${y},${lz}`;

// ─── Types ───────────────────────────────────────────────
export type GameMode = 'survival' | 'creative' | 'spectator';
export type GameScreen = 'mainMenu' | 'worldCreate' | 'settings' | 'playing' | 'paused';

/** Which overlay is open (only one at a time) */
export type ActiveOverlay = 'none' | 'pause' | 'inventory' | 'crafting';

export interface InventorySlot {
    id: number;   // block/item type
    count: number;
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

    setChunkData: (cx: number, cz: number, data: ChunkData) => void;
    getBlock: (x: number, y: number, z: number) => number;
    addBlock: (x: number, y: number, z: number, typeId: number) => void;
    removeBlock: (x: number, y: number, z: number) => void;
    bumpVersion: (cx: number, cz: number) => void;
    resetWorld: () => void;

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
    xpProgress: number; // 0-1 within current level
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

    /** Main inventory (27 slots like MC) */
    inventory: InventorySlot[];
    setInventory: (inv: InventorySlot[]) => void;

    /** Add an item to inventory/hotbar (returns false if full) */
    addItem: (id: number, count?: number) => boolean;
    /** Remove item from hotbar by slot index (decrements count) */
    consumeHotbarItem: (slot: number) => void;
    /** Get selected block type from hotbar */
    getSelectedBlock: () => number;

    // Crafting grid (3x3 = 9 slots)
    craftingGrid: number[];
    setCraftingGrid: (g: number[]) => void;

    // ── Day/Night ─────────────────────────────────────────
    dayTime: number;
    setDayTime: (t: number) => void;

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
}

const defaultSettings: GameSettings = {
    renderDistance: 6,
    fov: 75,
    sensitivity: 0.5,
    soundVolume: 0.8,
    musicVolume: 0.3,
    graphics: 'fancy',
    showFps: false,
    viewBobbing: true,
};

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

    setChunkData: (cx, cz, data) => {
        const key = chunkKey(cx, cz);
        set((s) => {
            const newGen = new Set(s.generatedChunks);
            newGen.add(key);
            return {
                chunks: { ...s.chunks, [key]: data },
                generatedChunks: newGen,
            };
        });
    },

    getBlock: (x, y, z) => {
        const cx = Math.floor(x / 16);
        const cz = Math.floor(z / 16);
        const chunk = get().chunks[chunkKey(cx, cz)];
        if (!chunk) return 0;
        const lx = ((x % 16) + 16) % 16;
        const lz = ((z % 16) + 16) % 16;
        return chunk[blockKey(lx, y, lz)] ?? 0;
    },

    addBlock: (x, y, z, typeId) => {
        if (y < 0 || y > 255) return;
        const cx = Math.floor(x / 16);
        const cz = Math.floor(z / 16);
        const key = chunkKey(cx, cz);
        const lx = ((x % 16) + 16) % 16;
        const lz = ((z % 16) + 16) % 16;
        set((s) => ({
            chunks: { ...s.chunks, [key]: { ...(s.chunks[key] ?? {}), [blockKey(lx, y, lz)]: typeId } },
        }));
    },

    removeBlock: (x, y, z) => {
        const cx = Math.floor(x / 16);
        const cz = Math.floor(z / 16);
        const key = chunkKey(cx, cz);
        const lx = ((x % 16) + 16) % 16;
        const lz = ((z % 16) + 16) % 16;
        set((s) => {
            const chunk = { ...(s.chunks[key] ?? {}) };
            delete chunk[blockKey(lx, y, lz)];
            return { chunks: { ...s.chunks, [key]: chunk } };
        });
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
        worldSeed: Math.floor(Math.random() * 999999),
        playerPos: [0, 80, 0] as [number, number, number],
        health: 20,
        hunger: 20,
        dayTime: 0.3,
        activeOverlay: 'none' as ActiveOverlay,
    }),

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

    // ── Crafting ──────────────────────────────────────────
    craftingGrid: Array(9).fill(0),
    setCraftingGrid: (g) => set({ craftingGrid: g }),

    // ── Day/Night ─────────────────────────────────────────
    dayTime: 0.3,
    setDayTime: (t) => set({ dayTime: t }),

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
}));

export default useGameStore;
