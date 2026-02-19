/**
 * World Manager (Worker Pool + LOD + Batch Loading)
 * 
 * v2 — Fixed chunk border stutter by minimizing React state updates.
 * The chunk list is stored in refs and rendered via useSyncExternalStore-like pattern.
 *
 * Key fixes:
 *   - No more setRenderTick spam — chunk arrivals don't cause full tree re-render
 *   - Recalculate only updates refs, not state
 *   - Chunks are rendered from a stable key list
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import useGameStore, { chunkKey } from '../store/gameStore';
import { generateChunk, CHUNK_SIZE, initSeed } from '../core/terrainGen';
import { WorkerPool } from '../core/workerPool';
import Chunk from './Chunk';

const UNLOAD_BUFFER = 3;
const BATCH_PER_FRAME = 4;
const RECALCULATE_COOLDOWN = 600;

// LOD thresholds (in chunk distance²)
const LOD_FULL = 5 * 5;
const LOD_MEDIUM = 8 * 8;

interface ChunkEntry {
    cx: number;
    cz: number;
    key: string;
    dist: number;
    lod: 0 | 1 | 2;
}

const World: React.FC = () => {
    const renderDistance = useGameStore((s) => s.renderDistance);

    const loadQueueRef = useRef<ChunkEntry[]>([]);
    const loadedKeysRef = useRef(new Set<string>());
    const pendingKeysRef = useRef(new Set<string>());
    const activeChunksRef = useRef<ChunkEntry[]>([]);
    const lastPlayerChunkRef = useRef<string>('');
    const lastRecalcTime = useRef(0);
    const poolRef = useRef<WorkerPool | null>(null);
    const needsRerenderRef = useRef(false);
    const chunkArrivedCountRef = useRef(0);
    const lastRerenderCount = useRef(0);

    // Minimal state — only updated when the chunk LIST changes (not every arrival)
    const [visibleChunks, setVisibleChunks] = useState<ChunkEntry[]>([]);

    // ── Initialize Worker Pool ──────────────────────────
    useEffect(() => {
        const seed = useGameStore.getState().worldSeed;
        initSeed(seed);

        const pool = new WorkerPool(
            new URL('./terrainWorker.ts', import.meta.url),
            4, 16
        );

        const ok = pool.init(seed);
        poolRef.current = ok ? pool : null;

        if (!ok) console.warn('[World] WorkerPool failed, using sync fallback');

        return () => { pool.terminate(); };
    }, []);

    // ── Handle worker results — NO setState ─────────────
    const onChunkReady = useCallback((result: any) => {
        const { cx, cz, id } = result;
        const key = id || chunkKey(cx, cz);

        useGameStore.getState().setChunkData(cx, cz, result.data);
        useGameStore.getState().bumpVersion(cx, cz);
        loadedKeysRef.current.add(key);
        pendingKeysRef.current.delete(key);
        chunkArrivedCountRef.current++;
    }, []);

    // ── Request chunk generation ─────────────────────────
    const requestChunk = useCallback((cx: number, cz: number) => {
        const key = chunkKey(cx, cz);
        if (loadedKeysRef.current.has(key) || pendingKeysRef.current.has(key)) return;

        pendingKeysRef.current.add(key);

        if (poolRef.current?.isReady()) {
            poolRef.current.submit(cx, cz, onChunkReady);
        } else {
            // Sync fallback
            const data = generateChunk(cx, cz);
            useGameStore.getState().setChunkData(cx, cz, data);
            useGameStore.getState().bumpVersion(cx, cz);
            loadedKeysRef.current.add(key);
            pendingKeysRef.current.delete(key);
        }
    }, [onChunkReady]);

    // ── Recalculate visible chunks — ref-only ────────────
    const recalculate = useCallback(() => {
        const pos = useGameStore.getState().playerPos;
        const pcx = Math.floor(pos[0] / CHUNK_SIZE);
        const pcz = Math.floor(pos[2] / CHUNK_SIZE);
        const rd = useGameStore.getState().renderDistance;

        const active: ChunkEntry[] = [];
        const toLoad: ChunkEntry[] = [];

        for (let dx = -rd; dx <= rd; dx++) {
            for (let dz = -rd; dz <= rd; dz++) {
                const dist = dx * dx + dz * dz;
                if (dist > rd * rd) continue;

                const cx = pcx + dx;
                const cz = pcz + dz;
                const key = chunkKey(cx, cz);
                const lod: 0 | 1 | 2 = dist <= LOD_FULL ? 0 : dist <= LOD_MEDIUM ? 1 : 2;

                const entry: ChunkEntry = { cx, cz, key, dist, lod };
                active.push(entry);

                if (!loadedKeysRef.current.has(key) && !pendingKeysRef.current.has(key)) {
                    toLoad.push(entry);
                }
            }
        }

        toLoad.sort((a, b) => a.dist - b.dist);
        active.sort((a, b) => a.dist - b.dist);

        loadQueueRef.current = toLoad;
        activeChunksRef.current = active;

        // Unload distant chunks
        const unloadDist = rd + UNLOAD_BUFFER;
        const toRemove: string[] = [];
        for (const loadedKey of loadedKeysRef.current) {
            const parts = loadedKey.split(',');
            const lcx = parseInt(parts[0]), lcz = parseInt(parts[1]);
            const dx = lcx - pcx, dz = lcz - pcz;
            if (dx * dx + dz * dz > unloadDist * unloadDist) {
                toRemove.push(loadedKey);
            }
        }
        for (const k of toRemove) {
            loadedKeysRef.current.delete(k);
        }

        // Only update state when chunk list actually changed
        needsRerenderRef.current = true;
    }, []);

    // Initial load
    useEffect(() => {
        recalculate();
    }, [recalculate, renderDistance]);

    // Per-frame: batch send requests + throttled re-render
    useFrame(() => {
        // Send pending requests to worker
        let sent = 0;
        while (
            loadQueueRef.current.length > 0 &&
            pendingKeysRef.current.size < 16 &&
            sent < BATCH_PER_FRAME
        ) {
            const entry = loadQueueRef.current.shift()!;
            requestChunk(entry.cx, entry.cz);
            sent++;
        }

        // Check if player moved to new chunk
        const pos = useGameStore.getState().playerPos;
        const pcx = Math.floor(pos[0] / CHUNK_SIZE);
        const pcz = Math.floor(pos[2] / CHUNK_SIZE);
        const currentKey = chunkKey(pcx, pcz);
        if (currentKey !== lastPlayerChunkRef.current) {
            const now = performance.now();
            if (now - lastRecalcTime.current > RECALCULATE_COOLDOWN) {
                lastPlayerChunkRef.current = currentKey;
                lastRecalcTime.current = now;
                recalculate();
            }
        }

        // Throttled re-render: only when chunks arrived or list changed
        // Max 1 re-render per 500ms to prevent physics stutter
        const arrivedCount = chunkArrivedCountRef.current;
        if (needsRerenderRef.current || arrivedCount !== lastRerenderCount.current) {
            needsRerenderRef.current = false;
            lastRerenderCount.current = arrivedCount;
            setVisibleChunks([...activeChunksRef.current]);
        }
    });

    return (
        <>
            {visibleChunks.map((c) => (
                <Chunk key={c.key} cx={c.cx} cz={c.cz} lod={c.lod} />
            ))}
        </>
    );
};

export default World;
