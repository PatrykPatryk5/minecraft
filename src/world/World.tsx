/**
 * World Manager (Web Worker Powered)
 *
 * Key architecture:
 *   1. Web Worker generates chunks in background thread (zero main-thread stutter)
 *   2. Worker results update Zustand store → triggers Chunk re-renders
 *   3. Chunk unloading for distant chunks (memory management)
 *   4. Priority queue — nearest chunks first
 *   5. Fallback to sync gen if worker fails
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import useGameStore, { chunkKey } from '../store/gameStore';
import { generateChunk, CHUNK_SIZE, initSeed } from '../core/terrainGen';
import Chunk from './Chunk';

const UNLOAD_BUFFER = 3;
const MAX_PENDING = 6; // max chunks being generated at once
const RECALCULATE_COOLDOWN = 1000; // ms between recalculates

interface ChunkEntry {
    cx: number;
    cz: number;
    key: string;
}

const World: React.FC = () => {
    const renderDistance = useGameStore((s) => s.renderDistance);
    const setChunkData = useGameStore((s) => s.setChunkData);
    const bumpVersion = useGameStore((s) => s.bumpVersion);

    const loadQueueRef = useRef<(ChunkEntry & { dist: number })[]>([]);
    const loadedKeysRef = useRef(new Set<string>());
    const pendingKeysRef = useRef(new Set<string>());
    const activeChunksRef = useRef<ChunkEntry[]>([]);
    const lastPlayerChunkRef = useRef<string>('');
    const lastRecalcTime = useRef(0);
    const [renderTick, setRenderTick] = React.useState(0);
    const workerRef = useRef<Worker | null>(null);
    const workerReady = useRef(false);

    // ── Initialize Web Worker ────────────────────────────
    useEffect(() => {
        try {
            const worker = new Worker(
                new URL('./terrainWorker.ts', import.meta.url),
                { type: 'module' }
            );

            worker.onmessage = (e: MessageEvent) => {
                const { type: msgType, cx, cz, data } = e.data;

                // Ignore non-chunk messages (like 'ready' from seed init)
                if (msgType === 'ready') return;

                const key = chunkKey(cx, cz);

                // Update Zustand store (triggers Chunk component re-render)
                useGameStore.getState().setChunkData(cx, cz, data);
                useGameStore.getState().bumpVersion(cx, cz);
                loadedKeysRef.current.add(key);
                pendingKeysRef.current.delete(key);

                // Trigger World re-render for new chunks
                setRenderTick((n) => n + 1);
            };

            worker.onerror = (err) => {
                console.warn('[World] Worker error, falling back to sync:', err);
                workerReady.current = false;
            };

            // Initialize seed in both main thread and worker
            const seed = useGameStore.getState().worldSeed;
            initSeed(seed);
            worker.postMessage({ type: 'init', seed });

            workerRef.current = worker;
            workerReady.current = true;
            console.log(`[World] Terrain Worker initialized with seed: ${seed}`);
        } catch (err) {
            console.warn('[World] Worker not available, using sync fallback');
            workerReady.current = false;
        }

        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    // ── Request chunk generation ─────────────────────────
    const requestChunk = useCallback((cx: number, cz: number) => {
        const key = chunkKey(cx, cz);
        if (loadedKeysRef.current.has(key) || pendingKeysRef.current.has(key)) return;

        pendingKeysRef.current.add(key);

        if (workerReady.current && workerRef.current) {
            // Async via Worker (no main thread blocking!)
            workerRef.current.postMessage({ cx, cz, id: key });
        } else {
            // Sync fallback
            const data = generateChunk(cx, cz);
            setChunkData(cx, cz, data);
            bumpVersion(cx, cz);
            loadedKeysRef.current.add(key);
            pendingKeysRef.current.delete(key);
        }
    }, [setChunkData, bumpVersion]);

    // Recalculate which chunks are needed
    const recalculate = useCallback(() => {
        const pos = useGameStore.getState().playerPos;
        const pcx = Math.floor(pos[0] / CHUNK_SIZE);
        const pcz = Math.floor(pos[2] / CHUNK_SIZE);
        const rd = useGameStore.getState().renderDistance;

        const needed = new Set<string>();
        const active: ChunkEntry[] = [];
        const toLoad: (ChunkEntry & { dist: number })[] = [];

        for (let dx = -rd; dx <= rd; dx++) {
            for (let dz = -rd; dz <= rd; dz++) {
                if (dx * dx + dz * dz > rd * rd) continue;
                const cx = pcx + dx;
                const cz = pcz + dz;
                const key = chunkKey(cx, cz);
                needed.add(key);
                active.push({ cx, cz, key });

                if (!loadedKeysRef.current.has(key) && !pendingKeysRef.current.has(key)) {
                    toLoad.push({ cx, cz, key, dist: dx * dx + dz * dz });
                }
            }
        }

        toLoad.sort((a, b) => a.dist - b.dist);
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

        setRenderTick((n) => n + 1);
    }, []);

    // Initial load
    useEffect(() => {
        recalculate();
    }, [recalculate, renderDistance]);

    // Per-frame: send chunk generation requests + check player movement
    useFrame(() => {
        // Send pending requests to worker (throttled)
        let sent = 0;
        while (
            loadQueueRef.current.length > 0 &&
            pendingKeysRef.current.size < MAX_PENDING &&
            sent < 2
        ) {
            const entry = loadQueueRef.current.shift()!;
            requestChunk(entry.cx, entry.cz);
            sent++;
        }

        // Check if player moved to new chunk (throttled)
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
    });

    return (
        <>
            {activeChunksRef.current.map((c) => (
                <Chunk key={c.key} cx={c.cx} cz={c.cz} />
            ))}
        </>
    );
};

export default World;
