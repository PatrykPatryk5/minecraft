/**
 * Storage System
 * Handles saving and loading the game state using:
 * - LocalStorage: For player data (position, inventory, health, time, etc.)
 * - IndexedDB: For bulky world chunk data (Uint16Arrays)
 * - File API: For exporting/importing .mcraft save files.
 */

// ─── IndexedDB for World Chunks ─────────────────────────
const DB_NAME = 'MuzykantCraftDB';
const STORE_NAME = 'chunks';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });

    return dbPromise;
}

export async function saveChunk(key: string, data: Uint16Array): Promise<void> {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.put(data, key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('Failed to save chunk to IndexedDB', e);
    }
}

export async function loadChunk(key: string): Promise<Uint16Array | null> {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result ? (request.result as Uint16Array) : null);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('Failed to load chunk from IndexedDB', e);
        return null;
    }
}

export async function clearAllChunks(): Promise<void> {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('Failed to clear chunks', e);
    }
}

export async function getAllChunksData(): Promise<Record<string, number[]>> {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAllKeys();

            request.onsuccess = async () => {
                const keys = request.result as string[];
                const allData: Record<string, number[]> = {};

                for (const key of keys) {
                    const chunkData = await loadChunk(key);
                    if (chunkData) {
                        // Convert Uint16Array to regular array for JSON serialization
                        allData[key] = Array.from(chunkData);
                    }
                }
                resolve(allData);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('Failed to get all chunks data', e);
        return {};
    }
}

export async function importChunksData(chunksRecord: Record<string, number[]>): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Using a promise array to wait for all puts to complete
    const promises: Promise<void>[] = [];

    for (const [key, numArray] of Object.entries(chunksRecord)) {
        promises.push(new Promise((resolve, reject) => {
            const data = new Uint16Array(numArray);
            const req = store.put(data, key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        }));
    }

    await Promise.all(promises);
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
