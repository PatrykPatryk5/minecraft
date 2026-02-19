/**
 * Redstone Logic System
 *
 * Implements basic redstone mechanics:
 *   - Levers: toggle power on/off when right-clicked
 *   - Redstone Wire: propagates signal, decays by 1 per block
 *   - Redstone Torch: inverts signal (powered when block below is unpowered)
 *   - Redstone Lamp: lights up when receiving power
 *
 * Power levels: 0 (off) to 15 (max), decays with distance through wire.
 * Updates propagate via BFS to prevent infinite loops.
 */

import useGameStore from '../store/gameStore';
import { BlockType } from './blockTypes';
import { updatePiston } from './pistonSystem';

// ─── Types ──────────────────────────────────────────────
interface RedstoneNode {
    power: number;       // 0–15
    source: boolean;     // true if this is a power source (lever/torch)
}

// Power state indexed by "x,y,z"
const powerGrid = new Map<string, RedstoneNode>();

function key(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
}

const NEIGHBORS: [number, number, number][] = [
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1],
];

// ─── Core API ───────────────────────────────────────────

/** Toggle a lever at position; returns new power state */
export function toggleLever(x: number, y: number, z: number): boolean {
    const k = key(x, y, z);
    const node = powerGrid.get(k);
    const wasOn = node ? node.power > 0 : false;
    const newPower = wasOn ? 0 : 15;

    powerGrid.set(k, { power: newPower, source: true });
    propagateFrom(x, y, z);

    return newPower > 0;
}

/** Called when a redstone component is placed */
export function onRedstonePlaced(x: number, y: number, z: number, blockType: number): void {
    const store = useGameStore.getState();

    if (blockType === BlockType.REDSTONE_TORCH) {
        // Torch: powered unless block below is powered
        const belowPower = getPower(x, y - 1, z);
        const power = belowPower > 0 ? 0 : 15;
        powerGrid.set(key(x, y, z), { power, source: true });
        propagateFrom(x, y, z);
    } else if (blockType === BlockType.REDSTONE_WIRE) {
        // Wire: receives power from adjacent sources
        powerGrid.set(key(x, y, z), { power: 0, source: false });
        recalculateWire(x, y, z);
    } else if (blockType === BlockType.LEVER) {
        powerGrid.set(key(x, y, z), { power: 0, source: true });
    } else if (blockType === BlockType.REDSTONE_LAMP) {
        powerGrid.set(key(x, y, z), { power: 0, source: false });
        updateLamp(x, y, z);
    }
}

/** Called when a redstone component is removed */
export function onRedstoneRemoved(x: number, y: number, z: number): void {
    powerGrid.delete(key(x, y, z));
    // Recalculate neighbors
    for (const [dx, dy, dz] of NEIGHBORS) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        const nk = key(nx, ny, nz);
        if (powerGrid.has(nk)) {
            const node = powerGrid.get(nk)!;
            if (!node.source) {
                recalculateWire(nx, ny, nz);
            }
        }
    }
}

/** Get power level at a position */
export function getPower(x: number, y: number, z: number): number {
    return powerGrid.get(key(x, y, z))?.power ?? 0;
}

/** Check if position is powered (power > 0) */
export function isPowered(x: number, y: number, z: number): boolean {
    return getPower(x, y, z) > 0;
}

// ─── Internal ───────────────────────────────────────────

function propagateFrom(x: number, y: number, z: number): void {
    const visited = new Set<string>();
    const queue: [number, number, number][] = [[x, y, z]];
    visited.add(key(x, y, z));

    while (queue.length > 0) {
        const [cx, cy, cz] = queue.shift()!;

        for (const [dx, dy, dz] of NEIGHBORS) {
            const nx = cx + dx, ny = cy + dy, nz = cz + dz;
            const nk = key(nx, ny, nz);

            if (visited.has(nk)) continue;
            visited.add(nk);

            const node = powerGrid.get(nk);
            if (!node) continue;

            const store = useGameStore.getState();
            const blockAtN = store.getBlock(nx, ny, nz);

            if (blockAtN === BlockType.REDSTONE_WIRE) {
                // Wire: gets power - 1 from strongest adjacent source
                const newPower = Math.max(0, getMaxAdjacentPower(nx, ny, nz) - 1);
                if (node.power !== newPower) {
                    node.power = newPower;
                    queue.push([nx, ny, nz]);
                }
            } else if (blockAtN === BlockType.REDSTONE_LAMP) {
                updateLamp(nx, ny, nz);
            } else if (blockAtN === BlockType.REDSTONE_TORCH) {
                // Torch: inverts signal from block below
                const belowPower = getPower(nx, ny - 1, nz);
                const newPower = belowPower > 0 ? 0 : 15;
                if (node.power !== newPower) {
                    node.power = newPower;
                    queue.push([nx, ny, nz]);
                }
            } else if (blockAtN === BlockType.PISTON || blockAtN === BlockType.PISTON_STICKY) {
                const p = getMaxAdjacentPower(nx, ny, nz);
                updatePiston(nx, ny, nz, p > 0);
            }
        }
    }
}

function getMaxAdjacentPower(x: number, y: number, z: number): number {
    let maxPower = 0;
    for (const [dx, dy, dz] of NEIGHBORS) {
        const p = getPower(x + dx, y + dy, z + dz);
        if (p > maxPower) maxPower = p;
    }
    return maxPower;
}

function recalculateWire(x: number, y: number, z: number): void {
    const k = key(x, y, z);
    const node = powerGrid.get(k);
    if (!node || node.source) return;

    const newPower = Math.max(0, getMaxAdjacentPower(x, y, z) - 1);
    if (node.power !== newPower) {
        node.power = newPower;
        propagateFrom(x, y, z);
    }
}

function updateLamp(x: number, y: number, z: number): void {
    const adjacentPower = getMaxAdjacentPower(x, y, z);
    const k = key(x, y, z);
    const node = powerGrid.get(k) ?? { power: 0, source: false };
    node.power = adjacentPower;
    powerGrid.set(k, node);
    // Lamp is lit when power > 0 — visual update is handled by the renderer
    // checking isPowered()
}

/** Reset all redstone state (e.g., on world reload) */
export function resetRedstone(): void {
    powerGrid.clear();
}
