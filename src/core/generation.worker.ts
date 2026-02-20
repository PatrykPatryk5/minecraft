import * as Comlink from 'comlink';
import { generateChunk, initSeed } from './terrainGen';
import { generateEndChunk, generateNetherChunk } from './dimensionGen';

export class TerrainWorker {
    initSeed(seed: number) {
        initSeed(seed);
    }

    generate(cx: number, cz: number, dimension: string) {
        let data: Uint16Array;
        if (dimension === 'end') {
            data = generateEndChunk(cx, cz);
        } else if (dimension === 'nether') {
            data = generateNetherChunk(cx, cz);
        } else {
            data = generateChunk(cx, cz);
        }

        // Return the data and mark the buffer as transferable for zero-copy performance
        return Comlink.transfer(data, [data.buffer]);
    }
}

Comlink.expose(new TerrainWorker());
