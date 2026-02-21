import React, { useEffect, useRef } from 'react';
import useGameStore from '../store/gameStore';
import { getCachedRendererCaps } from '../core/renderer';
import { getBiome } from '../core/terrainGen';
import { BLOCK_DATA } from '../core/blockTypes';

const DebugScreen: React.FC = () => {
    const showDebug = useGameStore((s) => s.showDebug);
    const toggleDebug = useGameStore((s) => s.toggleDebug);
    const renderDistance = useGameStore((s) => s.renderDistance);
    const gameMode = useGameStore((s) => s.gameMode);
    const fov = useGameStore((s) => s.fov);
    const dimension = useGameStore((s) => s.dimension);
    const worldSeed = useGameStore((s) => s.worldSeed);
    const mobsCount = useGameStore((s) => s.mobs.length);
    const itemsCount = useGameStore((s) => s.droppedItems.length);

    const fpsRef = useRef<HTMLSpanElement>(null);
    const xyzRef = useRef<HTMLSpanElement>(null);
    const blockRef = useRef<HTMLSpanElement>(null);
    const facingRef = useRef<HTMLSpanElement>(null);
    const lookingAtRef = useRef<HTMLSpanElement>(null);
    const chunkRef = useRef<HTMLSpanElement>(null);
    const loadedRef = useRef<HTMLSpanElement>(null);
    const timeRef = useRef<HTMLSpanElement>(null);
    const itemsRef = useRef<HTMLSpanElement>(null);
    const biomeRef = useRef<HTMLSpanElement>(null);
    const memRef = useRef<HTMLSpanElement>(null);
    const entitiesRef = useRef<HTMLSpanElement>(null);
    const speedRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.code === 'F3') { e.preventDefault(); toggleDebug(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [toggleDebug]);

    useEffect(() => {
        if (!showDebug) return;

        let count = 0;
        let lastFpsTime = performance.now();
        let lastFpsVal = 0;
        let id: number;

        const tick = () => {
            count++;
            const now = performance.now();

            if (now - lastFpsTime >= 1000) {
                lastFpsVal = count;
                count = 0;
                lastFpsTime = now;
            }

            const state = useGameStore.getState();
            const [x, y, z] = state.playerPos;
            const cx = Math.floor(x / 16);
            const cz = Math.floor(z / 16);

            const chunkCount = Object.keys(state.chunks).length;
            const timeH = String(Math.floor(state.dayTime * 24)).padStart(2, '0');
            const timeM = String(Math.floor((state.dayTime * 24 * 60) % 60)).padStart(2, '0');
            const totalItems = [...state.hotbar, ...state.inventory].reduce((sum, sl) => sum + (sl.id ? sl.count : 0), 0);
            const totalEntities = state.mobs.length + state.droppedItems.length + state.primedTNT.length + state.fallingBlocks.length;

            if (fpsRef.current) fpsRef.current.textContent = String(lastFpsVal);
            if (xyzRef.current) xyzRef.current.textContent = `${x.toFixed(2)} / ${y.toFixed(2)} / ${z.toFixed(2)}`;
            if (blockRef.current) blockRef.current.textContent = `${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z)}`;
            if (chunkRef.current) chunkRef.current.textContent = `${cx} / ${cz}`;
            if (loadedRef.current) loadedRef.current.textContent = String(chunkCount);
            if (timeRef.current) timeRef.current.textContent = `${timeH}:${timeM}`;
            if (itemsRef.current) itemsRef.current.textContent = String(totalItems);
            if (entitiesRef.current) entitiesRef.current.textContent = String(totalEntities);

            if (speedRef.current) {
                const vel = state.playerVel || [0, 0, 0];
                const speed = Math.sqrt(vel[0] * vel[0] + vel[1] * vel[1] + vel[2] * vel[2]);
                speedRef.current.textContent = speed.toFixed(2);
            }

            // Facing direction
            const rotY = ((state.playerRot[0] % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
            let facing = 'North (Towards -Z)';
            if (rotY < Math.PI / 4 || rotY >= 7 * Math.PI / 4) facing = 'South (Towards +Z)';
            else if (rotY < 3 * Math.PI / 4) facing = 'West (Towards -X)';
            else if (rotY < 5 * Math.PI / 4) facing = 'North (Towards -Z)';
            else facing = 'East (Towards +X)';
            if (facingRef.current) facingRef.current.textContent = facing;

            // Biome
            if (biomeRef.current) {
                const biome = getBiome(Math.floor(x), Math.floor(z));
                biomeRef.current.textContent = biome.charAt(0).toUpperCase() + biome.slice(1);
            }

            // Memory
            if (memRef.current && (performance as any).memory) {
                const mem = (performance as any).memory;
                const used = Math.round(mem.usedJSHeapSize / 1048576);
                const total = Math.round(mem.totalJSHeapSize / 1048576);
                memRef.current.textContent = `${used}MB / ${total}MB`;
            }

            // Looking at info
            if (lookingAtRef.current) {
                const look = state.lookingAt;
                if (look) {
                    const block = state.getBlock(look[0], look[1], look[2]);
                    const name = block ? (BLOCK_DATA[block]?.name ?? 'Unknown') : 'Air';
                    lookingAtRef.current.textContent = `${name} (id:${block}) (${look[0]}, ${look[1]}, ${look[2]})`;
                } else {
                    lookingAtRef.current.textContent = 'None';
                }
            }

            id = requestAnimationFrame(tick);
        };
        id = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(id);
    }, [showDebug]);

    if (!showDebug) return null;

    const caps = getCachedRendererCaps();
    const rendererLabel = caps?.label ?? 'Detecting...';
    const gpuName = caps?.gpuName ?? 'Unknown';
    const maxTex = caps?.maxTextureSize ?? '?';

    return (
        <div className="debug-screen">
            <div className="debug-left">
                <p><strong>Minecraft R3F</strong> v4.0 (React 19 + Three.js)</p>
                <p><strong ref={fpsRef}>0</strong> FPS | {rendererLabel}</p>
                <p>GPU: {gpuName}</p>
                <p>Max Texture: {maxTex}px</p>
                {(performance as any).memory && <p>Memory: <span ref={memRef}>0 / 0</span></p>}
                <p>&nbsp;</p>
                <p>Dimension: <strong>{dimension.toUpperCase()}</strong></p>
                <p>Biome: <span ref={biomeRef}>Plains</span></p>
                <p>XYZ: <span ref={xyzRef}>0.00 / 0.00 / 0.00</span></p>
                <p>Block: <span ref={blockRef}>0 0 0</span></p>
                <p>Chunk: <span ref={chunkRef}>0 / 0</span></p>
                <p>Facing: <span ref={facingRef}>South</span></p>
                <p>Speed: <span ref={speedRef}>0.00</span> m/s</p>
                <p>E: <span ref={entitiesRef}>0</span> / {mobsCount + itemsCount}</p>
                <p>Looking at: <strong ref={lookingAtRef}>None</strong></p>
                <p>Loaded: <strong ref={loadedRef}>0</strong> chunks</p>

                <p>Render Distance: {renderDistance} | FOV: {fov}°</p>
                <p>Time: <span ref={timeRef}>00:00</span></p>
                <p>Mode: <strong>{gameMode.toUpperCase()}</strong></p>
                <p>Items: <span ref={itemsRef}>0</span> | Seed: {worldSeed}</p>
                <p>&nbsp;</p>
                <p>E — inventory | C — crafting | ESC — pause</p>
            </div>
        </div>
    );
};

export default DebugScreen;
