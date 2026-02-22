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
import { getNextStep, isSolid } from './pathfinding';
import { MAX_HEIGHT } from '../core/terrainGen';

// ─── Types ──────────────────────────────────────────────
export type MobType = 'zombie' | 'skeleton' | 'creeper' | 'pig' | 'cow' | 'sheep'
    | 'enderman' | 'spider' | 'blaze' | 'chicken' | 'wolf';

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

export const MOB_STATS: Record<MobType, { health: number; speed: number; damage: number; hostile: boolean; color: string; dimension?: string }> = {
    zombie: { health: 20, speed: 1.8, damage: 3, hostile: true, color: '#4a7a3d' },
    skeleton: { health: 20, speed: 2.0, damage: 3, hostile: true, color: '#c8c8c8' },
    creeper: { health: 20, speed: 1.5, damage: 0, hostile: true, color: '#3eb049' },
    spider: { health: 16, speed: 2.5, damage: 2, hostile: true, color: '#3d3020' },
    enderman: { health: 40, speed: 3.0, damage: 7, hostile: false, color: '#1a1a2e', dimension: 'end' },
    blaze: { health: 20, speed: 1.5, damage: 5, hostile: true, color: '#ff8800', dimension: 'nether' },
    pig: { health: 10, speed: 1.2, damage: 0, hostile: false, color: '#f0a0a0' },
    cow: { health: 10, speed: 1.0, damage: 0, hostile: false, color: '#6b3d1f' },
    sheep: { health: 8, speed: 1.3, damage: 0, hostile: false, color: '#e8e8e8' },
    chicken: { health: 4, speed: 1.5, damage: 0, hostile: false, color: '#f5f5f0' },
    wolf: { health: 8, speed: 2.2, damage: 4, hostile: false, color: '#d0d0d0' },
};

// ─── Constants ──────────────────────────────────────────
const MAX_MOBS = 50;
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
const SPAWN_INTERVAL = 1000; // Check every 1s (Minecraft is 400ms but 1s is safer for perf)

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

        // Pack spawning: try to spawn 1-4 mobs in a flock
        const packSize = 1 + Math.floor(Math.random() * 4);
        for (let p = 0; p < packSize; p++) {
            if (mobs.length >= MAX_MOBS) break;
            const newMob = trySpawnMob(playerPos, s.dayTime);
            if (newMob) {
                mobs.push(newMob);
                changed = true;
                // Offset subsequent pack members slightly
            }
        }
    }

    // Update each mob
    for (let i = mobs.length - 1; i >= 0; i--) {
        const mob = mobs[i]; // No need to spread yet
        const stats = MOB_STATS[mob.type as MobType];

        // Distance to player
        const dx = playerPos[0] - mob.pos[0];
        const dy = playerPos[1] - mob.pos[1];
        const dz = playerPos[2] - mob.pos[2];
        const distSq = dx * dx + dy * dy + dz * dz;
        const dist = Math.sqrt(distSq);

        // Despawn if too far
        if (dist > DESPAWN_DISTANCE) {
            mobs.splice(i, 1);
            changed = true;
            continue;
        }

        // AI Throttling: Skip expensive logic for distant mobs
        // Update at 20Hz if near, progressively slower if far
        const updateInterval = dist < 24 ? 1 : dist < 64 ? 3 : 6;
        if ((mob.id + Math.floor(now / 50)) % updateInterval !== 0) {
            // Still process basic physics/movement for smoothness? 
            // Actually, better to just skip if not processing AI
            // But we need to update hurtTimer etc.
            if (mob.hurtTimer > 0) mob.hurtTimer -= delta * 1000;
            continue;
        }

        const mobCopy = { ...mob }; // Spread only when we decide to update

        // Update hurt timer
        if (mobCopy.hurtTimer > 0) {
            mobCopy.hurtTimer -= delta * 1000;
            // Enderman teleport when hit
            if (mobCopy.type === 'enderman' && Math.random() < 0.1) {
                teleportMob(mobCopy);
            }
        }

        // Sunlight burning (Zombie, Skeleton)
        if ((mobCopy.type === 'zombie' || mobCopy.type === 'skeleton') && s.dayTime > 0.25 && s.dayTime < 0.75) {
            const bx = Math.floor(mobCopy.pos[0]);
            const bz = Math.floor(mobCopy.pos[2]);
            const by = Math.floor(mobCopy.pos[1]);
            const groundY = getGroundLevel(bx, bz, s);
            if (by >= groundY) {
                mobCopy.health -= (delta * updateInterval) * 2;
                if (mobCopy.hurtTimer <= 0) {
                    mobCopy.hurtTimer = 500;
                    playSound('hurt');
                }
            }
        }

        // AI State Machine
        if (stats.hostile) {
            // Hostile AI
            if (dist < HOSTILE_DETECT_RANGE) {
                mobCopy.target = [...playerPos];
                mobCopy.state = 'chase';

                // Skeleton ranged behavior
                if (mobCopy.type === 'skeleton') {
                    if (dist < 12 && dist > 2 && now - mobCopy.lastAttackTime > 2000) {
                        s.setHealth(s.health - stats.damage);
                        mobCopy.lastAttackTime = now;
                        playSound('hurt');
                    }
                    if (dist < 8) {
                        mobCopy.state = 'flee';
                        mobCopy.target = [mobCopy.pos[0] - dx, mobCopy.pos[1], mobCopy.pos[2] - dz];
                    }
                }
            } else {
                mobCopy.target = null;
                mobCopy.state = mobCopy.state === 'chase' ? 'wander' : mobCopy.state;
            }

            // Creeper special behavior
            if (mobCopy.type === 'creeper' && dist < ATTACK_RANGE + 1) {
                mobCopy.state = 'fuse';
                mobCopy.fuseTimer += delta * updateInterval * 1000;
                if (mobCopy.fuseTimer >= CREEPER_FUSE_TIME) {
                    creeperExplode(mobCopy);
                    mobs.splice(i, 1);
                    changed = true;
                    continue;
                }
            } else if (mobCopy.type === 'creeper') {
                mobCopy.fuseTimer = Math.max(0, mobCopy.fuseTimer - delta * updateInterval * 500); // Defuse
            }

            // Blaze special behavior
            if (mobCopy.type === 'blaze' && dist < 15 && now - mobCopy.lastAttackTime > 2000) {
                s.takeDamage(stats.damage);
                mobCopy.lastAttackTime = now;
                playSound('fireball');
            }

            // Attack (melee)
            if (mobCopy.type !== 'creeper' && mobCopy.type !== 'blaze' && dist < ATTACK_RANGE && now - mobCopy.lastAttackTime > ATTACK_COOLDOWN) {
                mobCopy.state = 'attack';
                mobCopy.lastAttackTime = now;
                s.takeDamage(stats.damage);
                playSound('hurt');
            }
        } else {
            // Passive/Neutral AI
            if (mobCopy.type === 'wolf' && mobCopy.hurtTimer > 0) {
                mobCopy.target = [...playerPos];
                mobCopy.state = 'chase';
                if (dist < ATTACK_RANGE && now - mobCopy.lastAttackTime > ATTACK_COOLDOWN) {
                    s.takeDamage(stats.damage);
                    mobCopy.lastAttackTime = now;
                    playSound('hurt');
                }
            } else if (mobCopy.state === 'idle' && Math.random() < 0.01 * updateInterval) {
                mobCopy.state = 'wander';
                mobCopy.target = [
                    mobCopy.pos[0] + (Math.random() - 0.5) * 10,
                    mobCopy.pos[1],
                    mobCopy.pos[2] + (Math.random() - 0.5) * 10,
                ];
            }

            // Flee when hurt
            if (mobCopy.hurtTimer > 0 && mobCopy.type !== 'wolf' && mobCopy.state !== 'flee') {
                mobCopy.state = 'flee';
                mobCopy.target = [mobCopy.pos[0] - dx * 2, mobCopy.pos[1], mobCopy.pos[2] - dz * 2];
            }
        }

        // Movement & Pathfinding
        if (mobCopy.target && (mobCopy.state === 'chase' || mobCopy.state === 'wander' || mobCopy.state === 'flee')) {
            const tdx = mobCopy.target[0] - mobCopy.pos[0];
            const tdz = mobCopy.target[2] - mobCopy.pos[2];
            const tDist = Math.sqrt(tdx * tdx + tdz * tdz);

            if (tDist > 0.5) {
                const speed = stats.speed * delta * updateInterval;
                const next = getNextStep(mobCopy.pos[0], mobCopy.pos[1], mobCopy.pos[2], mobCopy.target[0], mobCopy.target[1], mobCopy.target[2]);

                let nx = mobCopy.target[0], nz = mobCopy.target[2], shouldJump = false;
                if (next) { nx = next.x; nz = next.z; shouldJump = next.jump; }

                const ndx = nx - mobCopy.pos[0], ndz = nz - mobCopy.pos[2];
                const nDist = Math.sqrt(ndx * ndx + ndz * ndz);

                if (nDist > 0.1) {
                    mobCopy.pos[0] += (ndx / nDist) * speed;
                    mobCopy.pos[2] += (ndz / nDist) * speed;
                    mobCopy.rotation = Math.atan2(ndx, ndz);
                }

                if (shouldJump && mobCopy.vel[1] === 0) {
                    mobCopy.vel[1] = 6.5;
                } else if (!next) {
                    const forwardBlock = getGroundLevel(mobCopy.pos[0] + (tdx / tDist) * 0.5, mobCopy.pos[2] + (tdz / tDist) * 0.5, s);
                    if (forwardBlock > mobCopy.pos[1] && forwardBlock < mobCopy.pos[1] + 1.2 && mobCopy.vel[1] === 0) {
                        mobCopy.vel[1] = 5.5;
                    }
                }
            } else if (mobCopy.state === 'wander') {
                mobCopy.state = 'idle';
                mobCopy.target = null;
            }
        }

        // Spider wall climbing
        if (mobCopy.type === 'spider' && mobCopy.state === 'chase') {
            const wallCheck = s.getBlock(Math.floor(mobCopy.pos[0] + Math.sin(mobCopy.rotation) * 0.6), Math.floor(mobCopy.pos[1] + 0.5), Math.floor(mobCopy.pos[2] + Math.cos(mobCopy.rotation) * 0.6));
            if (wallCheck) {
                mobCopy.vel[1] = 4 * delta * updateInterval;
                mobCopy.pos[1] += mobCopy.vel[1];
            }
        }

        // Gravity
        const bx = Math.floor(mobCopy.pos[0]);
        const bz = Math.floor(mobCopy.pos[2]);
        const hasGround = isSolid(bx, Math.floor(mobCopy.pos[1] - 0.1), bz);

        if (!hasGround) {
            mobCopy.vel[1] += GRAVITY * delta * updateInterval;
            mobCopy.pos[1] += mobCopy.vel[1] * delta * updateInterval;
            if (mobCopy.vel[1] > 0 && isSolid(bx, Math.floor(mobCopy.pos[1] + 1.8), bz)) mobCopy.vel[1] = 0;
            if (mobCopy.vel[1] < 0 && isSolid(bx, Math.floor(mobCopy.pos[1]), bz)) {
                mobCopy.pos[1] = Math.floor(mobCopy.pos[1]) + 1;
                mobCopy.vel[1] = 0;
            }
        } else {
            if (mobCopy.vel[1] < 0) {
                mobCopy.vel[1] = 0;
                mobCopy.pos[1] = Math.floor(mobCopy.pos[1] - 0.1) + 1;
            } else if (mobCopy.vel[1] > 0) {
                mobCopy.pos[1] += mobCopy.vel[1] * delta * updateInterval;
                mobCopy.vel[1] += GRAVITY * delta * updateInterval;
            }
        }

        // Remove dead mobs
        if (mobCopy.health <= 0) {
            mobs.splice(i, 1);
            changed = true;
            if (mobCopy.type === 'cow') s.addItem(BlockType.BEEF_RAW, 1);
            if (mobCopy.type === 'pig') s.addItem(BlockType.PORKCHOP_RAW, 1);
            if (mobCopy.type === 'sheep') s.addItem(BlockType.WOOL_WHITE, 1);
            if (mobCopy.type === 'chicken') s.addItem(BlockType.CHICKEN_RAW, 1);
            if (mobCopy.type === 'zombie') s.addItem(BlockType.LEATHER, 1);
            if (mobCopy.type === 'skeleton') s.addItem(BlockType.BONE, 1);
            if (mobCopy.type === 'spider') s.addItem(BlockType.STRING, 1);
            const xp = (mobCopy.type === 'blaze') ? 10 : (stats.hostile) ? 5 : Math.floor(Math.random() * 3) + 1;
            s.addXp(xp);
            playSound('pop');
            continue;
        }

        mobs[i] = mobCopy;
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
    const isNether = s.dimension === 'nether';
    const isEnd = s.dimension === 'end';

    const y = getGroundLevel(x, z, s);
    if (y < 1) return null;

    const groundBlock = s.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));

    // Choose mob type based on time/luck
    let type: MobType;

    if (isEnd) {
        type = 'enderman';
    } else if (isNether) {
        type = 'blaze';
    } else if (isNight) {
        const r = Math.random();
        if (r < 0.3) type = 'zombie';
        else if (r < 0.5) type = 'skeleton';
        else if (r < 0.65) type = 'creeper';
        else if (r < 0.8) type = 'spider';
        else if (r < 0.9) type = 'wolf';
        else type = 'enderman';
    } else {
        // Day spawning - ANIMALS ONLY
        // Requirement: Must spawn on Grass
        if (groundBlock !== BlockType.GRASS) return null;

        const r = Math.random();
        if (r < 0.25) type = 'pig';
        else if (r < 0.50) type = 'cow';
        else if (r < 0.70) type = 'sheep';
        else if (r < 0.85) type = 'chicken';
        else if (r < 0.95) type = 'wolf';
        else return null; // No day monsters
    }

    return spawnMob(type, x, y + 1, z);
}

function teleportMob(mob: Mob) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 8 + Math.random() * 8;
    mob.pos[0] += Math.cos(angle) * dist;
    mob.pos[2] += Math.sin(angle) * dist;
    // Recalculate Y
    const s = useGameStore.getState();
    mob.pos[1] = getGroundLevel(mob.pos[0], mob.pos[2], s) + 1;
    playSound('portal'); // Use portal sound for teleport
}

// ─── Heightmap Cache ────────────
const heightmapCache = new Map<string, { y: number, time: number }>();
const CACHE_TTL = 2000; // 2s

function getGroundLevel(x: number, z: number, s: ReturnType<typeof useGameStore.getState>): number {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    const key = `${bx},${bz}`;
    const now = Date.now();

    const cached = heightmapCache.get(key);
    if (cached && (now - cached.time < CACHE_TTL)) {
        return cached.y;
    }

    let foundY = 64;
    for (let y = MAX_HEIGHT - 1; y > 0; y--) {
        const block = s.getBlock(bx, y, bz);
        if (block && block !== BlockType.AIR && block !== BlockType.WATER &&
            block !== BlockType.TALL_GRASS && block !== BlockType.FLOWER_RED &&
            block !== BlockType.FLOWER_YELLOW) {
            foundY = y;
            break;
        }
    }

    heightmapCache.set(key, { y: foundY, time: now });
    // Keep cache size in check
    if (heightmapCache.size > 2000) {
        const firstKey = heightmapCache.keys().next().value;
        if (firstKey) heightmapCache.delete(firstKey);
    }

    return foundY;
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
