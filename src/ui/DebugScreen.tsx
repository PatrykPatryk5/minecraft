/**
 * Debug Screen (F3) — shows game mode, seed, overlay state, item count
 */

import React, { useEffect } from 'react';
import useGameStore from '../store/gameStore';
import { getCachedRendererCaps } from '../core/renderer';

const DebugScreen: React.FC = () => {
    const showDebug = useGameStore((s) => s.showDebug);
    const toggleDebug = useGameStore((s) => s.toggleDebug);
    const playerPos = useGameStore((s) => s.playerPos);
    const fps = useGameStore((s) => s.fps);
    const setFps = useGameStore((s) => s.setFps);
    const renderDistance = useGameStore((s) => s.renderDistance);
    const dayTime = useGameStore((s) => s.dayTime);
    const fov = useGameStore((s) => s.fov);
    const gameMode = useGameStore((s) => s.gameMode);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.code === 'F3') { e.preventDefault(); toggleDebug(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [toggleDebug]);

    useEffect(() => {
        let count = 0;
        let last = performance.now();
        let id: number;
        const tick = () => {
            count++;
            const now = performance.now();
            if (now - last >= 1000) { setFps(count); count = 0; last = now; }
            id = requestAnimationFrame(tick);
        };
        id = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(id);
    }, [setFps]);

    if (!showDebug) return null;

    const [x, y, z] = playerPos;
    const cx = Math.floor(x / 16);
    const cz = Math.floor(z / 16);
    const state = useGameStore.getState();
    const chunkCount = Object.keys(state.chunks).length;
    const timeH = String(Math.floor(dayTime * 24)).padStart(2, '0');
    const timeM = String(Math.floor((dayTime * 24 * 60) % 60)).padStart(2, '0');

    const caps = getCachedRendererCaps();
    const rendererLabel = caps?.label ?? 'Detecting...';
    const gpuName = caps?.gpuName ?? 'Unknown';
    const maxTex = caps?.maxTextureSize ?? '?';

    // Count total items
    const totalItems = [...state.hotbar, ...state.inventory].reduce((sum, sl) => sum + (sl.id ? sl.count : 0), 0);

    return (
        <div className="debug-screen">
            <div className="debug-left">
                <p><strong>Minecraft R3F</strong> v2.0 (React 19 + Three.js)</p>
                <p><strong>{fps}</strong> FPS | {rendererLabel}</p>
                <p>GPU: {gpuName}</p>
                <p>Max Texture: {maxTex}px</p>
                <p>&nbsp;</p>
                <p>XYZ: {x.toFixed(2)} / {y.toFixed(2)} / {z.toFixed(2)}</p>
                <p>Block: {Math.floor(x)} {Math.floor(y)} {Math.floor(z)}</p>
                <p>Chunk: {cx} / {cz}</p>
                <p>Loaded: <strong>{chunkCount}</strong> chunks</p>
                <p>Render Distance: {renderDistance} | FOV: {fov}°</p>
                <p>Time: {timeH}:{timeM}</p>
                <p>Mode: <strong>{gameMode.toUpperCase()}</strong></p>
                <p>Items: {totalItems} | Seed: {state.worldSeed}</p>
                <p>&nbsp;</p>
                <p>E — inventory | C — crafting | ESC — pause</p>
            </div>
        </div>
    );
};

export default DebugScreen;
