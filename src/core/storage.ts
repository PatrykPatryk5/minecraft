/**
 * Storage System
 * Handles saving and loading the game state using:
 * - LocalStorage: For player data (position, inventory, health, time, etc.)
 * - IndexedDB: For bulky world chunk data (Uint16Arrays)
 * - File API: For exporting/importing .mcraft save files.
 */

import { get, set, clear, entries, setMany } from 'idb-keyval';

export async function saveChunk(key: string, data: Uint16Array): Promise<void> {
    try {
        await set(key, data);
    } catch (e) {
        console.error('Failed to save chunk to IndexedDB', e);
    }
}

export async function loadChunk(key: string): Promise<Uint16Array | null> {
    try {
        const data = await get<Uint16Array>(key);
        return data || null;
    } catch (e) {
        console.error('Failed to load chunk from IndexedDB', e);
        return null;
    }
}

export async function clearAllChunks(): Promise<void> {
    try {
        await clear();
    } catch (e) {
        console.error('Failed to clear chunks', e);
    }
}

export async function getAllChunksData(): Promise<Record<string, number[]>> {
    try {
        const allEntries = await entries<string, Uint16Array>();
        const allData: Record<string, number[]> = {};
        for (const [key, chunkData] of allEntries) {
            allData[key] = Array.from(chunkData);
        }
        return allData;
    } catch (e) {
        console.error('Failed to get all chunks data', e);
        return {};
    }
}

export async function importChunksData(chunksRecord: Record<string, number[]>): Promise<void> {
    try {
        const elements: [string, Uint16Array][] = Object.entries(chunksRecord).map(
            ([k, v]) => [k, new Uint16Array(v)]
        );
        await setMany(elements);
    } catch (e) {
        console.error('Failed to import chunks data', e);
    }
}


// ─── LocalStorage for Player State ──────────────────────
const PLAYER_STATE_KEY = 'mcraft_player_state';

export type Dimension = 'overworld' | 'nether' | 'end';

export interface PlayerSaveState {
    pos: [number, number, number];
    rot: [number, number];
    inventory: (number | null)[];
    health: number;
    dayTime: number;
    dimension: Dimension;
    seed: number;
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
        version: 1,
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
