/**
 * Block Actions — Functional block behaviors
 *
 * Handles TNT explosions, door toggling, bed spawns, chest opening, etc.
 * Called from Player.tsx on right-click interaction with specific blocks.
 */

import useGameStore from '../store/gameStore';
import { attemptNetherPortalIgnite } from './portalSystem';
import { BlockType, BLOCK_DATA } from './blockTypes';
import { playSound } from '../audio/sounds';
import { emitBlockBreak, emitExplosion } from '../core/particles';
import { MAX_HEIGHT } from './terrainGen';

// ─── TNT Explosion ──────────────────────────────────────
const EXPLOSION_RADIUS = 4;
const EXPLOSION_DAMAGE = 12;
const MAX_BREAK_PARTICLES = 320;
const EXPLOSION_REMOVE_BATCH = 256;

/** Ignite TNT at position — creates delayed explosion */
export function igniteTNT(x: number, y: number, z: number): void {
    const s = useGameStore.getState();
    if (s.primedTNT.length > 300) return;
    // Remove the TNT block immediately and spawn entity
    // Spawn entity first so it renders in the same frame the block disappears
    s.spawnTNT([x + 0.5, y + 0.5, z + 0.5], 80); // 80 ticks = 4 seconds
    s.removeBlock(x, y, z);
    playSound('fuse');
}

/** Create explosion at position, destroying blocks in radius */
export function explodeAt(x: number, y: number, z: number): void {
    const s = useGameStore.getState();
    const destroyed: [number, number, number][] = [];

    // Visuals
    emitExplosion(x, y, z);
    playSound('explode');

    // Destroy blocks in sphere
    for (let dx = -EXPLOSION_RADIUS; dx <= EXPLOSION_RADIUS; dx++) {
        for (let dy = -EXPLOSION_RADIUS; dy <= EXPLOSION_RADIUS; dy++) {
            for (let dz = -EXPLOSION_RADIUS; dz <= EXPLOSION_RADIUS; dz++) {
                const distSq = dx * dx + dy * dy + dz * dz;
                if (distSq > EXPLOSION_RADIUS * EXPLOSION_RADIUS) continue;

                const bx = x + dx, by = y + dy, bz = z + dz;
                if (by < 1 || by > 255) continue; // Don't destroy bedrock layer

                const type = s.getBlock(bx, by, bz);
                if (!type) continue;

                const blockData = BLOCK_DATA[type];
                if (!blockData || type === BlockType.BEDROCK || type === BlockType.WATER || type === BlockType.OBSIDIAN) continue;

                // Chain TNT!
                if (type === BlockType.TNT) {
                    s.removeBlock(bx, by, bz);
                    // Spawn primed TNT with short random fuse for chaining effect
                    if (s.primedTNT.length < 400) {
                        s.spawnTNT([bx + 0.5, by + 0.5, bz + 0.5], 5 + Math.floor(Math.random() * 10));
                    }
                    continue;
                }

                destroyed.push([bx, by, bz]);
                if (destroyed.length <= MAX_BREAK_PARTICLES) emitBlockBreak(bx, by, bz, type);
            }
        }
    }

    // Batch remove blocks
    if (destroyed.length > EXPLOSION_REMOVE_BATCH) {
        for (let i = 0; i < destroyed.length; i += EXPLOSION_REMOVE_BATCH) {
            const batch = destroyed.slice(i, i + EXPLOSION_REMOVE_BATCH);
            setTimeout(() => useGameStore.getState().removeBlocks(batch), 0);
        }
    } else {
        s.removeBlocks(destroyed);
    }

    // Damage player if near
    const playerPos = s.playerPos;
    const dx = playerPos[0] - x;
    const dy = playerPos[1] - y;
    const dz = playerPos[2] - z;
    const playerDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (playerDist < EXPLOSION_RADIUS * 2) {
        const dmg = Math.max(0, EXPLOSION_DAMAGE * (1 - playerDist / (EXPLOSION_RADIUS * 2)));
        s.takeDamage(Math.round(dmg));
        playSound('hurt');
    }
}

// ─── Door Toggle ────────────────────────────────────────
// We use metadata approach: doors are just blocks that we track open/closed state
const doorStates = new Map<string, number>(); // key -> original blockType

export function toggleDoor(x: number, y: number, z: number): boolean {
    const key = `${x},${y},${z}`;
    const s = useGameStore.getState();
    const type = s.getBlock(x, y, z);

    if (type === BlockType.TRAPDOOR || type === BlockType.DOOR_OAK) {
        // Door is present = closed, remove to open
        doorStates.set(key, type);
        s.removeBlock(x, y, z);
        const cx = Math.floor(x / 16);
        const cz = Math.floor(z / 16);
        s.bumpVersion(cx, cz);
        playSound('open');
        return true;
    }

    // Check if there was a door/trapdoor here that was opened
    if (doorStates.has(key)) {
        const originalType = doorStates.get(key)!;
        s.addBlock(x, y, z, originalType);
        doorStates.delete(key);
        const cx = Math.floor(x / 16);
        const cz = Math.floor(z / 16);
        s.bumpVersion(cx, cz);
        playSound('close');
        return true;
    }

    return false;
}

// ─── Bed Spawn Point ────────────────────────────────────
export function useBed(x: number, y: number, z: number): void {
    const s = useGameStore.getState();
    const type = s.getBlock(x, y, z);
    if (type !== BlockType.BED && type !== BlockType.BED_HEAD) return;

    // Set spawn point
    s.setPlayerPos([x + 0.5, y + 1, z + 0.5]);
    playSound('click');

    // Skip night
    if (s.dayTime > 0.75 || s.dayTime < 0.25) {
        s.skipNight();
        s.addChatMessage('System', 'Śpisz... Słodkich snów!');
    } else {
        s.addChatMessage('System', 'Możesz spać tylko w nocy.');
    }
}

/** 2-Block Bed placement check */
export function handleBedPlacement(x: number, y: number, z: number, yaw: number): boolean {
    const s = useGameStore.getState();

    // Raycasting to find direction (where player is looking)
    // 0: -Z (North), 1: +X (East), 2: +Z (South), 3: -X (West)
    const dir = (Math.floor((yaw * 4) / (Math.PI * 2) + 0.5) & 3);
    const deltas = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const [dx, dz] = deltas[dir];

    const headX = x + dx;
    const headZ = z + dz;

    // Check if head position is free and solid below
    if (s.getBlock(headX, y, headZ) !== BlockType.AIR) return false;
    const belowType = s.getBlock(headX, y - 1, headZ);
    if (!BLOCK_DATA[belowType]?.solid && belowType !== BlockType.BEDROCK) return false;

    // Place both parts
    s.addBlock(x, y, z, BlockType.BED);
    s.addBlock(headX, y, headZ, BlockType.BED_HEAD);

    return true;
}

/** Linked breaking for beds, doors, etc. */
export function onBlockBroken(x: number, y: number, z: number, type: number): void {
    const s = useGameStore.getState();

    if (type === BlockType.BED || type === BlockType.BED_HEAD) {
        const checkDirs = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
        for (const [dx, dy, dz] of checkDirs) {
            const nx = x + dx, ny = y, nz = z + dz;
            const neighborType = s.getBlock(nx, ny, nz);
            if (type === BlockType.BED && neighborType === BlockType.BED_HEAD) {
                s.removeBlock(nx, ny, nz);
            } else if (type === BlockType.BED_HEAD && neighborType === BlockType.BED) {
                s.removeBlock(nx, ny, nz);
            }
        }
    }
}

// ─── Ladder Climbing ────────────────────────────────────
/** Check if player is touching a ladder block */
export function isOnLadder(px: number, py: number, pz: number): boolean {
    const s = useGameStore.getState();
    const bx = Math.floor(px);
    const by = Math.floor(py);
    const bz = Math.floor(pz);

    // Check the block at feet and at body level
    return (
        s.getBlock(bx, by, bz) === BlockType.LADDER ||
        s.getBlock(bx, by - 1, bz) === BlockType.LADDER
    );
}

// ─── Handle Right-Click Action ──────────────────────────
/** Returns true if the block was interacted with (don't place) */
export function handleBlockAction(
    blockX: number, blockY: number, blockZ: number,
    blockType: number,
    heldItem?: number
): boolean {
    switch (blockType) {
        case BlockType.TNT:
            if (heldItem === BlockType.FLINT_AND_STEEL) {
                igniteTNT(blockX, blockY, blockZ);
                return true;
            }
            return false;
        case BlockType.OBSIDIAN:
            if (heldItem === BlockType.FLINT_AND_STEEL) {
                return attemptNetherPortalIgnite(blockX, blockY, blockZ);
            }
            return false;
        case BlockType.TRAPDOOR:
        case BlockType.DOOR_OAK:
            toggleDoor(blockX, blockY, blockZ);
            return true;
        case BlockType.CHEST: {
            const s = useGameStore.getState();
            s.setOverlay('chest');
            playSound('open');
            document.exitPointerLock();
            return true;
        }
        case BlockType.BED:
        case BlockType.BED_HEAD:
            useBed(blockX, blockY, blockZ);
            return true;
        case BlockType.LEVER: {
            import('./redstoneSystem').then(({ toggleLever }) => {
                toggleLever(blockX, blockY, blockZ);
            });
            playSound('click');
            return true;
        }
        case BlockType.BUTTON: {
            import('./redstoneSystem').then(({ updateRedstone }) => {
                const s = useGameStore.getState();
                s.setBlockPower(blockX, blockY, blockZ, 15);
                updateRedstone(blockX, blockY, blockZ);

                // Reset button after 1s
                setTimeout(() => {
                    const innerState = useGameStore.getState();
                    if (innerState.getBlock(blockX, blockY, blockZ) === BlockType.BUTTON) {
                        innerState.setBlockPower(blockX, blockY, blockZ, 0);
                        updateRedstone(blockX, blockY, blockZ);
                    }
                }, 1000);
            });
            playSound('click');
            return true;
        }
        default:
            return false;
    }
}
