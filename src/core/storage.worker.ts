import { get, setMany, clear, entries, keys } from 'idb-keyval';

// In-memory queue for worker to flush periodically
const saveQueue = new Map<string, Uint16Array>();
let saveTimeout: any = null;

async function flushSaveQueue() {
    saveTimeout = null;
    if (saveQueue.size === 0) return;

    const elements: [string, Uint16Array][] = Array.from(saveQueue.entries());
    saveQueue.clear();

    try {
        await setMany(elements);
    } catch (e) {
        console.error('[StorageWorker] Failed to batch save chunks to IndexedDB', e);
    }
}

self.onmessage = async (e: MessageEvent) => {
    const { id, type, payload } = e.data;

    try {
        switch (type) {
            case 'SAVE_CHUNK': {
                const { key, data } = payload;
                saveQueue.set(key, data);
                if (!saveTimeout) {
                    saveTimeout = setTimeout(flushSaveQueue, 1000);
                }
                // No need to reply for save
                break;
            }
            case 'LOAD_CHUNK': {
                const { key } = payload;
                const data = await get<Uint16Array>(key);
                self.postMessage({ id, type: 'LOAD_CHUNK_RES', payload: data || null });
                break;
            }
            case 'GET_KEYS': {
                const allKeys = await keys<string>();
                const chunkKeys = allKeys.filter(k => typeof k === 'string' && k.includes(':'));
                self.postMessage({ id, type: 'GET_KEYS_RES', payload: chunkKeys });
                break;
            }
            case 'CLEAR_ALL': {
                await clear();
                self.postMessage({ id, type: 'CLEAR_ALL_RES', payload: true });
                break;
            }
            case 'EXPORT_ALL': {
                const allEntries = await entries<string, Uint16Array>();
                const allData: Record<string, number[]> = {};
                for (const [key, chunkData] of allEntries) {
                    if (typeof key === 'string' && key.includes(':')) {
                        allData[key] = Array.from(chunkData);
                    }
                }
                self.postMessage({ id, type: 'EXPORT_ALL_RES', payload: allData });
                break;
            }
            case 'IMPORT_ALL': {
                const chunksRecord = payload;
                const elements: [string, Uint16Array][] = Object.entries(chunksRecord).map(
                    ([k, v]) => [k, new Uint16Array(v as number[])]
                );
                await setMany(elements);
                self.postMessage({ id, type: 'IMPORT_ALL_RES', payload: true });
                break;
            }
        }
    } catch (error) {
        console.error('[StorageWorker] Error handling message', type, error);
        self.postMessage({ id, type: `${type}_ERR`, error: String(error) });
    }
};
