import React, { useEffect, useRef } from 'react';
import useGameStore from '../store/gameStore';
import { getCachedRendererCaps } from '../core/renderer';

const DebugScreen: React.FC = () => {
    const showDebug = useGameStore((s) => s.showDebug);
    const toggleDebug = useGameStore((s) => s.toggleDebug);
    const renderDistance = useGameStore((s) => s.renderDistance);
    const gameMode = useGameStore((s) => s.gameMode);
    const fov = useGameStore((s) => s.fov);

    const fpsRef = useRef<HTMLSpanElement>(null);
    const xyzRef = useRef<HTMLSpanElement>(null);
    const blockRef = useRef<HTMLSpanElement>(null);
    const chunkRef = useRef<HTMLSpanElement>(null);
    const loadedRef = useRef<HTMLSpanElement>(null);
    const timeRef = useRef<HTMLSpanElement>(null);
    const itemsRef = useRef<HTMLSpanElement>(null);

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

            if (fpsRef.current) fpsRef.current.textContent = String(lastFpsVal);
            if (xyzRef.current) xyzRef.current.textContent = `${x.toFixed(2)} / ${y.toFixed(2)} / ${z.toFixed(2)}`;
            if (blockRef.current) blockRef.current.textContent = `${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z)}`;
            if (chunkRef.current) chunkRef.current.textContent = `${cx} / ${cz}`;
            if (loadedRef.current) loadedRef.current.textContent = String(chunkCount);
            if (timeRef.current) timeRef.current.textContent = `${timeH}:${timeM}`;
            if (itemsRef.current) itemsRef.current.textContent = String(totalItems);

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
    const seed = useGameStore.getState().worldSeed;

    return (
        <div className="debug-screen">
            <div className="debug-left">
                <p><strong>Minecraft R3F</strong> v2.0 (React 19 + Three.js)</p>
                <p><strong ref={fpsRef}>0</strong> FPS | {rendererLabel}</p>
                <p>GPU: {gpuName}</p>
                <p>Max Texture: {maxTex}px</p>
                <p>&nbsp;</p>
                <p>XYZ: <span ref={xyzRef}>0.00 / 0.00 / 0.00</span></p>
                <p>Block: <span ref={blockRef}>0 0 0</span></p>
                <p>Chunk: <span ref={chunkRef}>0 / 0</span></p>
                <p>Loaded: <strong ref={loadedRef}>0</strong> chunks</p>
                <p>Render Distance: {renderDistance} | FOV: {fov}°</p>
                <p>Time: <span ref={timeRef}>00:00</span></p>
                <p>Mode: <strong>{gameMode.toUpperCase()}</strong></p>
                <p>Items: <span ref={itemsRef}>0</span> | Seed: {seed}</p>
                <p>&nbsp;</p>
                <p>E — inventory | C — crafting | ESC — pause</p>
            </div>
        </div>
    );
};

export default DebugScreen;
