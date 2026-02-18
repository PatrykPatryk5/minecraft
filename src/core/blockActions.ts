/**
 * Block Actions — Functional block behaviors
 *
 * Handles TNT explosions, door toggling, bed spawns, chest opening, etc.
 * Called from Player.tsx on right-click interaction with specific blocks.
 */

import useGameStore from '../store/gameStore';
import { BlockType, BLOCK_DATA } from './blockTypes';
import { playSound } from '../audio/sounds';
import { emitBlockBreak } from '../effects/BlockParticles';

// ─── TNT Explosion ──────────────────────────────────────
const EXPLOSION_RADIUS = 4;
const EXPLOSION_DAMAGE = 12;

/** Ignite TNT at position — creates delayed explosion */
export function igniteTNT(x: number, y: number, z: number): void {
    const s = useGameStore.getState();
    // Remove the TNT block immediately
    s.removeBlock(x, y, z);
    playSound('click');

    // Schedule explosion after 4 seconds (80 ticks)
    setTimeout(() => {
        explodeAt(x, y, z);
    }, 4000);
}

/** Create explosion at position, destroying blocks in radius */
function explodeAt(x: number, y: number, z: number): void {
    const s = useGameStore.getState();
    const destroyed: [number, number, number][] = [];

    // Destroy blocks in sphere
    for (let dx = -EXPLOSION_RADIUS; dx <= EXPLOSION_RADIUS; dx++) {
        for (let dy = -EXPLOSION_RADIUS; dy <= EXPLOSION_RADIUS; dy++) {
            for (let dz = -EXPLOSION_RADIUS; dz <= EXPLOSION_RADIUS; dz++) {
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist > EXPLOSION_RADIUS) continue;

                // Random falloff — outer blocks have chance to survive
                if (dist > EXPLOSION_RADIUS * 0.6 && Math.random() > 0.6) continue;

                const bx = x + dx, by = y + dy, bz = z + dz;
                if (by < 1 || by > 255) continue; // Don't destroy bedrock layer

                const type = s.getBlock(bx, by, bz);
                if (!type || type === BlockType.BEDROCK || type === BlockType.WATER) continue;

                // Chain TNT!
                if (type === BlockType.TNT) {
                    setTimeout(() => igniteTNT(bx, by, bz), Math.random() * 500);
                    continue;
                }

                destroyed.push([bx, by, bz]);
                emitBlockBreak(bx, by, bz, type);
            }
        }
    }

    // Batch remove blocks
    for (const [bx, by, bz] of destroyed) {
        s.removeBlock(bx, by, bz);
    }

    // Bump chunk versions around explosion
    const affectedChunks = new Set<string>();
    for (const [bx, , bz] of destroyed) {
        const cx = Math.floor(bx / 16);
        const cz = Math.floor(bz / 16);
        const key = `${cx},${cz}`;
        if (!affectedChunks.has(key)) {
            affectedChunks.add(key);
            s.bumpVersion(cx, cz);
        }
    }

    // Damage player if near
    const playerPos = s.playerPos;
    const dx = playerPos[0] - x;
    const dy = playerPos[1] - y;
    const dz = playerPos[2] - z;
    const playerDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (playerDist < EXPLOSION_RADIUS * 2) {
        const dmg = Math.max(0, EXPLOSION_DAMAGE * (1 - playerDist / (EXPLOSION_RADIUS * 2)));
        s.setHealth(s.health - Math.round(dmg));
    }

    playSound('explode');
    // Play hurt if player was damaged
    if (playerDist < EXPLOSION_RADIUS * 2) {
        playSound('hurt');
    }
}

// ─── Door Toggle ────────────────────────────────────────
// We use metadata approach: doors are just blocks that we track open/closed state
// For simplicity: when "open", we remove the door block, when "closed" we re-add it
// Real MC uses block states, but this is simpler for our system
const doorStates = new Map<string, number>(); // key -> original blockType

export function toggleDoor(x: number, y: number, z: number): boolean {
    const key = `${x},${y},${z}`;
    const s = useGameStore.getState();
    const type = s.getBlock(x, y, z);

    if (type === BlockType.TRAPDOOR) {
        // Trapdoor is present = closed, remove to open
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
    // Set spawn point
    s.setPlayerPos([x + 0.5, y + 1, z + 0.5]);
    playSound('click');

    // TODO: Skip night if implemented
    // For now just set spawn
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
    blockType: number
): boolean {
    switch (blockType) {
        case BlockType.TNT:
            igniteTNT(blockX, blockY, blockZ);
            return true;
        case BlockType.TRAPDOOR:
            toggleDoor(blockX, blockY, blockZ);
            return true;
        case BlockType.CHEST:
            // Open chest inventory (use crafting overlay for now)
            useGameStore.getState().setOverlay('crafting');
            playSound('open');
            document.exitPointerLock();
            return true;
        default:
            return false;
    }
}
