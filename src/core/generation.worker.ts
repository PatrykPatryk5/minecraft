
import { generateChunk, generateEndChunk, initSeed } from './terrainGen';

// Helper to handle messages
const ctx: Worker = self as any;

ctx.onmessage = (e: MessageEvent) => {
    const { type, cx, cz, id, seed, dimension } = e.data;

    if (type === 'init') {
        if (typeof seed === 'number') {
            initSeed(seed);
        }
        ctx.postMessage({ type: 'ready' });
        return;
    }

    if (cx !== undefined && cz !== undefined) {
        // Generate chunk data
        let data;
        if (dimension === 'end') {
            data = generateEndChunk(cx, cz);
        } else {
            // Default overworld
            data = generateChunk(cx, cz);
        }

        // Send back (transfer buffer for performance)
        ctx.postMessage(
            { cx, cz, id, data, dimension },
            [data.buffer] // Zero-copy transfer
        );
    }
};
