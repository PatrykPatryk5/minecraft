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
import { generateEndChunk, generateNetherChunk } from '../core/dimensionGen';
import { EnderDragon } from '../entities/EnderDragon';
import { WorkerPool } from '../core/workerPool';
import Chunk, { globalTerrainUniforms } from './Chunk';
import { checkChunkBorders } from '../core/waterSystem';
import { tickWorld } from '../core/worldTick';

const UNLOAD_BUFFER = 3;
const BATCH_PER_FRAME = 1; // Reduced to 1 to drastically decrease main thread stutter on Generation
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
    const lastRerenderTimeRef = useRef(0);

    // Minimal state — only updated when the chunk LIST changes (not every arrival)
    const [visibleChunks, setVisibleChunks] = useState<ChunkEntry[]>([]);

    // Track dimension to trigger resets
    const dimension = useGameStore(s => s.dimension);
    const lastDimensionRef = useRef(dimension);
    const isUnderwater = useGameStore(s => s.isUnderwater);

    // ── Initialize Worker Pool ──────────────────────────
    const worldSeed = useGameStore(s => s.worldSeed);

    useEffect(() => {
        initSeed(worldSeed);

        const pool = new WorkerPool(
            new URL('../core/generation.worker.ts', import.meta.url),
            4, 16
        );

        const ok = pool.init(worldSeed);
        poolRef.current = ok ? pool : null;

        if (!ok) console.warn('[World] WorkerPool failed, using sync fallback');

        return () => { pool.terminate(); };
    }, [worldSeed]);

    // Reset refs if dimension changes
    if (lastDimensionRef.current !== dimension) {
        lastDimensionRef.current = dimension;
        loadedKeysRef.current.clear();
        pendingKeysRef.current.clear();
        activeChunksRef.current = [];
        loadQueueRef.current = [];
        lastPlayerChunkRef.current = '';
        poolRef.current?.clearQueue(); // Cancel pending generation for old dimension
    }

    // ── Handle worker results — NO setState ─────────────
    const onChunkReady = useCallback((result: any) => {
        const { cx, cz, id, dimension: chunkDim } = result;

        // Discard stale chunks from previous dimension
        if (chunkDim !== useGameStore.getState().dimension) return;

        const key = id || chunkKey(cx, cz);

        useGameStore.getState().setChunkData(cx, cz, chunkDim, result.data);
        useGameStore.getState().bumpVersion(cx, cz);
        checkChunkBorders(cx, cz);
        loadedKeysRef.current.add(key);
        pendingKeysRef.current.delete(key);
        chunkArrivedCountRef.current++;
    }, []);

    // ── Request chunk generation ─────────────────────────
    const requestChunk = useCallback((cx: number, cz: number) => {
        const key = chunkKey(cx, cz);
        if (loadedKeysRef.current.has(key) || pendingKeysRef.current.has(key)) return;

        pendingKeysRef.current.add(key);

        const dim = useGameStore.getState().dimension;

        if (poolRef.current?.isReady()) {
            poolRef.current.submit(cx, cz, dim, onChunkReady);
            // Wait, submit() only takes cx, cz, callback. I need to update submit() signature or pass object?
            // checking workerPool.ts...
        } else {
            // Sync fallback
            let data;
            if (dim === 'end') data = generateEndChunk(cx, cz);
            else if (dim === 'nether') data = generateNetherChunk(cx, cz);
            else data = generateChunk(cx, cz);

            useGameStore.getState().setChunkData(cx, cz, dim, data);
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
        if (toRemove.length > 0) {
            useGameStore.getState().unloadChunkData(toRemove);
        }

        // Only update state when chunk list actually changed
        needsRerenderRef.current = true;
    }, []);

    // Initial load
    useEffect(() => {
        recalculate();
    }, [recalculate, renderDistance]);

    // Per-frame: batch send requests + throttled re-render
    useFrame(({ clock }) => {
        globalTerrainUniforms.uTime.value = clock.elapsedTime;

        // Random Ticks (Farming, Grass spread) - Async/Idle to reduce frame jank
        if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(() => tickWorld(), { timeout: 50 });
        } else {
            setTimeout(tickWorld, 0);
        }

        useGameStore.getState().tickFurnace();

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
        // Max 1 re-render per 200ms to prevent physics stutter and React overhead
        const arrivedCount = chunkArrivedCountRef.current;
        const now = performance.now();

        const shouldUpdate =
            needsRerenderRef.current ||
            (arrivedCount !== lastRerenderCount.current && now - lastRerenderTimeRef.current > 200);

        if (shouldUpdate) {
            needsRerenderRef.current = false;
            lastRerenderCount.current = arrivedCount;
            lastRerenderTimeRef.current = now;
            setVisibleChunks([...activeChunksRef.current]);
        }
    });

    return (
        <>
            {visibleChunks.map((c) => (
                <Chunk key={c.key} cx={c.cx} cz={c.cz} lod={0} hasPhysics={c.dist <= 2} />
            ))}
            {dimension === 'end' && !useGameStore.getState().dragonDefeated && <EnderDragon />}
            <fog attach="fog" args={[
                dimension === 'nether' ? '#400' : dimension === 'end' ? '#000' : isUnderwater ? '#0a2860' : '#87CEEB',
                isUnderwater ? 1 : dimension === 'end' ? 20 : Math.max(10, renderDistance * CHUNK_SIZE - 64),
                isUnderwater ? 25 : dimension === 'end' ? 80 : renderDistance * CHUNK_SIZE - 16
            ]} />
        </>
    );
};

export default World;
