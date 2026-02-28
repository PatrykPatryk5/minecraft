/**
 * Storage System
 * Handles saving and loading the game state using:
 * - LocalStorage: For player data (position, inventory, health, time, etc.)
 * - IndexedDB: For bulky world chunk data (Uint16Arrays)
 * - File API: For exporting/importing .mcraft save files.
 */

import StorageWorker from './storage.worker?worker';

// Instantiate the worker once
const worker = new StorageWorker();
let nextId = 0;
const callbacks = new Map<number, { resolve: (val: any) => void, reject: (err: any) => void }>();

worker.onmessage = (e: MessageEvent) => {
    const { id, type, payload, error } = e.data;
    const cb = callbacks.get(id);
    if (!cb) return;

    if (error) {
        cb.reject(new Error(error));
    } else {
        cb.resolve(payload);
    }
    callbacks.delete(id);
};

function sendRequest<T>(type: string, payload?: any): Promise<T> {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
        callbacks.set(id, { resolve, reject });
        worker.postMessage({ id, type, payload });
    });
}

export async function saveChunk(key: string, data: Uint16Array): Promise<void> {
    worker.postMessage({ type: 'SAVE_CHUNK', payload: { key, data } }); // Fire & Forget
}

export async function loadChunk(key: string): Promise<Uint16Array | null> {
    return sendRequest<Uint16Array | null>('LOAD_CHUNK', { key });
}

export async function getSavedChunkKeys(): Promise<Set<string>> {
    const keysArray = await sendRequest<string[]>('GET_KEYS');
    return new Set(keysArray);
}

export async function clearAllChunks(): Promise<void> {
    await sendRequest<boolean>('CLEAR_ALL');
}

export async function getAllChunksData(): Promise<Record<string, number[]>> {
    return sendRequest<Record<string, number[]>>('EXPORT_ALL');
}

export async function importChunksData(chunksRecord: Record<string, number[]>): Promise<void> {
    await sendRequest<boolean>('IMPORT_ALL', chunksRecord);
}


// ─── LocalStorage for Player State ──────────────────────
const PLAYER_STATE_KEY = 'mcraft_player_state';

export type Dimension = 'overworld' | 'nether' | 'end';

export interface SavedSlot {
    id: number;
    count: number;
    durability?: number;
    featherFalling?: number;
}

export interface SavedArmor {
    helmet: SavedSlot;
    chestplate: SavedSlot;
    leggings: SavedSlot;
    boots: SavedSlot;
}

export interface SavedChest {
    slots: SavedSlot[];
    isOpen?: boolean;
}

export interface PlayerSaveState {
    pos: [number, number, number];
    rot: [number, number];
    inventory: (number | null | SavedSlot)[]; // union for legacy support
    hotbar?: SavedSlot[];
    armor?: SavedArmor;
    chests?: Record<string, SavedChest>;
    health: number;
    dayTime: number;
    dimension: Dimension;
    seed: number;
    doors?: Record<string, number>;
    gameMode?: 'creative' | 'survival' | 'spectator';
}

export function savePlayerState(state: PlayerSaveState): void {
    try {
        localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('Failed to save player state', e);
    }
}

export function loadPlayerState(): PlayerSaveState | null {
    try {
        const data = localStorage.getItem(PLAYER_STATE_KEY);
        if (data) {
            return JSON.parse(data) as PlayerSaveState;
        }
    } catch (e) {
        console.error('Failed to load player state', e);
    }
    return null;
}

export function clearPlayerState(): void {
    localStorage.removeItem(PLAYER_STATE_KEY);
}

// ─── Export & Import File ───────────────────────────────

export interface FullSaveFile {
    version: number;
    player: PlayerSaveState;
    chunks: Record<string, number[]>; // key -> Uint16Array converted to regular array
}

/**
 * Generates a full .mcraft save file containing player state and all chunks.
 * This can be quite large for explored worlds.
 */
export async function exportWorldToFile(): Promise<void> {
    const playerState = loadPlayerState();
    if (!playerState) {
        console.error("No player state to export!");
        return;
    }

    const chunks = await getAllChunksData();

    const saveFile: FullSaveFile = {
        version: 4,
        player: playerState,
        chunks: chunks
    };

    const jsonString = JSON.stringify(saveFile);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `muzykant_world_${new Date().toISOString().slice(0, 10)}.mcraft`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Parses a loaded JSON string as a save file and writes it to LocalStorage/IndexedDB.
 */
export async function importWorldFromFile(jsonString: string): Promise<boolean> {
    try {
        const saveFile = JSON.parse(jsonString) as FullSaveFile;

        if (!saveFile.version || !saveFile.player || !saveFile.chunks) {
            console.error("Invalid save file format.");
            return false;
        }

        // 1. Clear current world
        await clearAllChunks();
        clearPlayerState();

        // 2. Import Chunks to IndexedDB
        await importChunksData(saveFile.chunks);

        // 3. Import Player State to LocalStorage
        savePlayerState(saveFile.player);

        return true;
    } catch (e) {
        console.error("Error importing world", e);
        return false;
    }
}
