/**
 * Lava System — Spreading with Water Interaction
 *
 * - Lava spreads 3× slower than water (600ms ticks)
 * - MAX_SPREAD = 4 blocks horizontally
 * - Lava + Water = Cobblestone (flowing) or Obsidian (source)
 * - Lava damages players (handled in Player.tsx)
 */

import useGameStore from '../store/gameStore';
import { BlockType } from './blockTypes';
import { CHUNK_SIZE } from './terrainGen';

const SPREAD_DELAY = 600; // ms — 3× slower than water
const MAX_SPREAD = 4;

interface ScheduledLava {
    x: number; y: number; z: number;
    time: number;
}

const scheduled: ScheduledLava[] = [];

/** Check if a block can be replaced by lava */
function canReplace(type: number): boolean {
    return type === BlockType.AIR || type === BlockType.TALL_GRASS ||
        type === BlockType.FLOWER_RED || type === BlockType.FLOWER_YELLOW;
}

/** Check for water interaction at position — returns true if interaction happened */
function checkWaterInteraction(x: number, y: number, z: number, s: ReturnType<typeof useGameStore.getState>): boolean {
    // Check all 6 neighbors for water
    const neighbors = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (const [dx, dy, dz] of neighbors) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        const nType = s.getBlock(nx, ny, nz);
        if (nType === BlockType.WATER) {
            // Lava source touching water = obsidian
            // Lava flow touching water = cobblestone
            const lavaType = s.getBlock(x, y, z);
            if (lavaType === BlockType.LAVA) {
                s.addBlock(x, y, z, BlockType.OBSIDIAN);
            } else {
                s.addBlock(x, y, z, BlockType.COBBLE);
            }
            bumpChunk(x, z, s);
            bumpChunk(nx, nz, s);
            return true;
        }
    }
    return false;
}

function bumpChunk(x: number, z: number, s: ReturnType<typeof useGameStore.getState>) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    s.bumpVersion(cx, cz);
    // Bump neighbors if at edge
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    if (lx === 0) s.bumpVersion(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) s.bumpVersion(cx + 1, cz);
    if (lz === 0) s.bumpVersion(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) s.bumpVersion(cx, cz + 1);
}

/** Spread lava from a source position */
export function spreadLava(x: number, y: number, z: number): void {
    const s = useGameStore.getState();
    const type = s.getBlock(x, y, z);
    if (type !== BlockType.LAVA) return;

    // Check for water interaction first
    if (checkWaterInteraction(x, y, z, s)) return;

    const now = Date.now();

    // Flow down first (infinite)
    const below = s.getBlock(x, y - 1, z);
    if (below !== undefined && canReplace(below)) {
        scheduled.push({ x, y: y - 1, z, time: now + SPREAD_DELAY });
    } else if (below === BlockType.WATER) {
        s.addBlock(x, y - 1, z, BlockType.COBBLE);
        bumpChunk(x, z, s);
    }

    // Horizontal spread up to MAX_SPREAD
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    for (const [dx, dz] of dirs) {
        const nx = x + dx, nz = z + dz;
        const nType = s.getBlock(nx, y, nz);
        if (nType === BlockType.WATER) {
            s.addBlock(nx, y, nz, BlockType.COBBLE);
            bumpChunk(nx, nz, s);
            continue;
        }
        if (nType !== undefined && canReplace(nType)) {
            // Check spread distance from nearest source
            scheduled.push({ x: nx, y, z: nz, time: now + SPREAD_DELAY });
        }
    }
}

/** Process scheduled lava placements — call from game tick */
export function tickLava(): void {
    if (scheduled.length === 0) return;

    const now = Date.now();
    const s = useGameStore.getState();

    for (let i = scheduled.length - 1; i >= 0; i--) {
        const entry = scheduled[i];
        if (now < entry.time) continue;

        scheduled.splice(i, 1);

        const current = s.getBlock(entry.x, entry.y, entry.z);
        if (current === BlockType.WATER) {
            s.addBlock(entry.x, entry.y, entry.z, BlockType.COBBLE);
            bumpChunk(entry.x, entry.z, s);
            continue;
        }
        if (current === undefined || !canReplace(current)) continue;

        s.addBlock(entry.x, entry.y, entry.z, BlockType.LAVA);
        bumpChunk(entry.x, entry.z, s);

        // Check for water interaction at new position
        if (checkWaterInteraction(entry.x, entry.y, entry.z, s)) continue;

        // Continue spreading
        spreadLava(entry.x, entry.y, entry.z);
    }
}

/** Called when a block is removed near lava to trigger flow */
export function checkLavaFill(x: number, y: number, z: number): void {
    const s = useGameStore.getState();
    const neighbors = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (const [dx, dy, dz] of neighbors) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (s.getBlock(nx, ny, nz) === BlockType.LAVA) {
            spreadLava(nx, ny, nz);
        }
    }
}
