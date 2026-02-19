
import { BlockType, BLOCK_DATA } from './blockTypes';
import useGameStore from '../store/gameStore';
import { playSound } from '../audio/sounds';

// ─── Constants ──────────────────────────────────────────
const MAX_PUSH_LIMIT = 12;

// ─── Helpers ────────────────────────────────────────────

// Get direction vector from piston metadata/orientation
// For now, we'll assume a simple metadata scheme or just derived from placement.
// To keep it compatible with existing simplified blocks, we might need to store rotation in a separate map 
// or use a new BlockType specific approach (e.g. PISTON_UP, PISTON_DOWN etc) or just use the `rotation` field in `mobs`?
// Actually, for blocks, we usually need data values. 
// Since we don't have block metadata in the current Uint16Array chunk format (only ID), 
// we will have to use a separate store for complex block data (like Traverse/Redstone) or specific block IDs.
// For simplicity in this project, we might deduce orientation from player or just standard rules.
// BUT, `BlockType` has IDs. Let's assume we use a `blockData` map in `gameStore` for things like Chests/Furnaces.
// We should probably add `pistonData` to `gameStore` or `chunks` if we want full orientation.
// OR, we can use different Block IDs for different orientations if we have space. 
// Given the constraints, let's look at `gameStore.ts`. It has `chests`. We can add `pistons`.

// Re-reading gameStore.ts... it has `chests: Record<string, ChestData>`.
// We should perform a similar approach for Pistons to store their orientation and state (extended/retracted).

import { PistonData } from '../store/gameStore';

// 0: Down, 1: Up, 2: North(-Z), 3: South(+Z), 4: West(-X), 5: East(+X)
const DIR_VECTORS = [
    [0, -1, 0], [0, 1, 0],
    [0, 0, -1], [0, 0, 1],
    [-1, 0, 0], [1, 0, 0]
];

// ─── Logic ──────────────────────────────────────────────

export function placePiston(x: number, y: number, z: number, direction: number, sticky: boolean) {
    const s = useGameStore.getState();
    const key = `${x},${y},${z}`;

    // Visually place the block base
    const blockId = sticky ? BlockType.PISTON_STICKY : BlockType.PISTON;
    s.addBlock(x, y, z, blockId);

    // Save metadata
    const data: PistonData = {
        x, y, z,
        direction,
        extended: false,
        type: sticky ? 'sticky' : 'normal',
    };
    s.setPiston(key, data);

    playSound('place');
}

export function updatePiston(x: number, y: number, z: number, powered: boolean) {
    const s = useGameStore.getState();
    const key = `${x},${y},${z}`;
    const pData = s.getPiston(key);

    if (!pData) return;

    if (powered && !pData.extended) {
        extendPiston(s, pData);
    } else if (!powered && pData.extended) {
        retractPiston(s, pData);
    }
}

function extendPiston(s: any, data: PistonData) {
    // 1. Check if can push
    if (tryPush(data.x, data.y, data.z, data.direction)) {
        // 2. Set as extended
        const updated = { ...data, extended: true };
        s.setPiston(`${data.x},${data.y},${data.z}`, updated);

        // 3. Place Piston Head
        const vec = DIR_VECTORS[data.direction];
        const hx = data.x + vec[0];
        const hy = data.y + vec[1];
        const hz = data.z + vec[2];
        s.addBlock(hx, hy, hz, BlockType.PISTON_HEAD);

        playSound('piston_out');
    }
}

function retractPiston(s: any, data: PistonData) {
    // 1. Remove Head
    const vec = DIR_VECTORS[data.direction];
    const hx = data.x + vec[0];
    const hy = data.y + vec[1];
    const hz = data.z + vec[2];

    s.removeBlock(hx, hy, hz);

    // 2. If sticky, pull block
    if (data.type === 'sticky') {
        const ax = hx + vec[0];
        const ay = hy + vec[1];
        const az = hz + vec[2];
        const pullId = s.getBlock(ax, ay, az);

        if (pullId !== 0 && canPush(pullId)) {
            s.removeBlock(ax, ay, az);
            s.addBlock(hx, hy, hz, pullId);
        }
    }

    // 3. Update state
    const updated = { ...data, extended: false };
    s.setPiston(`${data.x},${data.y},${data.z}`, updated);
    playSound('piston_in');
}

// Actual implementation will require Store updates first. 
// I will write the Piston System assuming the store has `pistons` Record.

export const PISTON_DIRS = {
    DOWN: 0, UP: 1, NORTH: 2, SOUTH: 3, WEST: 4, EAST: 5
};

export function getPistonVector(dir: number): [number, number, number] {
    return DIR_VECTORS[dir] as [number, number, number];
}

export function canPush(block: number): boolean {
    if (block === 0) return true; // Air is "pushable" (it just gets displaced)
    if (block === BlockType.BEDROCK) return false;
    if (block === BlockType.OBSIDIAN) return false;
    if (block === BlockType.CRYING_OBSIDIAN) return false;
    // Add more unmovable blocks
    return true;
}

// Pushing logic (recursive)
export function tryPush(x: number, y: number, z: number, dir: number): boolean {
    const s = useGameStore.getState();
    const vec = DIR_VECTORS[dir];
    const pushList: { x: number, y: number, z: number, id: number }[] = [];

    let cx = x + vec[0];
    let cy = y + vec[1];
    let cz = z + vec[2];

    // Collect blocks to push
    for (let i = 0; i < MAX_PUSH_LIMIT; i++) {
        const id = s.getBlock(cx, cy, cz);
        if (id === 0) break; // Air ends the chain
        if (!canPush(id)) return false; // Blocked

        pushList.push({ x: cx, y: cy, z: cz, id });

        cx += vec[0];
        cy += vec[1];
        cz += vec[2];
    }

    if (pushList.length >= MAX_PUSH_LIMIT) return false; // Too many

    // Do the push (iterate backwards)
    // 1. Check if destination of last block is valid (it is air because of loop condition)

    let targetX = x + vec[0] * (pushList.length + 1);
    let targetY = y + vec[1] * (pushList.length + 1);
    let targetZ = z + vec[2] * (pushList.length + 1);

    // Move blocks from last to first
    for (let i = pushList.length - 1; i >= 0; i--) {
        const b = pushList[i];
        const nextX = b.x + vec[0];
        const nextY = b.y + vec[1];
        const nextZ = b.z + vec[2];

        s.addBlock(nextX, nextY, nextZ, b.id);
        s.removeBlock(b.x, b.y, b.z);
        // Move metadata if needed (not implemented for generic blocks yet)

        // s.bumpVersion...
    }

    return true;
}
