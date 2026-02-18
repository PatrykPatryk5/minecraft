/**
 * Mob System — Entity management for AI mobs
 *
 * Handles spawning, updating, despawning, and combat for all mobs.
 * Mob types: Zombie, Skeleton, Creeper (hostile) | Pig, Cow, Sheep (passive)
 *
 * Spawning rules (simplified Minecraft):
 *   - Hostiles: spawn at night or in dark areas, 24-128 blocks from player
 *   - Passives: spawn on grass in daylight, 24-80 blocks from player
 *   - Max 30 mobs total, despawn beyond 128 blocks
 */

import useGameStore from '../store/gameStore';
import { BlockType } from '../core/blockTypes';
import { playSound } from '../audio/sounds';

// ─── Types ──────────────────────────────────────────────
export type MobType = 'zombie' | 'skeleton' | 'creeper' | 'pig' | 'cow' | 'sheep';

export interface Mob {
    id: number;
    type: MobType;
    pos: [number, number, number];
    vel: [number, number, number];
    health: number;
    maxHealth: number;
    rotation: number; // Y rotation in radians
    target: [number, number, number] | null;
    state: 'idle' | 'wander' | 'chase' | 'attack' | 'flee' | 'fuse';
    lastAttackTime: number;
    fuseTimer: number; // For creeper
    hurtTimer: number; // Red flash
    despawnTimer: number;
}

export const MOB_STATS: Record<MobType, { health: number; speed: number; damage: number; hostile: boolean; color: string }> = {
    zombie: { health: 20, speed: 1.8, damage: 3, hostile: true, color: '#4a7a3d' },
    skeleton: { health: 20, speed: 2.0, damage: 3, hostile: true, color: '#c8c8c8' },
    creeper: { health: 20, speed: 1.5, damage: 0, hostile: true, color: '#3eb049' },
    pig: { health: 10, speed: 1.2, damage: 0, hostile: false, color: '#f0a0a0' },
    cow: { health: 10, speed: 1.0, damage: 0, hostile: false, color: '#6b3d1f' },
    sheep: { health: 8, speed: 1.3, damage: 0, hostile: false, color: '#e8e8e8' },
};

// ─── Constants ──────────────────────────────────────────
const MAX_MOBS = 30;
const SPAWN_RADIUS_MIN = 24;
const SPAWN_RADIUS_MAX = 80;
const DESPAWN_DISTANCE = 128;
const HOSTILE_DETECT_RANGE = 16;
const ATTACK_RANGE = 2.0;
const ATTACK_COOLDOWN = 1000; // ms
const CREEPER_FUSE_TIME = 2000; // ms
const CREEPER_EXPLODE_RADIUS = 3;
const GRAVITY = -28;

let nextMobId = 1;
let lastSpawnCheck = 0;
const SPAWN_INTERVAL = 5000; // Check every 5s

// ─── Core Functions ─────────────────────────────────────

/** Create a new mob at position */
export function spawnMob(type: MobType, x: number, y: number, z: number): Mob {
    const stats = MOB_STATS[type];
    return {
        id: nextMobId++,
        type,
        pos: [x, y, z],
        vel: [0, 0, 0],
        health: stats.health,
        maxHealth: stats.health,
        rotation: Math.random() * Math.PI * 2,
        target: null,
        state: 'idle',
        lastAttackTime: 0,
        fuseTimer: 0,
        hurtTimer: 0,
        despawnTimer: 0,
    };
}

/** Main update loop — call from useFrame or game tick */
export function updateMobs(delta: number): void {
    const s = useGameStore.getState();
    const mobs = [...s.mobs];
    const playerPos = s.playerPos;
    const now = Date.now();
    let changed = false;

    // Spawn check
    if (now - lastSpawnCheck > SPAWN_INTERVAL && mobs.length < MAX_MOBS) {
        lastSpawnCheck = now;
        const newMob = trySpawnMob(playerPos, s.dayTime);
        if (newMob) {
            mobs.push(newMob);
            changed = true;
        }
    }

    // Update each mob
    for (let i = mobs.length - 1; i >= 0; i--) {
        const mob = { ...mobs[i] } as Mob;
        const stats = MOB_STATS[mob.type as MobType];

        // Distance to player
        const dx = playerPos[0] - mob.pos[0];
        const dy = playerPos[1] - mob.pos[1];
        const dz = playerPos[2] - mob.pos[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Despawn if too far
        if (dist > DESPAWN_DISTANCE) {
            mobs.splice(i, 1);
            changed = true;
            continue;
        }

        // Update hurt timer
        if (mob.hurtTimer > 0) {
            mob.hurtTimer -= delta * 1000;
        }

        // AI State Machine
        if (stats.hostile) {
            // Hostile AI
            if (dist < HOSTILE_DETECT_RANGE) {
                mob.target = [...playerPos];
                mob.state = 'chase';
            } else {
                mob.target = null;
                mob.state = mob.state === 'chase' ? 'wander' : mob.state;
            }

            // Creeper special behavior
            if (mob.type === 'creeper' && dist < ATTACK_RANGE + 1) {
                mob.state = 'fuse';
                mob.fuseTimer += delta * 1000;
                if (mob.fuseTimer >= CREEPER_FUSE_TIME) {
                    // Explode!
                    creeperExplode(mob);
                    mobs.splice(i, 1);
                    changed = true;
                    continue;
                }
            } else if (mob.type === 'creeper') {
                mob.fuseTimer = Math.max(0, mob.fuseTimer - delta * 500); // Defuse
            }

            // Attack (zombie, skeleton)
            if (mob.type !== 'creeper' && dist < ATTACK_RANGE && now - mob.lastAttackTime > ATTACK_COOLDOWN) {
                mob.state = 'attack';
                mob.lastAttackTime = now;
                s.setHealth(s.health - stats.damage);
                playSound('hurt');
            }
        } else {
            // Passive AI — wander randomly
            if (mob.state === 'idle' && Math.random() < 0.01) {
                mob.state = 'wander';
                mob.target = [
                    mob.pos[0] + (Math.random() - 0.5) * 10,
                    mob.pos[1],
                    mob.pos[2] + (Math.random() - 0.5) * 10,
                ];
            }

            // Flee when hurt
            if (mob.hurtTimer > 0 && mob.state !== 'flee') {
                mob.state = 'flee';
                mob.target = [
                    mob.pos[0] - dx * 2,
                    mob.pos[1],
                    mob.pos[2] - dz * 2,
                ];
            }
        }

        // Movement
        if (mob.target && (mob.state === 'chase' || mob.state === 'wander' || mob.state === 'flee')) {
            const tdx = mob.target[0] - mob.pos[0];
            const tdz = mob.target[2] - mob.pos[2];
            const tDist = Math.sqrt(tdx * tdx + tdz * tdz);

            if (tDist > 0.5) {
                const speed = stats.speed * delta;
                mob.pos[0] += (tdx / tDist) * speed;
                mob.pos[2] += (tdz / tDist) * speed;
                mob.rotation = Math.atan2(tdx, tdz);
            } else if (mob.state === 'wander') {
                mob.state = 'idle';
                mob.target = null;
            }
        }

        // Simple gravity — fall to ground
        const groundY = getGroundLevel(mob.pos[0], mob.pos[2], s);
        if (mob.pos[1] > groundY + 1) {
            mob.vel[1] += GRAVITY * delta;
            mob.pos[1] += mob.vel[1] * delta;
            if (mob.pos[1] < groundY + 1) {
                mob.pos[1] = groundY + 1;
                mob.vel[1] = 0;
            }
        } else {
            mob.pos[1] = groundY + 1;
            mob.vel[1] = 0;
        }

        // Remove dead mobs
        if (mob.health <= 0) {
            mobs.splice(i, 1);
            changed = true;
            // Drop items (simplified)
            if (mob.type === 'cow' || mob.type === 'pig') {
                s.addItem(BlockType.MELON, 1); // Temporary: drop food
            }
            if (mob.type === 'sheep') {
                s.addItem(BlockType.WOOL_WHITE, 1);
            }
            playSound('pop');
            continue;
        }

        mobs[i] = mob;
        changed = true;
    }

    if (changed) {
        s.setMobs(mobs);
    }
}

/** Damage a mob at the given position (returns true if hit) */
export function attackMob(px: number, py: number, pz: number, direction: [number, number, number], damage: number): boolean {
    const s = useGameStore.getState();
    const mobs = [...s.mobs];

    for (let i = 0; i < mobs.length; i++) {
        const mob = mobs[i];
        const dx = mob.pos[0] - px;
        const dy = mob.pos[1] - py;
        const dz = mob.pos[2] - pz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < 3) {
            // Check if roughly in the direction we're looking
            const dot = dx * direction[0] + dy * direction[1] + dz * direction[2];
            if (dot > 0) {
                const updated = { ...mob };
                updated.health -= damage;
                updated.hurtTimer = 500;
                updated.state = 'flee';
                // Knockback
                const kbStr = 5;
                updated.vel = [
                    (dx / dist) * kbStr,
                    3,
                    (dz / dist) * kbStr,
                ];
                mobs[i] = updated;
                s.setMobs(mobs);
                playSound('hurt');
                return true;
            }
        }
    }
    return false;
}

// ─── Helper Functions ───────────────────────────────────

function trySpawnMob(playerPos: [number, number, number], dayTime: number): Mob | null {
    const isNight = dayTime > 0.75 || dayTime < 0.25;
    const angle = Math.random() * Math.PI * 2;
    const dist = SPAWN_RADIUS_MIN + Math.random() * (SPAWN_RADIUS_MAX - SPAWN_RADIUS_MIN);
    const x = playerPos[0] + Math.cos(angle) * dist;
    const z = playerPos[2] + Math.sin(angle) * dist;

    const s = useGameStore.getState();
    const y = getGroundLevel(x, z, s);
    if (y < 1) return null;

    // Choose mob type
    let type: MobType;
    if (isNight) {
        const r = Math.random();
        if (r < 0.4) type = 'zombie';
        else if (r < 0.7) type = 'skeleton';
        else if (r < 0.85) type = 'creeper';
        else type = Math.random() > 0.5 ? 'pig' : 'cow';
    } else {
        const r = Math.random();
        if (r < 0.35) type = 'pig';
        else if (r < 0.65) type = 'cow';
        else if (r < 0.9) type = 'sheep';
        else type = 'zombie'; // rare daytime zombie
    }

    return spawnMob(type, x, y + 1, z);
}

function getGroundLevel(x: number, z: number, s: ReturnType<typeof useGameStore.getState>): number {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    for (let y = 120; y > 0; y--) {
        const block = s.getBlock(bx, y, bz);
        if (block && block !== BlockType.AIR && block !== BlockType.WATER &&
            block !== BlockType.TALL_GRASS && block !== BlockType.FLOWER_RED &&
            block !== BlockType.FLOWER_YELLOW) {
            return y;
        }
    }
    return 64;
}

function creeperExplode(mob: Mob): void {
    const s = useGameStore.getState();
    const [x, y, z] = mob.pos;
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);

    // Destroy blocks in radius
    for (let dx = -CREEPER_EXPLODE_RADIUS; dx <= CREEPER_EXPLODE_RADIUS; dx++) {
        for (let dy = -CREEPER_EXPLODE_RADIUS; dy <= CREEPER_EXPLODE_RADIUS; dy++) {
            for (let dz = -CREEPER_EXPLODE_RADIUS; dz <= CREEPER_EXPLODE_RADIUS; dz++) {
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist > CREEPER_EXPLODE_RADIUS) continue;
                if (dist > CREEPER_EXPLODE_RADIUS * 0.5 && Math.random() > 0.5) continue;

                const bx = ix + dx, by = iy + dy, bz = iz + dz;
                if (by < 1) continue;
                const type = s.getBlock(bx, by, bz);
                if (type && type !== BlockType.BEDROCK && type !== BlockType.WATER) {
                    s.removeBlock(bx, by, bz);
                }
            }
        }
    }

    // Bump affected chunks
    const cx1 = Math.floor((ix - CREEPER_EXPLODE_RADIUS) / 16);
    const cx2 = Math.floor((ix + CREEPER_EXPLODE_RADIUS) / 16);
    const cz1 = Math.floor((iz - CREEPER_EXPLODE_RADIUS) / 16);
    const cz2 = Math.floor((iz + CREEPER_EXPLODE_RADIUS) / 16);
    for (let cx = cx1; cx <= cx2; cx++) {
        for (let cz = cz1; cz <= cz2; cz++) {
            s.bumpVersion(cx, cz);
        }
    }

    // Damage player
    const pdx = s.playerPos[0] - x;
    const pdy = s.playerPos[1] - y;
    const pdz = s.playerPos[2] - z;
    const pDist = Math.sqrt(pdx * pdx + pdy * pdy + pdz * pdz);
    if (pDist < CREEPER_EXPLODE_RADIUS * 2.5) {
        const dmg = Math.round(15 * (1 - pDist / (CREEPER_EXPLODE_RADIUS * 2.5)));
        s.setHealth(s.health - dmg);
        playSound('hurt');
    }

    playSound('explode');
}
