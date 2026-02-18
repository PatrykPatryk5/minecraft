/**
 * Terrain Generation Web Worker
 *
 * Runs chunk generation in a separate thread so the main
 * thread never freezes. Receives {cx, cz} requests and
 * returns generated ChunkData.
 */

import { generateChunk, initSeed } from '../core/terrainGen';

// ─── Worker message handler ──────────────────────────────
self.onmessage = (e: MessageEvent) => {
    const { type, cx, cz, id, seed } = e.data;

    // Handle seed initialization
    if (type === 'init') {
        initSeed(seed);
        (self as any).postMessage({ type: 'ready' });
        return;
    }

    const data = generateChunk(cx, cz);

    // Transfer the Uint16Array buffer to main thread (zero-copy)
    // We must pass the buffer in the transfer list (2nd argument)
    (self as any).postMessage(
        { cx, cz, id, data },
        [data.buffer]
    );
};
