/**
 * Redstone System Logic
 * 
 * Handles power propagation (0-15), wire connections, and device triggering.
 * Uses a Breadth-First Search (BFS) for efficient signal update.
 */

import useGameStore from '../store/gameStore';
import { BlockType } from './blockTypes';
import { updatePiston } from './pistonSystem';

// Direction vectors for neighbor checks
const DIRS = [
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1]
];

/** 
 * Trigger a redstone update at a position and its neighbors. 
 */
export function updateRedstone(startX: number, startY: number, startZ: number) {
    propagateSignal(startX, startY, startZ);
}

/** Toggle a lever; returns new visual state (on/off) */
export function toggleLever(x: number, y: number, z: number): boolean {
    const s = useGameStore.getState();
    const currentPower = s.getBlockPower(x, y, z);
    const isOn = currentPower > 0;
    const newPower = isOn ? 0 : 15;

    s.setBlockPower(x, y, z, newPower);
    updateRedstone(x, y, z);

    return !isOn;
}

/** BFS propagation of redstone signal from sources. */
function propagateSignal(x: number, y: number, z: number) {
    const s = useGameStore.getState();
    const queue: [number, number, number][] = [[x, y, z]];
    const visited = new Set<number>(); // Use bit-packed integer key for performance

    const getKey = (vx: number, vy: number, vz: number) => {
        // Shift bits to create a unique 32-bit integer for a reasonable world area
        return ((vx + 1000) & 0x7FF) | (((vy & 0xFF) | ((vz + 1000) & 0x7FF) << 8) << 11);
    };

    // Add neighbors of start too
    for (const [dx, dy, dz] of DIRS) {
        queue.push([x + dx, y + dy, z + dz]);
    }

    while (queue.length > 0) {
        const [cx, cy, cz] = queue.shift()!;
        const k = getKey(cx, cy, cz);
        if (visited.has(k)) continue;
        visited.add(k);

        const currentBlock = s.getBlock(cx, cy, cz);
        if (currentBlock === BlockType.AIR) continue;

        const newPower = calculatePowerAt(cx, cy, cz);
        const oldPower = s.getBlockPower(cx, cy, cz);

        if (newPower !== oldPower) {
            s.setBlockPower(cx, cy, cz, newPower);
            triggerDevice(cx, cy, cz, currentBlock, newPower > 0);

            for (const [dx, dy, dz] of DIRS) {
                queue.push([cx + dx, cy + dy, cz + dz]);
            }
        }
    }
}

/** Determines the power level a block should have based on its neighbors/sources. */
function calculatePowerAt(x: number, y: number, z: number): number {
    const s = useGameStore.getState();
    const block = s.getBlock(x, y, z);

    if (block === BlockType.LEVER || block === BlockType.REDSTONE_BLOCK) {
        return s.getBlockPower(x, y, z); // Persisted state
    }

    if (block === BlockType.REDSTONE_TORCH) {
        // Torch inversion: powered if block below is UNPOWERED
        const belowPower = s.getBlockPower(x, y - 1, z);
        return belowPower > 0 ? 0 : 15;
    }

    // Only Redstone Wire actually "carries" and "diminishes" power.
    if (block === BlockType.REDSTONE_WIRE) {
        let maxIncoming = 0;
        for (const [dx, dy, dz] of DIRS) {
            const neighborBlock = s.getBlock(x + dx, y + dy, z + dz);
            const neighborPower = s.getBlockPower(x + dx, y + dy, z + dz);

            if (isPowerSource(neighborBlock)) {
                maxIncoming = Math.max(maxIncoming, neighborPower);
            } else if (neighborBlock === BlockType.REDSTONE_WIRE) {
                maxIncoming = Math.max(maxIncoming, neighborPower - 1);
            }
        }
        return Math.max(0, maxIncoming);
    }

    // Other blocks (Lamps, Pistons, Doors) receive power from neighbors
    let maxNeighborPower = 0;
    for (const [dx, dy, dz] of DIRS) {
        const nb = s.getBlock(x + dx, y + dy, z + dz);
        const np = s.getBlockPower(x + dx, y + dy, z + dz);
        if (isPowerSource(nb) || nb === BlockType.REDSTONE_WIRE) {
            maxNeighborPower = Math.max(maxNeighborPower, np);
        }
    }
    return maxNeighborPower;
}

function isPowerSource(type: number): boolean {
    return type === BlockType.LEVER || type === BlockType.REDSTONE_TORCH || type === BlockType.REDSTONE_BLOCK;
}

/** Activates/Deactivates the specific device logic. */
function triggerDevice(x: number, y: number, z: number, type: number, isPowered: boolean) {
    const s = useGameStore.getState();

    switch (type) {
        case BlockType.REDSTONE_LAMP:
            // Lamp visual is handled by its power level metadata in Chunk.tsx (emissive shader)
            break;
        case BlockType.PISTON:
        case BlockType.PISTON_STICKY:
            updatePiston(x, y, z, isPowered);
            break;
        case BlockType.DOOR_OAK:
        case BlockType.TRAPDOOR:
            // Trigger door animation/state
            break;
    }
}
