/**
 * First-Person Player (Full Survival Mechanics)
 *
 * Mechanics:
 *   - Gravity, collision, jump
 *   - Fall damage (>3 blocks)
 *   - Sprint hunger drain
 *   - Swimming (in water blocks)
 *   - Creative fly (double-space)
 *   - Spectator noclip
 *   - Block break with drops
 *   - Block place with consumption
 *   - Mining progress for harder blocks
 *   - View bobbing, step sounds, fall sounds
 *   - Tool speed bonuses
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import useKeyboard from './useKeyboard';
import useGameStore from '../store/gameStore';
import { BLOCK_DATA, BlockType, getBlockDrop } from '../core/blockTypes';
import { getConnection } from '../multiplayer/ConnectionManager';
import { getSpawnHeight, MAX_HEIGHT } from '../core/terrainGen';
import { emitBlockBreak, emitLandingDust, emitWaterSplash } from '../core/particles';
import { playSound, startAmbience, updateListener, updateEnvironment } from '../audio/sounds';
import { checkWaterFill, spreadWater, placeSponge } from '../core/waterSystem';
import { handleBlockAction, isOnLadder } from '../core/blockActions';
import { attackMob } from '../mobs/MobSystem';
import { spreadLava, tickLava, checkLavaFill } from '../core/lavaSystem';
import { processGravity, checkGravityBlock } from '../core/gravityBlocks';
import { placePiston } from '../core/pistonSystem';
import { tillBlock, plantSeed, applyBoneMeal } from '../core/farmingSystem';
import { buildNetherPortalSafe, getSafeHeight } from '../core/portalSystem';

// ─── Constants ───────────────────────────────────────────
const GRAVITY = -28;
const JUMP_FORCE = 8.5; // Adjusted for ~1.25 block height
const TERMINAL_VEL = -50;
const WALK_SPEED = 4.317;
const SPRINT_SPEED = 5.612;
const FLY_SPEED = 11;
const SPECTATOR_SPEED = 15;
const SWIM_SPEED = 2.2;
const PLAYER_HEIGHT = 1.62;
const PLAYER_COLLIDER_HEIGHT = 1.8;
const PLAYER_HEAD_CLEARANCE = PLAYER_COLLIDER_HEIGHT - PLAYER_HEIGHT;
const PLAYER_RB_OFFSET_Y = PLAYER_HEIGHT - PLAYER_COLLIDER_HEIGHT * 0.5;
const PLAYER_WIDTH = 0.28;
const REACH = 5;
const STEP_SIZE = 0.05;
const STEP_HEIGHT = 0.6;
const CROUCH_SPEED_MULT = 0.3;
const CROUCH_CAMERA_DROP = 0.12;
const GROUND_ACCEL = 14;
const AIR_ACCEL = 4;
const WATER_ACCEL = 7;
const GROUND_FRICTION = 10;
const AIR_FRICTION = 1.8;
const WATER_FRICTION = 4;
const COYOTE_TIME = 0.12;
const JUMP_BUFFER_TIME = 0.12;
const JUMP_RELEASE_MULT = 1.0;
const PLACE_REPEAT_INTERVAL = 0.15;
const FALL_DAMAGE_THRESHOLD = 3;
const SPRINT_HUNGER_RATE = 0.15;
const LAVA_DAMAGE_RATE = 4;
const LAVA_DAMAGE_INTERVAL = 0.5;

// ─── Weapon Damage Map (by BlockType ID) ─────────────────
const WEAPON_DAMAGE: Record<number, number> = {
    [BlockType.WOODEN_SWORD]: 5,
    [BlockType.STONE_SWORD]: 6,
    [BlockType.IRON_SWORD]: 7,
    [BlockType.GOLD_SWORD]: 5,
    [BlockType.DIAMOND_SWORD]: 8,
    [BlockType.NETHERITE_SWORD]: 9,
    [BlockType.WOODEN_AXE]: 4,
    [BlockType.STONE_AXE]: 5,
    [BlockType.IRON_AXE]: 6,
    [BlockType.GOLD_AXE]: 4,
    [BlockType.DIAMOND_AXE]: 7,
    [BlockType.NETHERITE_AXE]: 8,
};

// ─── Tool Type Checkers (by BlockType ID) ────────────────
const PICKAXE_IDS = new Set([
    BlockType.WOODEN_PICKAXE, BlockType.STONE_PICKAXE, BlockType.IRON_PICKAXE,
    BlockType.GOLD_PICKAXE, BlockType.DIAMOND_PICKAXE, BlockType.NETHERITE_PICKAXE,
]);
const AXE_IDS = new Set([
    BlockType.WOODEN_AXE, BlockType.STONE_AXE, BlockType.IRON_AXE,
    BlockType.GOLD_AXE, BlockType.DIAMOND_AXE, BlockType.NETHERITE_AXE,
]);
const SHOVEL_IDS = new Set([
    BlockType.WOODEN_SHOVEL, BlockType.STONE_SHOVEL, BlockType.IRON_SHOVEL,
    BlockType.GOLD_SHOVEL, BlockType.DIAMOND_SHOVEL, BlockType.NETHERITE_SHOVEL,
]);
const HOE_IDS = new Set([
    BlockType.WOODEN_HOE, BlockType.STONE_HOE, BlockType.IRON_HOE,
    BlockType.GOLD_HOE, BlockType.DIAMOND_HOE, BlockType.NETHERITE_HOE,
]);

// Mining speed multiplier by tool ID (Minecraft-accurate values)
const TOOL_SPEED: Record<number, number> = {
    // Pickaxes
    [BlockType.WOODEN_PICKAXE]: 2, [BlockType.STONE_PICKAXE]: 4,
    [BlockType.IRON_PICKAXE]: 6, [BlockType.GOLD_PICKAXE]: 12,
    [BlockType.DIAMOND_PICKAXE]: 8, [BlockType.NETHERITE_PICKAXE]: 9,
    // Axes
    [BlockType.WOODEN_AXE]: 2, [BlockType.STONE_AXE]: 4,
    [BlockType.IRON_AXE]: 6, [BlockType.GOLD_AXE]: 12,
    [BlockType.DIAMOND_AXE]: 8, [BlockType.NETHERITE_AXE]: 9,
    // Shovels
    [BlockType.WOODEN_SHOVEL]: 2, [BlockType.STONE_SHOVEL]: 4,
    [BlockType.IRON_SHOVEL]: 6, [BlockType.GOLD_SHOVEL]: 12,
    [BlockType.DIAMOND_SHOVEL]: 8, [BlockType.NETHERITE_SHOVEL]: 9,
    // Hoes
    [BlockType.WOODEN_HOE]: 2, [BlockType.STONE_HOE]: 4,
    [BlockType.IRON_HOE]: 6, [BlockType.GOLD_HOE]: 12,
    [BlockType.DIAMOND_HOE]: 8, [BlockType.NETHERITE_HOE]: 9,
};

const Player: React.FC = () => {
    const { camera } = useThree();
    const keys = useKeyboard();
    const controlsRef = useRef<any>(null);
    const rbRef = useRef<RapierRigidBody>(null);
    const velocity = useRef(new THREE.Vector3());
    const onGround = useRef(false);
    const pos = useRef(new THREE.Vector3(8, 80, 8));
    const highlightRef = useRef<THREE.Mesh>(null);
    const miningCrackRef = useRef<THREE.Mesh>(null);
    const isFlying = useRef(false);
    const lastJumpTime = useRef(0);
    const stepTimer = useRef(0);
    const bobPhase = useRef(0);
    const fallStart = useRef(80);
    const sprintDrainTimer = useRef(0);
    const regenTimer = useRef(0);
    const starvationTimer = useRef(0);
    const swimTimer = useRef(0);
    const miningTarget = useRef<string | null>(null);
    const miningProgress = useRef(0);
    const ambienceStarted = useRef(false);
    const lavaTimer = useRef(0);
    const miningHeld = useRef(false);
    const lavaTick = useRef(0);
    const oxygenTimer = useRef(0);
    const drowningTimer = useRef(0);
    const portalCooldown = useRef(0);
    const pendingPortalRef = useRef<{ dim: 'overworld' | 'nether' | 'end'; x: number; z: number } | null>(null);
    const bowCharge = useRef(0);
    const isChargingBow = useRef(false);
    const rayDirRef = useRef(new THREE.Vector3());
    const forwardVec = useRef(new THREE.Vector3());
    const rightVec = useRef(new THREE.Vector3());
    const flatForwardVec = useRef(new THREE.Vector3());
    const moveVec = useRef(new THREE.Vector3());
    const UP_VEC = useRef(new THREE.Vector3(0, 1, 0));
    const coyoteTimer = useRef(0);
    const jumpBufferTimer = useRef(0);
    const jumpHeldLast = useRef(false);
    const crouchVisualOffset = useRef(0);
    const stepVisualOffset = useRef(0);
    const leftMouseHeld = useRef(false);
    const rightMouseHeld = useRef(false);
    const rightRepeatTimer = useRef(0);

    const setLocked = useGameStore((s) => s.setLocked);

    const storeRef = useRef(useGameStore.getState());
    useEffect(() => {
        const unsub = useGameStore.subscribe((s) => { storeRef.current = s; });
        return unsub;
    }, []);

    useEffect(() => {
        const defaultPos = storeRef.current.playerPos;
        const isDefault = defaultPos[0] === 8 && defaultPos[1] === 80 && defaultPos[2] === 8;

        if (isDefault || defaultPos[1] < 0) {
            // Safe spawn logic for new game or fell in void while offline
            const spawnX = defaultPos[0];
            const spawnZ = defaultPos[2];
            let y = getSpawnHeight(spawnX, spawnZ);

            if (y <= 5) y = 80;
            if (y < 65) y = 65; // Minimum height (sea level)

            pos.current.set(spawnX, y + 2, spawnZ);
            fallStart.current = y + 2;
        } else {
            // Respect loaded save state
            pos.current.set(defaultPos[0], defaultPos[1], defaultPos[2]);
            fallStart.current = defaultPos[1];
            // Respect loaded rotation (camera)
            const rot = storeRef.current.playerRot;
            camera.rotation.set(rot[1], rot[0], 0);
        }

        velocity.current.set(0, 0, 0);
        onGround.current = false;

        // Force camera to spawn
        camera.position.copy(pos.current);
    }, []); // Run once on mount

    // Start ambience on first interaction
    useEffect(() => {
        const start = () => {
            if (!ambienceStarted.current) {
                ambienceStarted.current = true;
                startAmbience();
            }
        };
        window.addEventListener('click', start, { once: true });
        return () => window.removeEventListener('click', start);
    }, []);

    // Handle physical knockbacks (Explosions)
    useEffect(() => {
        const handleImpulse = (e: CustomEvent<{ x: number, y: number, z: number }>) => {
            if (useGameStore.getState().gameMode !== 'spectator') {
                velocity.current.x += e.detail.x;
                velocity.current.y += e.detail.y;
                velocity.current.z += e.detail.z;
                onGround.current = false;
            }
        };
        window.addEventListener('player-impulse', handleImpulse as EventListener);
        return () => window.removeEventListener('player-impulse', handleImpulse as EventListener);
    }, []);

    // ─── Block Lookup Cache (Cleared per frame) ────────────
    const blockCache = useRef(new Map<string, number>());
    const getCachedBlock = useCallback((bx: number, by: number, bz: number) => {
        const key = `${bx},${by},${bz}`;
        const cache = blockCache.current;
        let type = cache.get(key);
        if (type !== undefined) return type;
        type = storeRef.current.getBlock(bx, by, bz);
        cache.set(key, type);
        return type;
    }, []);

    // ─── Collision ─────────────────────────────────────────
    const isSolid = useCallback((x: number, y: number, z: number): boolean => {
        const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
        const type = getCachedBlock(bx, by, bz);
        if (!type) return false;
        return BLOCK_DATA[type]?.solid ?? false;
    }, [getCachedBlock]);

    const isInWater = useCallback((x: number, y: number, z: number): boolean => {
        const type = getCachedBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        return type === BlockType.WATER;
    }, [getCachedBlock]);

    const isInLava = useCallback((x: number, y: number, z: number): boolean => {
        const type = getCachedBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        return type === BlockType.LAVA;
    }, [getCachedBlock]);

    // ─── Raycast ───────────────────────────────────────────
    const raycastBlock = useCallback((): { block: [number, number, number]; place: [number, number, number] } | null => {
        const dir = rayDirRef.current;
        camera.getWorldDirection(dir);
        const origin = camera.position;
        let px = Math.floor(origin.x), py = Math.floor(origin.y), pz = Math.floor(origin.z);
        for (let t = 0; t < REACH; t += STEP_SIZE) {
            const bx = Math.floor(origin.x + dir.x * t);
            const by = Math.floor(origin.y + dir.y * t);
            const bz = Math.floor(origin.z + dir.z * t);
            const type = getCachedBlock(bx, by, bz);
            if (type && BLOCK_DATA[type]?.solid) {
                return { block: [bx, by, bz], place: [px, py, pz] };
            }
            px = bx; py = by; pz = bz;
        }
        return null;
    }, [camera, getCachedBlock]);

    // ─── Bump Version ──────────────────────────────────────
    const bumpAround = useCallback((wx: number, wz: number) => {
        const s = storeRef.current;
        const cx = Math.floor(wx / 16);
        const cz = Math.floor(wz / 16);
        s.bumpVersion(cx, cz);
        const lx = ((wx % 16) + 16) % 16;
        const lz = ((wz % 16) + 16) % 16;
        if (lx === 0) s.bumpVersion(cx - 1, cz);
        if (lx === 15) s.bumpVersion(cx + 1, cz);
        if (lz === 0) s.bumpVersion(cx, cz - 1);
        if (lz === 15) s.bumpVersion(cx, cz + 1);
    }, []);

    // ─── Mouse Events ─────────────────────────────────────
    useEffect(() => {
        const onMouseDown = (e: MouseEvent) => {
            const s = storeRef.current;
            if (!s.isLocked || s.activeOverlay !== 'none' || s.screen !== 'playing') return;

            const selected = s.getSelectedBlock();
            const hit = raycastBlock();
            if (e.button === 0) leftMouseHeld.current = true;
            if (e.button === 2) rightMouseHeld.current = true;

            if (e.button === 0) {
                miningHeld.current = true;
                // ── Break Block or Attack Mob ──
                const dir = camera.getWorldDirection(new THREE.Vector3());
                // Use ID-based damage map for accuracy
                let damage = selected ? (WEAPON_DAMAGE[selected] ?? 2) : 2;
                // Sharpness enchant: +0.5 per level (rounds to +1 per 2 levels)
                const heldSlotForAtk = s.hotbar[s.hotbarSlot];
                const sharpLevel = (heldSlotForAtk as any)?.sharpness ?? 0;
                if (sharpLevel > 0) damage += Math.ceil(sharpLevel * 0.5);

                const hitMob = attackMob(
                    pos.current.x, pos.current.y, pos.current.z,
                    [dir.x, dir.y, dir.z], damage
                );

                if (hitMob) {
                    // Apply tool durability damage
                    if (selected && BLOCK_DATA[selected]?.isItem && BLOCK_DATA[selected]?.maxDurability) {
                        s.damageTool(s.hotbarSlot);
                    }
                    getConnection().sendAction('swing');
                    return;
                }

                getConnection().sendAction('swing');

                if (!hit) {
                    return;
                }
                const [bx, by, bz] = hit.block;
                const type = s.getBlock(bx, by, bz);
                if (type && type !== BlockType.BEDROCK) {
                    if (s.gameMode === 'spectator') return;

                    // Creative = instant break
                    if (s.gameMode === 'creative') {
                        emitBlockBreak(bx, by, bz, type);
                        playSound('break', [bx, by, bz]);
                        s.removeBlock(bx, by, bz);
                        bumpAround(bx, bz);
                        checkWaterFill(bx, by, bz);
                        checkLavaFill(bx, by, bz);
                        processGravity(bx, by, bz);
                        return;
                    }

                    // Survival = hold-to-mine (start)
                    const blockData = BLOCK_DATA[type];
                    if (blockData && blockData.breakTime > 0) {
                        miningTarget.current = `${bx},${by},${bz}`;
                        miningProgress.current = 0;
                        miningHeld.current = true;
                        return;
                    }

                    // Instant break blocks (breakTime = 0)
                    emitBlockBreak(bx, by, bz, type);
                    playSound('break', [bx, by, bz]);
                    s.removeBlock(bx, by, bz);
                    bumpAround(bx, bz);
                    checkWaterFill(bx, by, bz);
                    checkLavaFill(bx, by, bz);
                    processGravity(bx, by, bz);

                    const drop = getBlockDrop(type);
                    if (drop && drop !== BlockType.AIR) {
                        s.addDroppedItem(drop, [bx + 0.5, by + 0.5, bz + 0.5]);
                        playSound('pop');
                    }
                }
            } else if (e.button === 2) {
                // ── Right Click: Interact or Place Block ──
                if (selected && BLOCK_DATA[selected]?.foodRestore) {
                    // Eat if: purely food item (isItem) OR if hungry
                    if (s.hunger < s.maxHunger || BLOCK_DATA[selected].isItem) {
                        s.eatFood();
                        getConnection().sendAction('eat');
                        if (BLOCK_DATA[selected].isItem) return;
                    }
                }

                if (!hit) {
                    if (selected === BlockType.BOW && s.gameMode !== 'spectator') {
                        isChargingBow.current = true;
                        bowCharge.current = 0;
                    }
                    if (selected === BlockType.EYE_OF_ENDER && s.gameMode !== 'spectator') {
                        // Throw eye towards 0,0 (simplified stronghold logic)
                        s.addEyeOfEnder([camera.position.x, camera.position.y, camera.position.z], [0, 0]);
                        s.consumeHotbarItem(s.hotbarSlot);
                        playSound('pop');
                    }
                    if (selected === BlockType.ENDER_PEARL && s.gameMode !== 'spectator') {
                        const dir = camera.getWorldDirection(new THREE.Vector3());
                        const vel: [number, number, number] = [dir.x * 25, dir.y * 25 + 2, dir.z * 25];
                        s.addPearl([camera.position.x, camera.position.y, camera.position.z], vel);
                        s.consumeHotbarItem(s.hotbarSlot);
                        playSound('pop');
                    }
                    return;
                }
                if (s.gameMode === 'spectator') return;

                if (selected === BlockType.BOW) {
                    isChargingBow.current = true;
                    bowCharge.current = 0;
                    return;
                }

                // Check if we right-clicked a functional block
                const [bx2, by2, bz2] = hit.block;
                const clickedType = s.getBlock(bx2, by2, bz2);

                if (clickedType === BlockType.CRAFTING) {
                    s.setOverlay('crafting');
                    playSound('open');
                    document.exitPointerLock();
                    return;
                }
                if (clickedType === BlockType.FURNACE || clickedType === BlockType.FURNACE_ON) {
                    s.setOverlay('furnace');
                    playSound('open');
                    document.exitPointerLock();
                    return;
                }

                // Check block actions (TNT, trapdoor, chest, etc.)
                if (handleBlockAction(bx2, by2, bz2, clickedType, selected)) {
                    return;
                }

                const [px, py, pz] = hit.place;
                if (py < 0 || py > MAX_HEIGHT - 1) return;
                if (!selected) return;

                if ([105, 115, 125, 135, 145].includes(selected)) {
                    if (tillBlock(bx2, by2, bz2)) {
                        s.damageTool(s.hotbarSlot);
                        playSound('gravel');
                        bumpAround(bx2, bz2);
                        return;
                    }
                }
                if (selected === BlockType.SEEDS) {
                    if (plantSeed(px, py, pz)) {
                        s.consumeHotbarItem(s.hotbarSlot);
                        playSound('place', [px, py, pz]);
                        bumpAround(px, pz);
                        return;
                    }
                }
                if (selected === BlockType.BONE_MEAL) {
                    if (applyBoneMeal(bx2, by2, bz2)) {
                        s.consumeHotbarItem(s.hotbarSlot);
                        playSound('pop');
                        bumpAround(bx2, bz2);
                        return;
                    }
                }
                if (selected === BlockType.FLINT_AND_STEEL) {
                    if (py > hit.block[1]) { // Only place fire on top of blocks
                        s.addBlock(px, py, pz, BlockType.FIRE);
                        s.damageTool(s.hotbarSlot);
                        playSound('place', [px, py, pz]);
                        bumpAround(px, pz);
                        return;
                    }
                }

                if (BLOCK_DATA[selected]?.isItem) return;

                const feet = Math.floor(pos.current.y - PLAYER_HEIGHT);
                const head = Math.floor(pos.current.y);
                const plX = Math.floor(pos.current.x);
                const plZ = Math.floor(pos.current.z);
                if (px === plX && pz === plZ && py >= feet && py <= head) return;

                // Prevent placing block inside a currently falling block (prevents massive physics flying glitches)
                const isInsideFallingBlock = s.fallingBlocks.some(fb =>
                    Math.abs(fb.pos[0] - (px + 0.5)) < 0.8 &&
                    Math.abs(fb.pos[1] - (py + 0.5)) < 0.8 &&
                    Math.abs(fb.pos[2] - (pz + 0.5)) < 0.8
                );
                if (isInsideFallingBlock) return;

                if (selected === BlockType.BED) {
                    import('../core/blockActions').then(({ handleBedPlacement }) => {
                        if (handleBedPlacement(px, py, pz, camera.rotation.y)) {
                            s.consumeHotbarItem(s.hotbarSlot);
                            playSound('place', [px, py, pz]);
                            bumpAround(px, pz);
                        }
                    });
                    return;
                }

                if (selected === BlockType.PISTON || selected === BlockType.PISTON_STICKY) {
                    const dir = new THREE.Vector3();
                    camera.getWorldDirection(dir);
                    dir.negate();
                    let pDir = 0;
                    if (Math.abs(dir.y) > Math.abs(dir.x) && Math.abs(dir.y) > Math.abs(dir.z)) {
                        pDir = dir.y > 0 ? 1 : 0;
                    } else if (Math.abs(dir.x) > Math.abs(dir.z)) {
                        pDir = dir.x > 0 ? 5 : 4;
                    } else {
                        pDir = dir.z > 0 ? 3 : 2;
                    }
                    placePiston(px, py, pz, pDir, selected === BlockType.PISTON_STICKY);
                    s.consumeHotbarItem(s.hotbarSlot);
                    bumpAround(px, pz);
                    return;
                }

                s.addBlock(px, py, pz, selected);
                s.consumeHotbarItem(s.hotbarSlot);
                playSound('place', [px, py, pz]);
                bumpAround(px, pz);
                if (selected === BlockType.WATER) spreadWater(px, py, pz);
                if (selected === BlockType.LAVA) spreadLava(px, py, pz);
                checkGravityBlock(px, py, pz);
                return;
            }
        };

        const onMouseUp = (e: MouseEvent) => {
            if (e.button === 0) {
                leftMouseHeld.current = false;
                miningHeld.current = false;
                miningTarget.current = null;
                miningProgress.current = 0;
            } else if (e.button === 2) {
                rightMouseHeld.current = false;
                rightRepeatTimer.current = 0;
                if (isChargingBow.current) {
                    const s = storeRef.current;
                    const power = Math.min(1.0, bowCharge.current);
                    if (power > 0.1) {
                        const dir = camera.getWorldDirection(new THREE.Vector3());
                        const velocity: [number, number, number] = [
                            dir.x * 30 * power,
                            dir.y * 30 * power,
                            dir.z * 30 * power
                        ];
                        const origin: [number, number, number] = [camera.position.x, camera.position.y - 0.2, camera.position.z];
                        s.addArrow(origin, velocity);
                        playSound('bow');
                    }
                    isChargingBow.current = false;
                    bowCharge.current = 0;
                }
            }
        };

        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [raycastBlock, bumpAround]);

    // ─── Middle Click (pick block) ─────────────────────────
    useEffect(() => {
        const onMid = (e: MouseEvent) => {
            if (e.button !== 1) return;
            const s = storeRef.current;
            if (!s.isLocked || s.activeOverlay !== 'none') return;
            const hit = raycastBlock();
            if (hit) {
                const type = s.getBlock(hit.block[0], hit.block[1], hit.block[2]);
                if (type) {
                    // Find in hotbar or add
                    for (let i = 0; i < 9; i++) {
                        if (s.hotbar[i].id === type) {
                            s.setHotbarSlot(i);
                            return;
                        }
                    }
                    if (s.gameMode === 'creative') {
                        const newHotbar = s.hotbar.map(sl => ({ ...sl }));
                        newHotbar[s.hotbarSlot] = { id: type, count: 64 };
                        s.setHotbar(newHotbar);
                    }
                }
            }
        };
        window.addEventListener('mousedown', onMid);
        return () => window.removeEventListener('mousedown', onMid);
    }, [raycastBlock]);

    // ─── Pointer Lock ──────────────────────────────────────
    useEffect(() => {
        const ctrl = controlsRef.current;
        if (!ctrl) return;
        const onLock = () => storeRef.current.setLocked(true);
        const onUnlock = () => storeRef.current.setLocked(false);
        ctrl.addEventListener('lock', onLock);
        ctrl.addEventListener('unlock', onUnlock);
        return () => {
            ctrl.removeEventListener('lock', onLock);
            ctrl.removeEventListener('unlock', onUnlock);
        };
    }, []);

    // ─── Fixed 20 TPS Game Loop ──────────────────────────────
    const accumulator = useRef(0);
    const TICK_RATE = 1 / 20; // 50ms per tick
    const MAX_TICKS_PER_FRAME = 4; // prevent spiral of death

    useFrame((_, rawDelta) => {
        const s = storeRef.current;
        if (s.activeOverlay !== 'none' || !s.isLocked || s.screen !== 'playing') return;

        // Clear cache at the start of the frame so physics/raycasts always see fresh data
        blockCache.current.clear();

        if (isChargingBow.current) {
            bowCharge.current += rawDelta;
        }

        accumulator.current += Math.min(rawDelta, 0.25);

        let ticksThisFrame = 0;
        let bobY = 0; // Visual offset for this frame

        while (accumulator.current >= TICK_RATE && ticksThisFrame < MAX_TICKS_PER_FRAME) {
            accumulator.current -= TICK_RATE;
            ticksThisFrame++;

            // ── One Physics Tick (dt = TICK_RATE = 50ms) ──
            const dt = TICK_RATE;
            const vel = velocity.current;
            const p = pos.current;
            const mode = s.gameMode;
            const forward = forwardVec.current;
            const right = rightVec.current;
            const flatForward = flatForwardVec.current;

            // ─── Pending Portal Teleport (Wait for chunk) ────────
            if (pendingPortalRef.current) {
                const pend = pendingPortalRef.current;
                if (s.dimension === pend.dim) {
                    const cx = Math.floor(pend.x / 16);
                    const cz = Math.floor(pend.z / 16);
                    const key = `${cx},${cz}`;
                    if (s.chunks[key] || pend.dim === 'end') {
                        let sy = 65;
                        if (pend.dim === 'end') {
                            sy = 65;
                            p.set(0, sy, 0);
                        } else {
                            const searchRange = pend.dim === 'nether' ? [32, 110] : [62, 150];
                            sy = getSafeHeight(pend.x, pend.z, searchRange as [number, number]);
                            p.set(pend.x + 0.5, sy + 1.5, pend.z + 0.5);
                            buildNetherPortalSafe(pend.x, sy, pend.z);
                        }
                        vel.set(0, 0, 0);
                        fallStart.current = sy + 1.5;
                        playSound('portal');
                        pendingPortalRef.current = null;
                    } else {
                        vel.set(0, 0, 0);
                        p.y = 200; // Suspend high up to avoid suffocation
                    }
                }
                continue; // Skip the rest of the physical tick
            }

            camera.getWorldDirection(forward);
            flatForward.copy(forward); flatForward.y = 0; flatForward.normalize();
            right.crossVectors(flatForward, UP_VEC.current).normalize();

            const k = keys.current ?? {};
            const jumpHeld = !!k.Space;
            const jumpPressed = jumpHeld && !jumpHeldLast.current;
            const jumpReleased = !jumpHeld && jumpHeldLast.current;
            jumpHeldLast.current = jumpHeld;
            if (jumpPressed) jumpBufferTimer.current = JUMP_BUFFER_TIME;
            else jumpBufferTimer.current = Math.max(0, jumpBufferTimer.current - dt);

            if (onGround.current) coyoteTimer.current = COYOTE_TIME;
            else coyoteTimer.current = Math.max(0, coyoteTimer.current - dt);

            const feetInWater = isInWater(p.x, p.y - PLAYER_HEIGHT + 0.1, p.z);
            const bodyInWater = isInWater(p.x, p.y - 0.5, p.z);
            const headInWater = isInWater(p.x, p.y + 0.1, p.z);
            const inWater = feetInWater || bodyInWater;
            const isSneaking = k.ControlLeft && !inWater && !isFlying.current;
            const isSprinting = k.ShiftLeft && !k.ControlLeft && !inWater && !isFlying.current;

            if (rightMouseHeld.current && !isChargingBow.current && mode !== 'spectator') {
                rightRepeatTimer.current += dt;
                if (rightRepeatTimer.current >= PLACE_REPEAT_INTERVAL) {
                    rightRepeatTimer.current = 0;

                    const held = s.getSelectedBlock();
                    if (held && held !== BlockType.BOW) {
                        const repeatHit = raycastBlock();
                        if (repeatHit) {
                            const [bx2, by2, bz2] = repeatHit.block;
                            const clickedType = s.getBlock(bx2, by2, bz2);
                            const [px, py, pz] = repeatHit.place;

                            const blocksUi = clickedType === BlockType.CRAFTING || clickedType === BlockType.FURNACE || clickedType === BlockType.FURNACE_ON || clickedType === BlockType.CHEST;
                            if (!blocksUi && py >= 0 && py <= MAX_HEIGHT - 1) {
                                if ([105, 115, 125, 135, 145].includes(held)) {
                                    if (tillBlock(bx2, by2, bz2)) {
                                        s.damageTool(s.hotbarSlot);
                                        bumpAround(bx2, bz2);
                                        playSound('gravel');
                                    }
                                } else if (held === BlockType.SEEDS) {
                                    if (plantSeed(px, py, pz)) {
                                        s.consumeHotbarItem(s.hotbarSlot);
                                        bumpAround(px, pz);
                                        playSound('place', [px, py, pz]);
                                    }
                                } else if (held === BlockType.BONE_MEAL) {
                                    if (applyBoneMeal(bx2, by2, bz2)) {
                                        s.consumeHotbarItem(s.hotbarSlot);
                                        bumpAround(bx2, bz2);
                                        playSound('pop');
                                    }
                                } else if (!BLOCK_DATA[held]?.isItem && held !== BlockType.BED && held !== BlockType.PISTON && held !== BlockType.PISTON_STICKY) {
                                    const feet = Math.floor(p.y - PLAYER_HEIGHT);
                                    const head = Math.floor(p.y);
                                    const plX = Math.floor(p.x);
                                    const plZ = Math.floor(p.z);
                                    if (!(px === plX && pz === plZ && py >= feet && py <= head)) {
                                        s.addBlock(px, py, pz, held);
                                        s.consumeHotbarItem(s.hotbarSlot);
                                        bumpAround(px, pz);
                                        playSound('place', [px, py, pz]);
                                        if (held === BlockType.WATER) spreadWater(px, py, pz);
                                        if (held === BlockType.LAVA) spreadLava(px, py, pz);
                                        if (held === BlockType.SPONGE) placeSponge(px, py, pz);
                                        checkGravityBlock(px, py, pz);
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                rightRepeatTimer.current = 0;
            }

            // ─── Spectator ───────────────────────────────────
            if (mode === 'spectator') {
                const move = moveVec.current.set(0, 0, 0);
                const spd = k.ShiftLeft ? SPECTATOR_SPEED * 2 : SPECTATOR_SPEED;
                if (k.KeyW) move.add(forward);
                if (k.KeyS) move.sub(forward);
                if (k.KeyA) move.sub(right);
                if (k.KeyD) move.add(right);
                if (k.Space) move.y += 1;
                if (k.ControlLeft) move.y -= 1;
                if (move.lengthSq() > 0) move.normalize().multiplyScalar(spd);
                p.add(move.multiplyScalar(dt));
                camera.position.copy(p);
                s.setPlayerPos([p.x, p.y, p.z]);
                s.setPlayerVel([move.x, move.y, move.z]); // Spectator use move vector as vel
                s.setPlayerRot([camera.rotation.y, camera.rotation.x]);
                if (highlightRef.current) highlightRef.current.visible = false;
                continue;
            }

            // ─── Creative Fly Toggle ─────────────────────────
            if (mode === 'creative' && k.Space) {
                const now = performance.now();
                if (now - lastJumpTime.current < 300 && !onGround.current) {
                    isFlying.current = !isFlying.current;
                    lastJumpTime.current = 0;
                } else if (onGround.current) {
                    lastJumpTime.current = now;
                }
            }

            // ─── Movement ────────────────────────────────────
            const flying = mode === 'creative' && isFlying.current;
            const baseSpeed = flying ? FLY_SPEED : (isSprinting ? SPRINT_SPEED : WALK_SPEED);
            const speed = inWater ? SWIM_SPEED : (isSneaking && !flying ? WALK_SPEED * CROUCH_SPEED_MULT : baseSpeed);
            const move = moveVec.current.set(0, 0, 0);
            if (k.KeyW) move.add(flatForward);
            if (k.KeyS) move.sub(flatForward);
            if (k.KeyA) move.sub(right);
            if (k.KeyD) move.add(right);
            const hasMoveInput = move.lengthSq() > 0;
            if (hasMoveInput) move.normalize().multiplyScalar(speed);

            // Minecraft-like inertia: acceleration + friction instead of instant velocity snap.
            const blockBelow = getCachedBlock(Math.floor(p.x), Math.floor(p.y - PLAYER_HEIGHT - 0.1), Math.floor(p.z));
            const isIce = blockBelow === BlockType.ICE;

            const accel = inWater ? WATER_ACCEL : (onGround.current ? (isIce ? 2.5 : GROUND_ACCEL) : AIR_ACCEL);
            const friction = inWater ? WATER_FRICTION : (onGround.current ? (isIce ? 1.5 : GROUND_FRICTION) : AIR_FRICTION);
            const accelLerp = Math.min(1, accel * dt);
            vel.x += (move.x - vel.x) * accelLerp;
            vel.z += (move.z - vel.z) * accelLerp;
            if (!hasMoveInput) {
                const damp = Math.max(0, 1 - friction * dt);
                vel.x *= damp;
                vel.z *= damp;
            }

            const crouchTarget = isSneaking && onGround.current && !flying ? -CROUCH_CAMERA_DROP : 0;
            crouchVisualOffset.current += (crouchTarget - crouchVisualOffset.current) * Math.min(1, dt * 12);
            stepVisualOffset.current += (0 - stepVisualOffset.current) * Math.min(1, dt * 15);

            if (flying) {
                vel.y = 0;
                if (k.Space) vel.y = FLY_SPEED;
                if (k.ShiftLeft) vel.y = -FLY_SPEED;
            } else if (inWater) {
                // ─── Improved Swimming Physics ──────────────
                // Depth-proportional water resistance
                const submersion = (feetInWater ? 0.33 : 0) + (bodyInWater ? 0.33 : 0) + (headInWater ? 0.34 : 0);
                const waterDrag = 0.8 - (submersion * 0.15); // 0.65 to 0.80

                vel.y *= waterDrag;

                if (k.Space) {
                    // Buoyancy: stronger when not at surface, weaker at surface
                    if (headInWater) {
                        vel.y = Math.min(vel.y + 15 * dt, 3.5); // Strong upward push
                    } else if (bodyInWater) {
                        vel.y = Math.min(vel.y + 8 * dt, 2.0); // At surface, gentle float
                    } else {
                        // Head is above water, can jump out
                        vel.y = JUMP_FORCE * 0.6;
                    }
                } else {
                    // Slow sinking with buoyancy equilibrium
                    const buoyancy = bodyInWater ? GRAVITY * 0.15 : GRAVITY * 0.4;
                    vel.y += buoyancy * dt;
                }

                // Horizontal water resistance
                vel.x *= waterDrag;
                vel.z *= waterDrag;

                // Swim sounds
                swimTimer.current += dt;
                if (swimTimer.current > 0.8 && (Math.abs(vel.x) > 0.3 || Math.abs(vel.z) > 0.3)) {
                    playSound('swim');
                    swimTimer.current = 0;
                }
            } else {
                if ((jumpBufferTimer.current > 0 || jumpHeld) && coyoteTimer.current > 0) {
                    vel.y = JUMP_FORCE;
                    onGround.current = false;
                    fallStart.current = p.y;
                    jumpBufferTimer.current = 0;
                    coyoteTimer.current = 0;
                }
                vel.y += GRAVITY * dt;
                if (jumpReleased && vel.y > 0) {
                    vel.y *= JUMP_RELEASE_MULT;
                }
                if (vel.y < TERMINAL_VEL) vel.y = TERMINAL_VEL;

                // Footsteps
                if (onGround.current && (Math.abs(vel.x) > 0.1 || Math.abs(vel.z) > 0.1)) {
                    stepTimer.current += dt;
                    const stepInterval = isSneaking ? 0.62 : (isSprinting ? 0.3 : 0.45);
                    if (stepTimer.current > stepInterval) {
                        stepTimer.current = 0;
                        const blockBelow = getCachedBlock(Math.floor(p.x), Math.floor(p.y - PLAYER_HEIGHT - 0.1), Math.floor(p.z));
                        let stepSound: any = 'grass_step';
                        if (blockBelow) {
                            const data = BLOCK_DATA[blockBelow];
                            if (data?.tool === 'pickaxe' || data?.name.includes('Kamień') || data?.name.includes('Podłoże') || data?.name.includes('Piec')) stepSound = 'stone_step';
                            else if (data?.tool === 'axe' || data?.name.includes('Pień') || data?.name.includes('Skrzynia') || data?.name.includes('Biblioteczka')) stepSound = 'wood_step';
                            else if (data?.name.includes('Piasek')) stepSound = 'sand_step';
                        }
                        playSound(stepSound, [p.x, p.y - PLAYER_HEIGHT, p.z]);
                    }
                } else {
                    stepTimer.current = 0;
                }
            }

            // Sync Spatial Audio Listener & Environment
            const headSubmerged = headInWater;
            let caveCheck = false;
            // Simple cave check: below sea level and has roof
            if (p.y < 62 && s.dimension === 'overworld') {
                for (let yOff = 2; yOff < 12; yOff++) {
                    if (isSolid(p.x, p.y + yOff, p.z)) {
                        caveCheck = true;
                        break;
                    }
                }
            } else if (s.dimension === 'nether') {
                caveCheck = true; // Nether always has reverb
            }

            updateListener(p.x, p.y, p.z, forward.x, forward.y, forward.z);
            updateEnvironment(headSubmerged, caveCheck);

            // Track fall start
            if (!onGround.current && !flying && !inWater) {
                if (vel.y > 0) fallStart.current = Math.max(fallStart.current, p.y);
            }

            // ─── Collision ───────────────────────────────────
            const w = PLAYER_WIDTH;
            const collidesAt = (x: number, y: number, z: number) => (
                isSolid(x - w, y - PLAYER_HEIGHT, z - w) || isSolid(x + w, y - PLAYER_HEIGHT, z - w) ||
                isSolid(x - w, y - PLAYER_HEIGHT, z + w) || isSolid(x + w, y - PLAYER_HEIGHT, z + w) ||
                isSolid(x - w, y - 0.5, z - w) || isSolid(x + w, y - 0.5, z - w) ||
                isSolid(x - w, y - 0.5, z + w) || isSolid(x + w, y - 0.5, z + w) ||
                isSolid(x - w, y + PLAYER_HEAD_CLEARANCE, z - w) || isSolid(x + w, y + PLAYER_HEAD_CLEARANCE, z - w) ||
                isSolid(x - w, y + PLAYER_HEAD_CLEARANCE, z + w) || isSolid(x + w, y + PLAYER_HEAD_CLEARANCE, z + w)
            );
            const hasSupportBelow = (x: number, z: number) => {
                const footY = p.y - PLAYER_HEIGHT - 0.06;
                return (
                    isSolid(x - w, footY, z - w) || isSolid(x + w, footY, z - w) ||
                    isSolid(x - w, footY, z + w) || isSolid(x + w, footY, z + w)
                );
            };
            const canStepTo = (x: number, z: number) =>
                onGround.current && !flying && !inWater && !collidesAt(x, p.y + STEP_HEIGHT, z);

            if (isSneaking && onGround.current && !flying && !inWater) {
                const testX = p.x + vel.x * dt;
                const testZ = p.z + vel.z * dt;
                if (!hasSupportBelow(testX, p.z)) vel.x = 0;
                if (!hasSupportBelow(p.x, testZ)) vel.z = 0;
            }

            const wasY = p.y;
            const nx = p.x + vel.x * dt;
            if (collidesAt(nx, p.y, p.z)) {
                if (canStepTo(nx, p.z)) {
                    p.y += STEP_HEIGHT;
                    p.x = nx;
                    onGround.current = false;
                } else {
                    vel.x = 0;
                }
            } else {
                p.x = nx;
            }

            const nz = p.z + vel.z * dt;
            if (collidesAt(p.x, p.y, nz)) {
                if (canStepTo(p.x, nz)) {
                    p.y += STEP_HEIGHT;
                    p.z = nz;
                    onGround.current = false;
                } else {
                    vel.z = 0;
                }
            } else {
                p.z = nz;
            }

            if (p.y > wasY && p.y - wasY <= STEP_HEIGHT) {
                stepVisualOffset.current -= (p.y - wasY); // Smooth out the snap
            }

            const ny = p.y + vel.y * dt;
            const wasInAir = !onGround.current;
            onGround.current = false;

            if (vel.y < 0 && !flying) {
                if (
                    isSolid(p.x - w, ny - PLAYER_HEIGHT, p.z - w) || isSolid(p.x + w, ny - PLAYER_HEIGHT, p.z - w) ||
                    isSolid(p.x - w, ny - PLAYER_HEIGHT, p.z + w) || isSolid(p.x + w, ny - PLAYER_HEIGHT, p.z + w)
                ) {
                    p.y = Math.floor(ny - PLAYER_HEIGHT) + 1 + PLAYER_HEIGHT;

                    // ─── Fall Damage & Bouncing ────────────────
                    // MINECRAFT RULE: Armor NEVER reduces fall damage.
                    // Only Feather Falling enchantment (boots) reduces it.
                    const fallDist = fallStart.current - p.y;
                    const blockBelowImpact = getCachedBlock(Math.floor(p.x), Math.floor(p.y - PLAYER_HEIGHT - 0.1), Math.floor(p.z));

                    if (blockBelowImpact === BlockType.SLIME_BLOCK && !isSneaking) {
                        // Slime Block Bounce
                        if (fallDist > 1.5 && Math.abs(vel.y) > 5) {
                            vel.y = Math.abs(vel.y) * 0.8; // Lose 20% velocity on max bounce
                            onGround.current = false;
                            p.y += 0.05; // Pop slightly above to prevent immediate re-collision
                            fallStart.current = p.y; // reset fall dist
                            playSound('slime_step', [p.x, p.y, p.z]);
                        } else {
                            vel.y = 0;
                            onGround.current = true;
                            isFlying.current = false;
                            fallStart.current = p.y;
                        }
                    } else {
                        if (wasInAir && mode === 'survival' && !inWater) {
                            if (fallDist > FALL_DAMAGE_THRESHOLD) {
                                let damage = Math.floor(fallDist - FALL_DAMAGE_THRESHOLD);

                                // Reduce damage on hay bales
                                if (blockBelowImpact === BlockType.HAY_BALE) {
                                    damage = Math.floor(damage * 0.2);
                                }

                                // Feather Falling: -12% per level (max IV = 48% reduction)
                                const bootsSlot = s.armor?.boots;
                                if (bootsSlot?.id && bootsSlot.featherFalling) {
                                    const ffLevel = Math.min(4, bootsSlot.featherFalling);
                                    damage = Math.floor(damage * (1 - ffLevel * 0.12));
                                }
                                if (damage > 0) {
                                    // ignoreArmor: true — armor NEVER reduces fall damage
                                    s.takeDamage(damage, { ignoreArmor: true, source: 'Spadłeś z dużej wysokości!' });
                                    playSound('hurt', [p.x, p.y, p.z]);
                                }
                            }
                            playSound('land', [p.x, p.y - PLAYER_HEIGHT, p.z]);
                            // Landing dust on impact
                            if (blockBelowImpact && blockBelowImpact !== 0) {
                                emitLandingDust(p.x, p.y - PLAYER_HEIGHT, p.z, blockBelowImpact);
                            }
                        } else if (fallDist > 1) {
                            playSound('land', [p.x, p.y - PLAYER_HEIGHT, p.z]);
                            if (blockBelowImpact && blockBelowImpact !== 0) {
                                emitLandingDust(p.x, p.y - PLAYER_HEIGHT, p.z, blockBelowImpact);
                            }
                        }

                        vel.y = 0;
                        onGround.current = true;
                        isFlying.current = false;
                        fallStart.current = p.y;
                    }
                } else { p.y = ny; }
            } else {
                if (!flying && (
                    isSolid(p.x - w, ny + PLAYER_HEAD_CLEARANCE, p.z - w) || isSolid(p.x + w, ny + PLAYER_HEAD_CLEARANCE, p.z - w) ||
                    isSolid(p.x - w, ny + PLAYER_HEAD_CLEARANCE, p.z + w) || isSolid(p.x + w, ny + PLAYER_HEAD_CLEARANCE, p.z + w)
                )) { vel.y = 0; }
                else { p.y = ny; }
            }

            // Track fall distance going up
            if (!onGround.current && !flying && !inWater && vel.y > 0) {
                fallStart.current = p.y;
            }

            // ─── Sprint Hunger Drain ─────────────────────────
            if (mode === 'survival' && isSprinting && (Math.abs(vel.x) > 0.5 || Math.abs(vel.z) > 0.5)) {
                sprintDrainTimer.current += dt;
                if (sprintDrainTimer.current > 1) {
                    s.setHunger(Math.max(0, s.hunger - SPRINT_HUNGER_RATE));
                    sprintDrainTimer.current = 0;
                }
            } else {
                sprintDrainTimer.current = 0;
            }

            // ─── Health regen from full hunger ────────────────
            if (mode === 'survival' && s.hunger >= 18 && s.health < s.maxHealth) {
                regenTimer.current += dt;
                if (regenTimer.current > 4) {
                    s.setHealth(s.health + 1);
                    s.setHunger(Math.max(0, s.hunger - 0.5));
                    regenTimer.current = 0;
                }
            } else {
                regenTimer.current = 0;
            }

            // ─── Starvation damage ───────────────────────────
            if (mode === 'survival' && s.hunger <= 0) {
                starvationTimer.current += dt;
                if (starvationTimer.current > 4) {
                    starvationTimer.current = 0;
                    s.takeDamage(1, { ignoreArmor: true, source: 'Umarłeś z głodu!' });
                }
            } else {
                starvationTimer.current = 0;
            }

            const inLava = isInLava(p.x, p.y - PLAYER_HEIGHT + 0.1, p.z) || isInLava(p.x, p.y - 0.5, p.z);
            const inFire = getCachedBlock(Math.floor(p.x), Math.floor(p.y - PLAYER_HEIGHT + 0.1), Math.floor(p.z)) === BlockType.FIRE || getCachedBlock(Math.floor(p.x), Math.floor(p.y - 0.5), Math.floor(p.z)) === BlockType.FIRE;
            const onMagma = onGround.current && !isSneaking && blockBelow === BlockType.MAGMA_BLOCK;
            const onCampfire = onGround.current && blockBelow === BlockType.CAMPFIRE;
            const onHotBlock = onMagma || onCampfire;

            if (mode === 'survival' && (inLava || inFire)) {
                lavaTimer.current += dt;
                if (lavaTimer.current >= LAVA_DAMAGE_INTERVAL) {
                    lavaTimer.current = 0;
                    s.takeDamage(inLava ? LAVA_DAMAGE_RATE : 1, { ignoreArmor: true, source: inLava ? 'Spłonąłeś w lawie!' : 'Spłonąłeś w ogniu!' });
                    playSound('hurt');
                }
                if (inLava) {
                    // Slow movement in lava
                    vel.x *= 0.4;
                    vel.z *= 0.4;
                }
            } else if (mode === 'survival' && onHotBlock) {
                lavaTimer.current += dt;
                if (lavaTimer.current >= LAVA_DAMAGE_INTERVAL) {
                    lavaTimer.current = 0;
                    s.takeDamage(1, { ignoreArmor: true, source: onCampfire ? 'Poparzyłeś się w ognisku!' : 'Stanąłeś na bloku magmy!' });
                    playSound('hurt');
                }
            } else {
                lavaTimer.current = 0;
            }

            // ─── Lava Tick ───────────────────────────────────
            lavaTick.current += dt;
            if (lavaTick.current >= 0.6) {
                tickLava();
                lavaTick.current = 0;
            }

            // ─── Oxygen & Drowning ───────────────────────────
            if (s.isUnderwater !== headInWater) {
                s.setUnderwater(headInWater);
            }
            if (mode === 'survival') {
                if (headInWater) {
                    // Drain oxygen
                    oxygenTimer.current += dt;
                    if (oxygenTimer.current >= 1.0) { // 1 second interval
                        const currentO2 = s.oxygen;
                        if (currentO2 > 0) {
                            s.setOxygen(currentO2 - 1);
                            oxygenTimer.current = 0;
                        } else {
                            // Drowning damage
                            drowningTimer.current += dt; // Accumulate separate timer for damage
                            if (drowningTimer.current >= 1.0) {
                                s.takeDamage(2, { ignoreArmor: true, source: 'Utonąłeś!' });
                                playSound('hurt');
                                drowningTimer.current = 0;
                            }
                        }
                    } else if (s.oxygen <= 0) {
                        // Only accumulate damage timer if O2 is empty
                        drowningTimer.current += dt;
                        if (drowningTimer.current >= 1.0) {
                            s.takeDamage(2, { ignoreArmor: true, source: 'Utonąłeś!' });
                            playSound('hurt');
                            drowningTimer.current = 0;
                        }
                    }
                } else {
                    // Regenerate oxygen
                    if (s.oxygen < s.maxOxygen) {
                        oxygenTimer.current += dt;
                        if (oxygenTimer.current >= 0.2) { // Fast regen
                            s.setOxygen(s.oxygen + 5);
                            oxygenTimer.current = 0;
                        }
                    }
                    drowningTimer.current = 0;
                }
            }

            // ─── Hold-to-Mine Progress ───────────────────────
            if (miningHeld.current && !miningTarget.current) {
                const hitNew = raycastBlock();
                if (hitNew) {
                    const [tbx, tby, tbz] = hitNew.block;
                    const tType = getCachedBlock(tbx, tby, tbz);
                    if (tType && tType !== BlockType.BEDROCK) {
                        if (mode === 'creative') {
                            emitBlockBreak(tbx, tby, tbz, tType);
                            playSound('break', [tbx, tby, tbz]);
                            s.removeBlock(tbx, tby, tbz);
                            bumpAround(tbx, tbz);
                            checkWaterFill(tbx, tby, tbz);
                            checkLavaFill(tbx, tby, tbz);
                            processGravity(tbx, tby, tbz);
                        } else {
                            const tData = BLOCK_DATA[tType];
                            if (tData && tData.breakTime > 0) {
                                miningTarget.current = `${tbx},${tby},${tbz}`;
                                miningProgress.current = 0;
                            } else {
                                emitBlockBreak(tbx, tby, tbz, tType);
                                playSound('break', [tbx, tby, tbz]);
                                s.removeBlock(tbx, tby, tbz);
                                bumpAround(tbx, tbz);
                                checkWaterFill(tbx, tby, tbz);
                                checkLavaFill(tbx, tby, tbz);
                                processGravity(tbx, tby, tbz);
                                const drop = getBlockDrop(tType);
                                if (drop && drop !== BlockType.AIR) {
                                    s.addDroppedItem(drop, [tbx + 0.5, tby + 0.5, tbz + 0.5]);
                                    playSound('pop');
                                }
                            }
                        }
                    }
                }
            }

            if (miningHeld.current && miningTarget.current && mode === 'survival') {
                const hitNow = raycastBlock();
                if (hitNow) {
                    const [mbx, mby, mbz] = hitNow.block;
                    const currentKey = `${mbx},${mby},${mbz}`;
                    if (currentKey !== miningTarget.current) {
                        // Looked away, reset
                        miningTarget.current = currentKey;
                        miningProgress.current = 0;
                    }
                    const mType = getCachedBlock(mbx, mby, mbz);
                    if (mType && mType !== BlockType.BEDROCK) {
                        const bData = BLOCK_DATA[mType];
                        if (bData) {
                            // Tool speed multiplier (ID-based, accurate to Minecraft)
                            let breakTime = bData.breakTime;
                            const selectedItem = s.getSelectedBlock();
                            if (selectedItem && BLOCK_DATA[selectedItem]?.isItem) {
                                const isPickaxe = PICKAXE_IDS.has(selectedItem);
                                const isAxe = AXE_IDS.has(selectedItem);
                                const isShovel = SHOVEL_IDS.has(selectedItem);
                                const isHoe = HOE_IDS.has(selectedItem);
                                const matchesTool =
                                    (bData.tool === 'pickaxe' && isPickaxe) ||
                                    (bData.tool === 'axe' && isAxe) ||
                                    (bData.tool === 'shovel' && isShovel) ||
                                    (bData.tool === 'hoe' && isHoe);
                                if (matchesTool) {
                                    const tier = TOOL_SPEED[selectedItem] ?? 1;
                                    breakTime /= tier;
                                    // Efficiency enchant: reduces break time further
                                    // Formula: speed += level^2 + 1 (Minecraft Java)
                                    const heldSlot = s.hotbar[s.hotbarSlot];
                                    const effLevel = (heldSlot as any)?.efficiency ?? 0;
                                    if (effLevel > 0) {
                                        const effBonus = effLevel * effLevel + 1;
                                        breakTime /= (1 + effBonus / tier);
                                    }
                                }
                            }
                            miningProgress.current += dt / Math.max(0.05, breakTime);
                            s.setMiningProgress(miningProgress.current);

                            if (miningProgress.current >= 1) {
                                // Block broken!
                                emitBlockBreak(mbx, mby, mbz, mType);
                                playSound('break', [mbx, mby, mbz]);
                                s.removeBlock(mbx, mby, mbz);
                                bumpAround(mbx, mbz);
                                checkWaterFill(mbx, mby, mbz);
                                checkLavaFill(mbx, mby, mbz);
                                processGravity(mbx, mby, mbz);
                                const drop = getBlockDrop(mType);
                                if (drop && drop !== BlockType.AIR) {
                                    s.addDroppedItem(drop, [mbx + 0.5, mby + 0.5, mbz + 0.5]);
                                    playSound('pop');
                                }

                                // Apply tool durability damage
                                if (selectedItem && BLOCK_DATA[selectedItem]?.isItem && BLOCK_DATA[selectedItem]?.maxDurability) {
                                    s.damageTool(s.hotbarSlot);
                                }

                                // ─── XP Drops ───
                                if (mType === BlockType.COAL_ORE) s.addXp(Math.floor(Math.random() * 2) + 1);
                                else if (mType === BlockType.DIAMOND || mType === BlockType.EMERALD_ORE) s.addXp(Math.floor(Math.random() * 5) + 3);
                                else if (mType === BlockType.LAPIS_ORE || mType === BlockType.REDSTONE_ORE) s.addXp(Math.floor(Math.random() * 4) + 2);

                                miningTarget.current = null;
                                miningProgress.current = 0;
                                s.setMiningProgress(0);
                            }
                        }
                    }
                } else {
                    miningTarget.current = null;
                    miningProgress.current = 0;
                    s.setMiningProgress(0);
                    if (miningCrackRef.current) miningCrackRef.current.visible = false;
                }
            } else if (!miningHeld.current && miningProgress.current > 0) {
                miningProgress.current = 0;
                s.setMiningProgress(0);
                if (miningCrackRef.current) miningCrackRef.current.visible = false;
            }

            // ─── Void Safety ─────────────────────────────────
            if (p.y < -64) {
                if (mode === 'survival') {
                    s.setHealth(s.health - 4);
                    playSound('hurt');
                }
                const spawnY = getSpawnHeight(8, 8);
                p.set(8, spawnY + 2, 8);
                vel.set(0, 0, 0);
                isFlying.current = false;
                fallStart.current = p.y;
            }
            if (p.y > MAX_HEIGHT + 50) {
                p.y = MAX_HEIGHT + 10;
                vel.y = 0;
            }

            // ─── Portal Checks ───────────────────────────────
            const curBlock = getCachedBlock(Math.floor(p.x), Math.floor(p.y + 0.1), Math.floor(p.z));
            const legBlock = getCachedBlock(Math.floor(p.x), Math.floor(p.y - 0.5), Math.floor(p.z));

            if (portalCooldown.current > 0) {
                portalCooldown.current -= dt;
            } else if (curBlock === BlockType.END_PORTAL_BLOCK || legBlock === BlockType.END_PORTAL_BLOCK) {
                if (s.dimension === 'overworld' || s.dimension === 'nether') {
                    s.setDimension('end');
                    pendingPortalRef.current = { dim: 'end', x: 0, z: 0 };
                } else if (s.dimension === 'end') {
                    s.setDimension('overworld');
                    pendingPortalRef.current = { dim: 'overworld', x: 8, z: 8 };
                    if (s.dragonDefeated) {
                        s.setScreen('credits');
                    }
                }
            } else if (curBlock === BlockType.NETHER_PORTAL_BLOCK || legBlock === BlockType.NETHER_PORTAL_BLOCK) {
                portalCooldown.current = 4.0; // 4 seconds cooldown
                if (s.dimension === 'overworld') {
                    s.setDimension('nether');
                    pendingPortalRef.current = { dim: 'nether', x: p.x / 8, z: p.z / 8 };
                } else if (s.dimension === 'nether') {
                    s.setDimension('overworld');
                    pendingPortalRef.current = { dim: 'overworld', x: p.x * 8, z: p.z * 8 };
                }
            }

            // ─── Step Sounds ─────────────────────────────────
            if (onGround.current && (Math.abs(vel.x) > 0.5 || Math.abs(vel.z) > 0.5)) {
                stepTimer.current += dt;
                const interval = isSneaking ? 0.62 : (isSprinting ? 0.32 : 0.45);
                if (stepTimer.current > interval) {
                    const blockBelow = getCachedBlock(Math.floor(p.x), Math.floor(p.y - PLAYER_HEIGHT - 0.1), Math.floor(p.z));
                    let stepSound: any = 'step';
                    if (blockBelow && BLOCK_DATA[blockBelow]) {
                        const name = BLOCK_DATA[blockBelow].name.toLowerCase();
                        if (name.includes('kamie') || name.includes('bruk') || name.includes('ruda') || name.includes('obsydian') || name.includes('piec')) stepSound = 'stone_step';
                        else if (name.includes('drewno') || name.includes('desk') || name.includes('skrzynka') || name.includes('stół')) stepSound = 'wood_step';
                        else if (name.includes('piasek') || name.includes('żwir')) stepSound = 'sand_step';
                        else if (name.includes('trawa') || name.includes('ziemia') || name.includes('liście')) stepSound = 'grass_step';
                    }
                    playSound(stepSound);
                    stepTimer.current = 0;
                }
            } else { stepTimer.current = 0.3; }

            // ─── View Bobbing ────────────────────────────────
            if (s.settings.viewBobbing && onGround.current && move.lengthSq() > 0) {
                bobPhase.current += dt * speed * (isSneaking ? 1.7 : 2.5);
                bobY = Math.sin(bobPhase.current) * (isSneaking ? 0.015 : 0.04);
            }
        } // End physics loop

        // ── Camera sync (runs every frame for smooth visuals) ──
        camera.position.copy(pos.current);
        camera.position.y += bobY + crouchVisualOffset.current + stepVisualOffset.current;

        // ── Bow FOV Zoom ──
        const baseFov = 75;
        if (isChargingBow.current) {
            const chargePower = Math.min(1.0, bowCharge.current);
            const targetFov = baseFov - chargePower * 20; // Zoom from 75 → 55
            (camera as THREE.PerspectiveCamera).fov += (targetFov - (camera as THREE.PerspectiveCamera).fov) * 0.15;
            (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
        } else if ((camera as THREE.PerspectiveCamera).fov < baseFov - 0.5) {
            (camera as THREE.PerspectiveCamera).fov += (baseFov - (camera as THREE.PerspectiveCamera).fov) * 0.2;
            (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
        }

        const pp = s.playerPos;
        pp[0] = pos.current.x; pp[1] = pos.current.y; pp[2] = pos.current.z;
        const pv = s.playerVel;
        pv[0] = velocity.current.x; pv[1] = velocity.current.y; pv[2] = velocity.current.z;
        const pr = s.playerRot;
        pr[0] = camera.rotation.y; pr[1] = camera.rotation.x;

        if (rbRef.current) {
            rbRef.current.setNextKinematicTranslation({
                x: pos.current.x,
                y: pos.current.y - PLAYER_RB_OFFSET_Y,
                z: pos.current.z,
            });
        }

        // ─── Block Highlight & Mining Crack ──────────────────
        const hit = raycastBlock();
        if (highlightRef.current) {
            if (hit && s.gameMode !== 'spectator') {
                highlightRef.current.position.set(hit.block[0] + 0.5, hit.block[1] + 0.5, hit.block[2] + 0.5);
                highlightRef.current.visible = true;
                s.setLookingAt(hit.block);

                // Update mining crack visuals
                if (miningCrackRef.current && miningTarget.current === `${hit.block[0]},${hit.block[1]},${hit.block[2]}`) {
                    const prog = Math.min(1, Math.max(0, s.miningProgressValue));
                    if (prog > 0) {
                        miningCrackRef.current.position.set(hit.block[0] + 0.5, hit.block[1] + 0.5, hit.block[2] + 0.5);
                        miningCrackRef.current.visible = true;
                        // Use CSS scale-like trick by shrinking the "crack" slightly inwards to avoid z-fighting
                        miningCrackRef.current.scale.setScalar(1.005);
                        (miningCrackRef.current.material as THREE.MeshBasicMaterial).opacity = prog * 0.8;
                        (highlightRef.current.material as THREE.MeshBasicMaterial).opacity = 0.4 + (prog * 0.4);
                    } else {
                        miningCrackRef.current.visible = false;
                        (highlightRef.current.material as THREE.MeshBasicMaterial).opacity = 0.4;
                    }
                } else if (miningCrackRef.current) {
                    miningCrackRef.current.visible = false;
                    (highlightRef.current.material as THREE.MeshBasicMaterial).opacity = 0.4;
                }

            } else {
                highlightRef.current.visible = false;
                if (miningCrackRef.current) miningCrackRef.current.visible = false;
                (highlightRef.current.material as THREE.MeshBasicMaterial).opacity = 0.4;
                s.setLookingAt(null);
            }
        }

        // ─── Audio Listener ──────────────────────────────────
        {
            const cam = camera;
            const dir = new THREE.Vector3();
            cam.getWorldDirection(dir);
            updateListener(cam.position.x, cam.position.y, cam.position.z, dir.x, dir.y, dir.z);
        }
    });

    return (
        <>
            <PointerLockControls
                ref={controlsRef}
                onLock={() => setLocked(true)}
                onUnlock={() => setLocked(false)}
                pointerSpeed={1.0}
            />
            <RigidBody ref={rbRef} type="kinematicPosition" colliders="cuboid" args={[PLAYER_WIDTH, PLAYER_COLLIDER_HEIGHT / 2, PLAYER_WIDTH]}>
                <mesh visible={false}>
                    <boxGeometry args={[PLAYER_WIDTH * 2, PLAYER_COLLIDER_HEIGHT, PLAYER_WIDTH * 2]} />
                </mesh>
            </RigidBody>
            {/* Selection highlight */}
            <mesh ref={highlightRef} visible={false}>
                <boxGeometry args={[1.002, 1.002, 1.002]} />
                <meshBasicMaterial color="#000000" wireframe transparent opacity={0.4} />
            </mesh>
            {/* Mining crack overlay */}
            <mesh ref={miningCrackRef} visible={false}>
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.5} wireframe />
            </mesh>
        </>
    );
};

export default Player;
