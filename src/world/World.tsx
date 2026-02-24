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
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore, { chunkKey } from '../store/gameStore';
import { generateChunk, CHUNK_SIZE, initSeed } from '../core/terrainGen';
import { generateEndChunk, generateNetherChunk } from '../core/dimensionGen';
import { EnderDragon } from '../entities/EnderDragon';
import { WorkerPool, getWorkerPool } from '../core/workerPool';
import TerrainWorker from '../core/generation.worker?worker';
import Chunk from './Chunk';
import { globalTerrainUniforms } from '../core/constants';
import { checkChunkBorders } from '../core/waterSystem';
import { tickWorld } from '../core/worldTick';

const UNLOAD_BUFFER = 3;
const BATCH_PER_FRAME = 3; // Increased for faster throughput
const RECALCULATE_COOLDOWN = 300;
const WORLD_TICK_INTERVAL_MS = 50;
const FURNACE_TICK_INTERVAL_MS = 50;

// LOD thresholds (in chunk distance²)
// LOD thresholds (in chunk distance²) - increased for better far-distance accuracy
const LOD_FULL = 8 * 8;
const LOD_MEDIUM = 12 * 12;

interface ChunkEntry {
    cx: number;
    cz: number;
    key: string;
    dist: number;
    lod: 0 | 1 | 2;
}


const World: React.FC = () => {
    const { camera } = useThree();
    const renderDistance = useGameStore((s) => s.renderDistance);

    const loadQueueRef = useRef<ChunkEntry[]>([]);
    const loadedKeysRef = useRef(new Set<string>());
    const pendingKeysRef = useRef(new Set<string>());
    const activeChunksRef = useRef<ChunkEntry[]>([]);
    const lastPlayerChunkRef = useRef<string>('');
    const lastRecalcTime = useRef(0);
    const needsRerenderRef = useRef(false);
    const chunkArrivedCountRef = useRef(0);
    const lastRerenderCount = useRef(0);
    const lastRerenderTimeRef = useRef(0);
    const lastWorldTickRef = useRef(0);
    const worldTickQueuedRef = useRef(false);
    const lastFurnaceTickRef = useRef(0);

    // Minimal state — only updated when the chunk LIST changes (not every arrival)
    const [visibleChunks, setVisibleChunks] = useState<ChunkEntry[]>([]);

    // Track dimension to trigger resets
    const dimension = useGameStore(s => s.dimension);
    const lastDimensionRef = useRef(dimension);
    const isUnderwater = useGameStore(s => s.isUnderwater);

    // ── Initialize Worker Pool ──────────────────────────
    const worldSeed = useGameStore(s => s.worldSeed);

    const scheduleWorldTick = useCallback(() => {
        if (worldTickQueuedRef.current) return;
        worldTickQueuedRef.current = true;

        const run = () => {
            worldTickQueuedRef.current = false;
            tickWorld();
        };

        if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(run, { timeout: 25 });
        } else {
            setTimeout(run, 0);
        }
    }, []);

    useEffect(() => {
        initSeed(worldSeed);

        const poolSize = Math.min(navigator.hardwareConcurrency || 6, 8);
        const pool = new WorkerPool(
            TerrainWorker,
            poolSize, poolSize * 2
        );

        const ok = pool.init(worldSeed);
        // WorkerPool.init now sets globalPool automatically

        if (ok) {
            import('../core/textures').then(({ getAtlasTexture, getAllAtlasUVs }) => {
                getAtlasTexture(); // Ensure init
                const uvs = getAllAtlasUVs();
                pool.initUVs(uvs);
            });
        } else {
            console.warn('[World] WorkerPool failed, using sync fallback');
        }

        return () => {
            pool.terminate();
            // globalPool = null;
        };
    }, [worldSeed]);

    // Reset refs if dimension changes
    if (lastDimensionRef.current !== dimension) {
        lastDimensionRef.current = dimension;
        loadedKeysRef.current.clear();
        pendingKeysRef.current.clear();
        activeChunksRef.current = [];
        loadQueueRef.current = [];
        lastPlayerChunkRef.current = '';
        getWorkerPool()?.clearQueue(); // Cancel pending generation for old dimension
    }

    // ── Handle worker results — NO setState ─────────────
    const onChunkReady = useCallback((result: any) => {
        if (!result) return;
        const { cx, cz, dimension: chunkDim } = result;
        const key = chunkKey(cx, cz);

        // always clear pending flag immediately so we don't leak when
        // the result belongs to a stale dimension or an errored task
        pendingKeysRef.current.delete(key);

        // Discard stale chunks from previous dimension
        if (chunkDim !== useGameStore.getState().dimension) return;

        const s = useGameStore.getState();

        s.setChunkData(cx, cz, chunkDim, result.data);

        checkChunkBorders(cx, cz);
        loadedKeysRef.current.add(key);
        chunkArrivedCountRef.current++;
    }, []);

    // ── Request chunk generation ─────────────────────────
    const requestChunk = useCallback((cx: number, cz: number) => {
        const key = chunkKey(cx, cz);
        if (loadedKeysRef.current.has(key) || pendingKeysRef.current.has(key)) return;

        pendingKeysRef.current.add(key);

        const dim = useGameStore.getState().dimension;

        const pool = getWorkerPool();
        if (pool?.isReady()) {
            pool.submit(cx, cz, dim, (result) => {
                if (!result) {
                    pendingKeysRef.current.delete(key);
                    const known = loadQueueRef.current.some((e) => e.key === key);
                    if (!known) {
                        const active = activeChunksRef.current.find((e) => e.key === key);
                        if (active) loadQueueRef.current.unshift(active);
                    }
                    return;
                }
                onChunkReady(result);
            });
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

        // FOV Prioritization: get camera forward vector
        const cameraDir = new THREE.Vector3();
        camera.getWorldDirection(cameraDir);
        const dirX = cameraDir.x;
        const dirZ = cameraDir.z;

        const active: ChunkEntry[] = [];
        const toLoad: ChunkEntry[] = [];

        for (let dx = -rd; dx <= rd; dx++) {
            for (let dz = -rd; dz <= rd; dz++) {
                const distSq = dx * dx + dz * dz;
                if (distSq > rd * rd) continue;

                // Dot product for FOV prioritization
                const chunkDist = Math.sqrt(distSq) || 0.1;
                // Vector to chunk (dx, dz) - normalize it
                const dot = (-dx * dirX + -dz * dirZ) / chunkDist;

                // Prioritize chunks in front, except for immediate vicinity (3x3 area)
                const fovWeight = distSq < 9 ? 1 : (dot > 0 ? (0.5 + (1 - dot) * 0.5) : (1.5 - dot * 0.5));
                const priorityDist = chunkDist * fovWeight;

                const cx = pcx + dx;
                const cz = pcz + dz;
                const key = chunkKey(cx, cz);
                const lod: 0 | 1 | 2 = distSq <= LOD_FULL ? 0 : distSq <= LOD_MEDIUM ? 1 : 2;

                const entry: ChunkEntry = { cx, cz, key, dist: priorityDist, lod };
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

    useEffect(() => {
        const now = performance.now();
        lastWorldTickRef.current = now;
        lastFurnaceTickRef.current = now;
    }, []);

    // Per-frame: batch send requests + throttled re-render
    useFrame(({ clock }) => {
        globalTerrainUniforms.uTime.value = clock.elapsedTime;

        const frameNow = performance.now();

        // Keep world random ticks at a fixed cadence (avoid scheduling every frame).
        if (frameNow - lastWorldTickRef.current >= WORLD_TICK_INTERVAL_MS) {
            lastWorldTickRef.current = frameNow;
            scheduleWorldTick();
        }

        // Furnace logic should follow game ticks, not render FPS.
        const furnaceDelta = frameNow - lastFurnaceTickRef.current;
        if (furnaceDelta >= FURNACE_TICK_INTERVAL_MS) {
            const steps = Math.min(4, Math.floor(furnaceDelta / FURNACE_TICK_INTERVAL_MS));
            lastFurnaceTickRef.current += steps * FURNACE_TICK_INTERVAL_MS;
            const state = useGameStore.getState();
            for (let i = 0; i < steps; i++) {
                state.tickFurnace();
            }
        }

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

        // Retry safety: if a visible chunk is neither loaded nor pending, queue it again.
        for (let i = 0; i < activeChunksRef.current.length && sent < BATCH_PER_FRAME; i++) {
            const c = activeChunksRef.current[i];
            if (!loadedKeysRef.current.has(c.key) && !pendingKeysRef.current.has(c.key)) {
                requestChunk(c.cx, c.cz);
                sent++;
            }
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

        // Periodic queue re-sort (every ~60 frames) to keep priorities fresh even within same chunk
        if (loadQueueRef.current.length > 1 && Math.floor(clock.elapsedTime * 60) % 60 === 0) {
            const pcx = Math.floor(pos[0] / CHUNK_SIZE);
            const pcz = Math.floor(pos[2] / CHUNK_SIZE);

            // Re-calculate dist for current orientation
            const cameraDir = new THREE.Vector3();
            camera.getWorldDirection(cameraDir);
            const dirX = cameraDir.x;
            const dirZ = cameraDir.z;

            loadQueueRef.current.sort((a, b) => {
                const adx = a.cx - pcx, adz = a.cz - pcz;
                const bdx = b.cx - pcx, bdz = b.cz - pcz;
                const adistSq = adx * adx + adz * adz;
                const bdistSq = bdx * bdx + bdz * bdz;

                const adot = (-adx * dirX + -adz * dirZ) / (Math.sqrt(adistSq) || 0.1);
                const bdot = (-bdx * dirX + -bdz * dirZ) / (Math.sqrt(bdistSq) || 0.1);

                const aw = adistSq < 9 ? 1 : (adot > 0 ? (0.5 + (1 - adot) * 0.5) : (1.5 - adot * 0.5));
                const bw = bdistSq < 9 ? 1 : (bdot > 0 ? (0.5 + (1 - bdot) * 0.5) : (1.5 - bdot * 0.5));

                return (Math.sqrt(adistSq) * aw) - (Math.sqrt(bdistSq) * bw);
            });
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
            {visibleChunks.map((c: ChunkEntry) => (
                <Chunk key={c.key} cx={c.cx} cz={c.cz} lod={c.lod} hasPhysics={c.dist <= 2} />
            ))}
            {dimension === 'end' && !useGameStore.getState().dragonDefeated && <EnderDragon />}
            <fog attach="fog" args={[
                dimension === 'nether' ? '#200' : dimension === 'end' ? '#000' : isUnderwater ? '#0a2860' : '#87CEEB',
                isUnderwater ? 1 : dimension === 'end' ? 30 : dimension === 'nether' ? 5 : Math.max(10, renderDistance * CHUNK_SIZE - 64),
                isUnderwater ? 25 : dimension === 'end' ? 120 : dimension === 'nether' ? 45 : renderDistance * CHUNK_SIZE - 16
            ]} />
        </>
    );
};

export default World;
