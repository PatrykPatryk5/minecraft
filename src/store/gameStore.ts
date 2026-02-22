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
import { saveChunk, savePlayerState, loadPlayerState, clearAllChunks, clearPlayerState, PlayerSaveState } from '../core/storage';
import { blockIndex, CHUNK_VOLUME } from '../core/terrainGen';
import { SMELTING_RECIPES, FUEL_VALUES } from '../core/crafting';

// ─── Helpers ─────────────────────────────────────────────
export const chunkKey = (cx: number, cz: number): string => `${cx},${cz}`;
export const blockKey = (lx: number, y: number, lz: number): string => `${lx},${y},${lz}`;

// ─── Types ───────────────────────────────────────────────
export type GameMode = 'survival' | 'creative' | 'spectator';
export type GameScreen = 'mainMenu' | 'worldCreate' | 'settings' | 'keybinds' | 'multiplayer' | 'playing' | 'paused' | 'credits';
export type Dimension = 'overworld' | 'nether' | 'end';

// ── GameState Interface ───────────────────────────────────
/** Which overlay is open (only one at a time) */
export type ActiveOverlay = 'none' | 'pause' | 'inventory' | 'crafting' | 'furnace' | 'chest';

export interface InventorySlot {
    id: number;   // block/item type
    count: number;
    durability?: number; // current durability left
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
    brightness: number; // 0.01 to 1.0
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

export interface DroppedItem {
    id: string;
    type: number;
    pos: [number, number, number];
    velocity?: [number, number, number];
}

export interface FallingBlock {
    id: string;
    type: number;
    pos: [number, number, number];
}

export interface ArrowEntity {
    id: string;
    pos: [number, number, number];
    velocity: [number, number, number];
    ownerId?: string;
}

export interface TNTPrimedEntity {
    id: string;
    pos: [number, number, number];
    fuse: number; // in ticks (default 80 = 4s)
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
    chunks: Record<string, Uint16Array>;
    chunkVersions: Record<string, number>;

    generatedChunks: Set<string>;
    worldSeed: number;
    worldName: string;

    arrows: Record<string, ArrowEntity>;
    addArrow: (pos: [number, number, number], velocity: [number, number, number]) => void;
    removeArrow: (id: string) => void;

    primedTNT: TNTPrimedEntity[];
    spawnTNT: (pos: [number, number, number], fuse?: number) => void;
    removeTNT: (id: string) => void;
    updateTNT: (id: string, fuse: number) => void;

    setChunkData: (cx: number, cz: number, dimension: string, data: Uint16Array) => void;
    getBlock: (x: number, y: number, z: number) => number;
    addBlock: (x: number, y: number, z: number, typeId: number, fromNetwork?: boolean) => void;
    removeBlock: (x: number, y: number, z: number, fromNetwork?: boolean) => void;
    removeBlocks: (blocks: [number, number, number][], fromNetwork?: boolean) => void;
    bumpVersion: (cx: number, cz: number) => void;
    resetWorld: () => void;
    setWorldSeed: (seed: number) => void;
    unloadChunkData: (keys: string[]) => void;
    getBlockPower: (x: number, y: number, z: number) => number;
    setBlockPower: (x: number, y: number, z: number, power: number) => void;

    // ── Weather ───────────────────────────────────────────
    weather: 'clear' | 'rain' | 'thunder';
    weatherIntensity: number; // 0..1 for transitions
    setWeather: (w: 'clear' | 'rain' | 'thunder', intensity?: number) => void;

    // ── Player ────────────────────────────────────────────
    playerPos: [number, number, number];
    setPlayerPos: (p: [number, number, number]) => void;
    playerVel: [number, number, number];
    setPlayerVel: (v: [number, number, number]) => void;
    playerRot: [number, number];
    setPlayerRot: (r: [number, number]) => void;

    health: number;
    maxHealth: number;
    hunger: number;
    maxHunger: number;
    setHealth: (h: number) => void;
    takeDamage: (amount: number, options?: { ignoreArmor?: boolean }) => void;
    setHunger: (h: number) => void;

    // ── Settings ──────────────────────────────────────────

    // ── XP System ──────────────────────────────────────────
    xp: number;
    xpLevel: number;
    xpProgress: number;
    addXp: (amount: number) => void;

    // ── Oxygen (underwater) ────────────────────────────────
    oxygen: number;
    maxOxygen: number;
    setOxygen: (o: number) => void;
    isUnderwater: boolean;
    setUnderwater: (v: boolean) => void;

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
    selectedSlot: number;
    addItem: (id: number, count?: number, initialDurability?: number) => boolean;
    consumeHotbarItem: (slot: number) => void;
    damageTool: (slotIndex: number) => void;
    getSelectedBlock: () => number;

    // ── Global Cursor ─────────────────────────────────────
    cursorItem: InventorySlot | null;

    setCursorItem: (item: InventorySlot | null) => void;

    // ── Crafting ──────────────────────────────────────────
    craftingGrid: InventorySlot[];           // 3x3 for table
    setCraftingGrid: (g: InventorySlot[]) => void;
    inventoryCraftingGrid: InventorySlot[];  // 2x2 for inventory
    setInventoryCraftingGrid: (g: InventorySlot[]) => void;

    // ── Furnace ───────────────────────────────────────────
    furnace: FurnaceState;
    setFurnace: (f: FurnaceState) => void;
    tickFurnace: () => void;

    // ── Food / Eat ────────────────────────────────────────
    eatFood: () => void;

    // ── Mining Progress ────────────────────────────────────
    miningProgressValue: number;
    setMiningProgress: (p: number) => void;
    lookingAt: [number, number, number] | null;
    setLookingAt: (pos: [number, number, number] | null) => void;

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
    setIsMultiplayer: (v: boolean) => void;
    connectedPlayers: Record<string, { name: string; pos: [number, number, number]; rot?: [number, number]; dimension?: string; isUnderwater?: boolean }>;
    addConnectedPlayer: (id: string, name: string, pos: [number, number, number], rot?: [number, number], dimension?: string, isUnderwater?: boolean) => void;
    removeConnectedPlayer: (id: string) => void;
    clearConnectedPlayers: () => void;
    chatMessages: { sender: string; text: string; time: number; type?: 'info' | 'error' | 'success' | 'system' | 'player' }[];
    addChatMessage: (sender: string, text: string, type?: 'info' | 'error' | 'success' | 'system' | 'player') => void;

    // ── Armor ──────────────────────────────────────────────
    armor: ArmorSlots;
    setArmor: (a: ArmorSlots) => void;
    getArmorPoints: () => number;

    // ── Dropped Items ──────────────────────────────────────
    droppedItems: DroppedItem[];
    addDroppedItem: (type: number, pos: [number, number, number], velocity?: [number, number, number]) => void;
    removeDroppedItem: (id: string) => void;

    // ── Falling/Gravity Blocks ─────────────────────────────
    fallingBlocks: FallingBlock[];
    spawnFallingBlock: (type: number, pos: [number, number, number]) => void;
    landFallingBlock: (id: string, pos: [number, number, number], type: number) => void;

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
        chunks: Record<string, Uint16Array>;
        chunkVersions: Record<string, number>;
        generatedChunks: Set<string>;
    }>;
    dragonDefeated: boolean;
    setDragonDefeated: (v: boolean) => void;

    // ── Storage / Persistence ─────────────────────────────
    loadWorldFromStorage: () => Promise<boolean>;
    saveGame: () => void;
    deleteWorld: () => Promise<void>;
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
    brightness: 0.5,
    keybinds: { ...defaultKeybinds },
};

export const emptyArmor = (): ArmorSlots => ({
    helmet: { id: 0, count: 0 },
    chestplate: { id: 0, count: 0 },
    leggings: { id: 0, count: 0 },
    boots: { id: 0, count: 0 },
});

const emptySlot = (): InventorySlot => ({ id: 0, count: 0 });
const makeSlots = (n: number): InventorySlot[] => Array.from({ length: n }, emptySlot);
const hotbarFromIds = (ids: number[]): InventorySlot[] =>
    ids.map(id => id ? { id, count: 64, durability: BLOCK_DATA[id]?.maxDurability } : emptySlot());

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
        if (dimension !== get().dimension) return;
        const key = chunkKey(cx, cz);
        saveChunk(`${dimension}:${cx},${cz}`, data);

        set((s) => {
            if (s.chunks[key] === data) return {};

            const versions = { ...s.chunkVersions };
            const bump = (k: string) => { versions[k] = (versions[k] ?? 0) + 1; };

            bump(key);
            const nPx = chunkKey(cx + 1, cz);
            const nNx = chunkKey(cx - 1, cz);
            const nPz = chunkKey(cx, cz + 1);
            const nNz = chunkKey(cx, cz - 1);

            if (s.chunks[nPx]) bump(nPx);
            if (s.chunks[nNx]) bump(nNx);
            if (s.chunks[nPz]) bump(nPz);
            if (s.chunks[nNz]) bump(nNz);

            let newGen = s.generatedChunks;
            if (!s.generatedChunks.has(key)) {
                newGen = new Set(s.generatedChunks);
                newGen.add(key);
            }

            return {
                chunks: { ...s.chunks, [key]: data },
                generatedChunks: newGen,
                chunkVersions: versions,
            };
        });
    },

    unloadChunkData: (keys) => set((s) => {
        const newChunks = { ...s.chunks };
        const newVersions = { ...s.chunkVersions };
        for (const key of keys) {
            delete newChunks[key];
            delete newVersions[key];
        }
        return { chunks: newChunks, chunkVersions: newVersions };
    }),

    getBlock: (x, y, z) => {
        if (y < 0 || y > 255) return 0;
        const cx = Math.floor(x / 16);
        const cz = Math.floor(z / 16);
        const chunk = get().chunks[chunkKey(cx, cz)];
        if (!chunk) return 0;
        const lx = ((x % 16) + 16) % 16;
        const lz = ((z % 16) + 16) % 16;
        const raw = chunk[blockIndex(lx, y, lz)];
        return raw & 0x0FFF; // 12-bit ID
    },

    getBlockPower: (x, y, z) => {
        if (y < 0 || y > 255) return 0;
        const cx = Math.floor(x / 16);
        const cz = Math.floor(z / 16);
        const chunk = get().chunks[chunkKey(cx, cz)];
        if (!chunk) return 0;
        const lx = ((x % 16) + 16) % 16;
        const lz = ((z % 16) + 16) % 16;
        const raw = chunk[blockIndex(lx, y, lz)];
        return (raw & 0xF000) >> 12; // 4-bit power
    },

    addBlock: (x, y, z, typeId, fromNetwork = false) => {
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
        }

        // Use a new copy to ensure React/Zustand detect change if they compare references
        const newChunk = new Uint16Array(chunk);
        newChunk[blockIndex(lx, y, lz)] = typeId & 0x0FFF;

        import('../core/redstoneSystem').then(({ updateRedstone }) => {
            updateRedstone(x, y, z);
        });

        set((s) => {
            const versions = { ...s.chunkVersions };
            const bump = (ccx: number, ccz: number) => {
                const k = chunkKey(ccx, ccz);
                versions[k] = (versions[k] ?? 0) + 1;
            };
            bump(cx, cz);
            if (lx === 0) bump(cx - 1, cz);
            if (lx === 15) bump(cx + 1, cz);
            if (lz === 0) bump(cx, cz - 1);
            if (lz === 15) bump(cx, cz + 1);

            return {
                chunks: { ...s.chunks, [key]: newChunk },
                chunkVersions: versions
            };
        });

        // Save to IndexedDB
        saveChunk(`${state.dimension}:${cx},${cz}`, newChunk);

        // Broadcast if local multiplayer
        if (!fromNetwork && state.isMultiplayer) {
            import('../multiplayer/ConnectionManager').then(({ getConnection }) => {
                getConnection().sendBlockPlace(x, y, z, typeId);
            });
        }
    },

    weather: 'clear' as 'clear' | 'rain' | 'thunder',
    weatherIntensity: 0,
    setWeather: (type, intensity) => set({ weather: type, weatherIntensity: intensity }),

    arrows: {},
    addArrow: (pos, velocity) => {
        const id = Math.random().toString(36).substr(2, 9);
        set((s) => ({
            arrows: { ...s.arrows, [id]: { id, pos, velocity } }
        }));
    },
    removeArrow: (id) => {
        set((s) => {
            const next = { ...s.arrows };
            delete next[id];
            return { arrows: next };
        });
    },

    setBlockPower: (x, y, z, power) => {
        if (y < 0 || y > 255) return;
        const cx = Math.floor(x / 16);
        const cz = Math.floor(z / 16);
        const key = chunkKey(cx, cz);
        const lx = ((x % 16) + 16) % 16;
        const lz = ((z % 16) + 16) % 16;
        const chunk = get().chunks[key];
        if (!chunk) return;

        const idx = blockIndex(lx, y, lz);
        const raw = chunk[idx];
        const id = raw & 0x0FFF;
        const currentPower = (raw >> 12) & 0x0F;

        // Apply 4-bit power (capped 0-15)
        const p = Math.max(0, Math.min(15, power));
        if (p === currentPower) return; // Skip if no change

        chunk[idx] = id | (p << 12);

        set((s) => ({
            chunkVersions: { ...s.chunkVersions, [key]: (s.chunkVersions[key] ?? 0) + 1 },
        }));

        // No need to save to DB for every power change if it's frequent?
        // Actually, redstone state SHOULD persist.
        saveChunk(`${get().dimension}:${cx},${cz}`, chunk);
    },

    removeBlock: (x, y, z, fromNetwork = false) => {
        if (y < 0 || y > 255) return;
        const cx = Math.floor(x / 16);
        const cz = Math.floor(z / 16);
        const key = chunkKey(cx, cz);
        const lx = ((x % 16) + 16) % 16;
        const lz = ((z % 16) + 16) % 16;
        const chunk = get().chunks[key];
        if (!chunk) return;
        const idx = blockIndex(lx, y, lz);
        if (chunk[idx] === 0) return; // Already air

        const oldType = chunk[idx];
        chunk[idx] = 0; // Reset ID and power to 0

        // Trigger Linked breaking & actions
        import('../core/blockActions').then(({ onBlockBroken }) => {
            onBlockBroken(x, y, z, oldType);
        });

        // Trigger Redstone update
        import('../core/redstoneSystem').then(({ updateRedstone }) => {
            updateRedstone(x, y, z);
        });

        // Bump version for self and neighbors - Batching to avoid React Error #185
        set((s) => {
            const versions = { ...s.chunkVersions };
            const bump = (ccx: number, ccz: number) => {
                const k = chunkKey(ccx, ccz);
                versions[k] = (versions[k] ?? 0) + 1;
            };
            bump(cx, cz);
            if (lx === 0) bump(cx - 1, cz);
            if (lx === 15) bump(cx + 1, cz);
            if (lz === 0) bump(cx, cz - 1);
            if (lz === 15) bump(cx, cz + 1);
            return { chunkVersions: versions };
        });

        const state = get();
        // Save to IndexedDB
        saveChunk(`${state.dimension}:${cx},${cz}`, chunk);

        // Broadcast if local multiplayer
        if (!fromNetwork && state.isMultiplayer) {
            import('../multiplayer/ConnectionManager').then(({ getConnection }) => {
                getConnection().sendBlockBreak(x, y, z);
            });
        }
    },

    removeBlocks: (blocks: [number, number, number][], fromNetwork = false) => {
        const s = get();
        const affectedChunks = new Set<string>();
        const redstoneTargets: [number, number, number][] = [];
        const bumpCounts = new Map<string, number>();
        const queueBump = (cx: number, cz: number) => {
            const k = chunkKey(cx, cz);
            bumpCounts.set(k, (bumpCounts.get(k) ?? 0) + 1);
        };

        for (const [x, y, z] of blocks) {
            if (y < 0 || y > 255) continue;
            const cx = Math.floor(x / 16);
            const cz = Math.floor(z / 16);
            const key = chunkKey(cx, cz);
            const lx = ((x % 16) + 16) % 16;
            const lz = ((z % 16) + 16) % 16;
            const chunk = s.chunks[key];
            if (!chunk) continue;
            const idx = blockIndex(lx, y, lz);
            if (chunk[idx] === 0) continue;

            chunk[idx] = 0;
            affectedChunks.add(key);
            if (redstoneTargets.length < 256) redstoneTargets.push([x, y, z]);
        }

        // Save and bump versions once per chunk
        for (const key of affectedChunks) {
            const chunk = s.chunks[key];
            const parts = key.split(',');
            const cx = parseInt(parts[0]), cz = parseInt(parts[1]);
            saveChunk(`${s.dimension}:${cx},${cz}`, chunk);
            queueBump(cx, cz);
            queueBump(cx + 1, cz);
            queueBump(cx - 1, cz);
            queueBump(cx, cz + 1);
            queueBump(cx, cz - 1);
        }

        if (bumpCounts.size > 0) {
            set((state) => {
                const chunkVersions = { ...state.chunkVersions };
                for (const [key, delta] of bumpCounts) {
                    chunkVersions[key] = (chunkVersions[key] ?? 0) + delta;
                }
                return { chunkVersions };
            });
        }

        // Redstone can be very expensive during massive TNT chains.
        if (redstoneTargets.length > 0) {
            import('../core/redstoneSystem').then(({ updateRedstone }) => {
                for (const [x, y, z] of redstoneTargets) {
                    updateRedstone(x, y, z);
                }
            });
        }

        // Broadcast if local multiplayer
        if (!fromNetwork && s.isMultiplayer && blocks.length > 0) {
            import('../multiplayer/ConnectionManager').then(({ getConnection }) => {
                const netBatch = blocks.length > 512 ? blocks.slice(0, 512) : blocks;
                for (const [x, y, z] of netBatch) {
                    getConnection().sendBlockBreak(x, y, z);
                }
            });
        }
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
    playerPos: [8, 80, 8] as [number, number, number],
    setPlayerPos: (p) => set({ playerPos: p }),
    playerVel: [0, 0, 0] as [number, number, number],
    setPlayerVel: (v) => set({ playerVel: v }),
    playerRot: [0, 0] as [number, number],
    setPlayerRot: (r) => set({ playerRot: r }),

    health: 20,
    maxHealth: 20,
    hunger: 20,
    maxHunger: 20,
    setHealth: (h) => {
        const clamped = Math.max(0, Math.min(get().maxHealth, h));
        set({ health: clamped });
        if (clamped <= 0 && !get().isDead) set({ isDead: true });
    },
    takeDamage: (amount, options = {}) => {
        if (get().gameMode === 'creative' || get().isDead) return;

        const armor = get().armor;
        let armorPoints = 0;

        if (!options.ignoreArmor) {
            if (armor.helmet.id) armorPoints += BLOCK_DATA[armor.helmet.id]?.armorPoints || 0;
            if (armor.chestplate.id) armorPoints += BLOCK_DATA[armor.chestplate.id]?.armorPoints || 0;
            if (armor.leggings.id) armorPoints += BLOCK_DATA[armor.leggings.id]?.armorPoints || 0;
            if (armor.boots.id) armorPoints += BLOCK_DATA[armor.boots.id]?.armorPoints || 0;
        }

        const reduction = options.ignoreArmor ? 1 : (1 - (armorPoints * 0.04));
        const finalDamage = Math.max(options.ignoreArmor ? 0.5 : 1, amount * reduction);

        const currentHealth = get().health;
        get().setHealth(currentHealth - finalDamage);

        // Damage armor durability
        if (armorPoints > 0 && !options.ignoreArmor) {
            const nextArmor = { ...armor };
            let changed = false;
            ['helmet', 'chestplate', 'leggings', 'boots'].forEach((slot) => {
                const s = (nextArmor as any)[slot];
                if (s.id && s.durability !== undefined) {
                    s.durability -= 1;
                    changed = true;
                    if (s.durability <= 0) {
                        s.id = 0;
                        s.count = 0;
                    }
                }
            });
            if (changed) set({ armor: nextArmor });
        }

        import('../audio/sounds').then(({ playSound }) => playSound('hurt'));
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
    isUnderwater: false,
    setUnderwater: (v) => set({ isUnderwater: v }),

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
    selectedSlot: 0,
    addItem: (id, count = 1, initialDurability?: number) => {
        const s = get();
        const info = BLOCK_DATA[id];
        const defaultDurability = initialDurability ?? info?.maxDurability;

        const maxStack = info?.stackSize ?? 64;

        if (maxStack === 1) {
            // Find empty slot because unstackable (like tools)
            let newHotbar = [...s.hotbar];
            for (let i = 0; i < 9; i++) {
                if (newHotbar[i].id === 0) {
                    newHotbar[i] = { id, count: 1, durability: defaultDurability };
                    set({ hotbar: newHotbar });
                    return true;
                }
            }
            let newInv = [...s.inventory];
            for (let i = 0; i < 27; i++) {
                if (newInv[i].id === 0) {
                    newInv[i] = { id, count: 1, durability: defaultDurability };
                    set({ inventory: newInv });
                    return true;
                }
            }
            return false;
        }

        // Try existing stacks (for stackable items)
        let newHotbar = [...s.hotbar];
        for (let i = 0; i < 9; i++) {
            if (newHotbar[i].id === id && newHotbar[i].count < maxStack) {
                const add = Math.min(count, maxStack - newHotbar[i].count);
                newHotbar[i].count += add;
                count -= add;
                if (count <= 0) {
                    set({ hotbar: newHotbar });
                    return true;
                }
            }
        }

        let newInv = [...s.inventory];
        for (let i = 0; i < 27; i++) {
            if (newInv[i].id === id && newInv[i].count < maxStack) {
                const add = Math.min(count, maxStack - newInv[i].count);
                newInv[i].count += add;
                count -= add;
                if (count <= 0) {
                    set({ inventory: newInv });
                    return true;
                }
            }
        }

        // Now try empty slots
        for (let i = 0; i < 9; i++) {
            if (newHotbar[i].id === 0) {
                const add = Math.min(count, maxStack);
                newHotbar[i] = { id, count: add, durability: undefined };
                count -= add;
                if (count <= 0) {
                    set({ hotbar: newHotbar });
                    return true;
                }
            }
        }

        for (let i = 0; i < 27; i++) {
            if (newInv[i].id === 0) {
                const add = Math.min(count, maxStack);
                newInv[i] = { id, count: add, durability: undefined };
                count -= add;
                if (count <= 0) {
                    set({ hotbar: newHotbar, inventory: newInv });
                    return true;
                }
            }
        }

        if (count > 0) {
            set({ hotbar: newHotbar, inventory: newInv });
        }
        return count <= 0;
    },
    consumeHotbarItem: (slot) => {
        const s = get();
        if (s.gameMode === 'creative') return;
        const newHotbar = [...s.hotbar];
        if (newHotbar[slot].count > 0) {
            newHotbar[slot].count--;
            if (newHotbar[slot].count <= 0) {
                newHotbar[slot] = emptySlot();
            }
            set({ hotbar: newHotbar });
        }
    },
    damageTool: (slotIndex) => {
        const s = get();
        if (s.gameMode === 'creative') return;
        const newHotbar = [...s.hotbar];
        const item = newHotbar[slotIndex];
        if (item.id !== 0 && item.durability !== undefined) {
            item.durability -= 1;
            if (item.durability <= 0) {
                newHotbar[slotIndex] = emptySlot(); // Break tool
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
    craftingGrid: makeSlots(9),
    setCraftingGrid: (g) => set({ craftingGrid: g }),
    inventoryCraftingGrid: makeSlots(4),
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
    tickFurnace: () => {
        const s = get();
        const f = s.furnace;

        let newBurnRemaining = f.burnTimeRemaining;
        const recipe = SMELTING_RECIPES.find(r => r.input === f.inputSlot.id);
        const canCook = recipe !== undefined &&
            f.inputSlot.count >= 1 &&
            (f.outputSlot.id === 0 || (f.outputSlot.id === recipe.output && f.outputSlot.count < 64));

        let newCookProgress = f.cookProgress;
        let consumedFuel = false;
        let fuelRemaining = f.fuelSlot.count;
        let fuelId = f.fuelSlot.id;
        let burnTotal = f.burnTimeTotal;

        if (newBurnRemaining > 0) {
            newBurnRemaining--;
        } else if (canCook && FUEL_VALUES[fuelId]) {
            // Consume fuel
            burnTotal = FUEL_VALUES[fuelId] * 200;
            newBurnRemaining = burnTotal;
            fuelRemaining--;
            consumedFuel = true;
            if (fuelRemaining <= 0) fuelId = 0;
        }

        if (newBurnRemaining > 0 && canCook) {
            newCookProgress++;
        } else {
            newCookProgress = 0;
        }

        let newOutputSlot = { ...f.outputSlot };
        let newInputSlot = { ...f.inputSlot };

        if (newCookProgress >= f.cookTimeTotal && canCook) {
            newCookProgress = 0;
            newInputSlot.count--;
            if (newInputSlot.count <= 0) newInputSlot.id = 0;

            if (newOutputSlot.id === 0) {
                newOutputSlot = { id: recipe!.output, count: recipe!.count };
            } else {
                newOutputSlot.count += recipe!.count;
            }
        }

        if (
            newBurnRemaining !== f.burnTimeRemaining ||
            newCookProgress !== f.cookProgress ||
            consumedFuel ||
            newInputSlot.count !== f.inputSlot.count
        ) {
            set({
                furnace: {
                    inputSlot: newInputSlot,
                    outputSlot: newOutputSlot,
                    fuelSlot: { id: fuelId, count: fuelRemaining },
                    burnTimeRemaining: newBurnRemaining,
                    burnTimeTotal: burnTotal,
                    cookProgress: newCookProgress,
                    cookTimeTotal: recipe ? recipe.duration : 200
                }
            });
        }
    },

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
    setMiningProgress: (p: number) => set({ miningProgressValue: p }),
    lookingAt: null,
    setLookingAt: (pos) => set({ lookingAt: pos }),

    // ── Multiplayer ───────────────────────────────────────
    // Provide a Math.random fallback since crypto.randomUUID() is unavailable on non-HTTPS LAN connections
    playerId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() :
        `muzo-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`,
    playerName: 'Player',
    setPlayerName: (n) => set({ playerName: n }),
    isMultiplayer: false,
    setIsMultiplayer: (v) => set({ isMultiplayer: v }),
    connectedPlayers: {},
    addConnectedPlayer: (id, name, pos, rot, dimension, isUnderwater) => set((s) => ({
        connectedPlayers: { ...s.connectedPlayers, [id]: { name, pos, rot, dimension, isUnderwater } },
    })),
    removeConnectedPlayer: (id) => set((s) => {
        const { [id]: _, ...rest } = s.connectedPlayers;
        return { connectedPlayers: rest };
    }),
    clearConnectedPlayers: () => set({ connectedPlayers: {} }),
    chatMessages: [{ sender: 'System', text: '§ Witaj w Minecraft R3F! Wpisz /help po listę komend.', time: Date.now(), type: 'system' }],
    addChatMessage: (sender, text, type = 'info') => set((s) => ({
        chatMessages: [...s.chatMessages.slice(-99), { sender, text, time: Date.now(), type }],
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

    // ── Dropped Items ──────────────────────────────────────
    droppedItems: [],
    addDroppedItem: (type, pos, velocity) => {
        const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `item-${Math.random().toString(36).substring(2, 10)}`;
        set((s) => ({
            droppedItems: [...s.droppedItems, { id, type, pos, velocity }]
        }));
    },
    removeDroppedItem: (id) => set((s) => ({
        droppedItems: s.droppedItems.filter(i => i.id !== id)
    })),

    // ── Falling/Gravity Blocks ─────────────────────────────
    fallingBlocks: [],
    spawnFallingBlock: (type, pos) => set((s) => ({
        fallingBlocks: [...s.fallingBlocks, { id: Math.random().toString(36).substr(2, 9), type, pos }]
    })),
    landFallingBlock: (id, pos, type) => {
        const s = get();
        s.addBlock(pos[0], pos[1], pos[2], type);
        set((s) => ({ fallingBlocks: s.fallingBlocks.filter(b => b.id !== id) }));
    },

    primedTNT: [],
    spawnTNT: (pos, fuse = 80) => set((s) => ({
        primedTNT: [...s.primedTNT, { id: Math.random().toString(36).substr(2, 9), pos, fuse }]
    })),
    removeTNT: (id) => set((s) => ({
        primedTNT: s.primedTNT.filter(t => t.id !== id)
    })),
    updateTNT: (id, fuse) => set((s) => ({
        primedTNT: s.primedTNT.map(t => t.id === id ? { ...t, fuse } : t)
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

    // ── Storage / Persistence ─────────────────────────────
    saveGame: () => {
        const s = get();
        const state: PlayerSaveState = {
            pos: s.playerPos,
            rot: [0, 0], // Optional, can add pitch/yaw later
            inventory: s.inventory.map(slot => slot.id === 0 ? null : slot.id),
            health: s.health,
            dayTime: s.dayTime,
            dimension: s.dimension,
            seed: s.worldSeed
        };
        savePlayerState(state);
    },

    loadWorldFromStorage: async () => {
        const state = loadPlayerState();
        if (state) {
            // Inventory translation (null index format to InventorySlot format)
            const loadedInventory = state.inventory.map(id =>
                id ? { id, count: 64 } : emptySlot()
            );

            set({
                playerPos: state.pos,
                inventory: loadedInventory,
                health: state.health,
                dayTime: state.dayTime,
                dimension: state.dimension,
                worldSeed: state.seed
            });
            return true;
        }
        return false;
    },

    deleteWorld: async () => {
        await clearAllChunks();
        clearPlayerState();
        get().resetWorld();
        window.location.reload(); // Hard reset
    }
}));

export default useGameStore;
