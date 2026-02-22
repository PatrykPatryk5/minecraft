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
import { getSpawnHeight, MAX_HEIGHT } from '../core/terrainGen';
import { emitBlockBreak } from '../core/particles';
import { playSound, startAmbience, updateListener, updateEnvironment } from '../audio/sounds';
import { checkWaterFill, spreadWater } from '../core/waterSystem';
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
const JUMP_RELEASE_MULT = 1.0; // Minecraft has constant jump velocity until gravity takes over
const PLACE_REPEAT_INTERVAL = 0.15;
const FALL_DAMAGE_THRESHOLD = 3;
const SPRINT_HUNGER_RATE = 0.15; // hunger/sec while sprinting
const LAVA_DAMAGE_RATE = 4; // hp/sec in lava
const LAVA_DAMAGE_INTERVAL = 0.5; // seconds between lava damage ticks

const Player: React.FC = () => {
    const { camera } = useThree();
    const keys = useKeyboard();
    const controlsRef = useRef<any>(null);
    const rbRef = useRef<RapierRigidBody>(null);
    const velocity = useRef(new THREE.Vector3());
    const onGround = useRef(false);
    const pos = useRef(new THREE.Vector3(8, 80, 8));
    const highlightRef = useRef<THREE.Mesh>(null);
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
    const bowCharge = useRef(0);
    const isChargingBow = useRef(false);
    const rayDirRef = useRef(new THREE.Vector3());
    const forwardVec = useRef(new THREE.Vector3());
    const rightVec = useRef(new THREE.Vector3());
    const flatForwardVec = useRef(new THREE.Vector3());
    const coyoteTimer = useRef(0);
    const jumpBufferTimer = useRef(0);
    const jumpHeldLast = useRef(false);
    const crouchVisualOffset = useRef(0);
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
        // Safe spawn logic:
        // 1. Get terrain height at 0,0
        // 2. Add player height + buffer
        const spawnX = 0;
        const spawnZ = 0;
        let y = getSpawnHeight(spawnX, spawnZ);

        // If y is remarkably low (e.g. 0), it might mean the chunk isn't loaded yet.
        // In that case, spawn high up (80) to fall safely.
        if (y <= 5) y = 80;
        if (y < 65) y = 65; // Minimum height (sea level)

        pos.current.set(spawnX, y + 2, spawnZ);
        velocity.current.set(0, 0, 0);
        onGround.current = false;
        fallStart.current = y + 2;

        // Force camera to spawn
        camera.position.set(spawnX, y + 2, spawnZ);
        camera.rotation.set(0, 0, 0);
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

    // ─── Collision ─────────────────────────────────────────
    const isSolid = useCallback((x: number, y: number, z: number): boolean => {
        const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
        const type = storeRef.current.getBlock(bx, by, bz);
        if (!type) return false;
        return BLOCK_DATA[type]?.solid ?? false;
    }, []);

    const isInWater = useCallback((x: number, y: number, z: number): boolean => {
        const type = storeRef.current.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        return type === BlockType.WATER;
    }, []);

    const isInLava = useCallback((x: number, y: number, z: number): boolean => {
        const type = storeRef.current.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        return type === BlockType.LAVA;
    }, []);

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
            const type = storeRef.current.getBlock(bx, by, bz);
            if (type && BLOCK_DATA[type]?.solid) {
                return { block: [bx, by, bz], place: [px, py, pz] };
            }
            px = bx; py = by; pz = bz;
        }
        return null;
    }, [camera]);

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
                let damage = 2; // Base fist damage
                if (selected) {
                    const toolName = BLOCK_DATA[selected]?.name?.toLowerCase() || '';
                    if (toolName.includes('miecz')) {
                        if (toolName.includes('diament')) damage = 7;
                        else if (toolName.includes('żelaz')) damage = 6;
                        else if (toolName.includes('kamien')) damage = 5;
                        else damage = 4;
                    } else if (toolName.includes('siekier')) {
                        if (toolName.includes('diament')) damage = 6;
                        else if (toolName.includes('żelaz')) damage = 5;
                        else damage = 3;
                    }
                }

                const hitMob = attackMob(
                    pos.current.x, pos.current.y, pos.current.z,
                    [dir.x, dir.y, dir.z], damage
                );

                if (hitMob) {
                    // Apply tool durability damage
                    if (selected && BLOCK_DATA[selected]?.isItem && BLOCK_DATA[selected]?.maxDurability) {
                        s.damageTool(s.hotbarSlot);
                    }
                    return;
                }

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
                if (!hit) {
                    if (selected === BlockType.BOW && s.gameMode !== 'spectator') {
                        isChargingBow.current = true;
                        bowCharge.current = 0;
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
                    // Open 3x3 crafting table
                    s.setOverlay('crafting');
                    playSound('open');
                    document.exitPointerLock();
                    return;
                }
                if (clickedType === BlockType.FURNACE || clickedType === BlockType.FURNACE_ON) {
                    // Open furnace
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

                // (Already defined above: const selected = s.getSelectedBlock();)
                if (!selected) return;

                // If holding food, try eating instead of placing
                if (BLOCK_DATA[selected]?.foodRestore && BLOCK_DATA[selected]?.isItem) {
                    s.eatFood();
                    return;
                }

                // Farming/tool interactions should happen before generic item early-return.
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

                if (BLOCK_DATA[selected]?.isItem) return;

                // Don't place inside player
                const feet = Math.floor(pos.current.y - PLAYER_HEIGHT);
                const head = Math.floor(pos.current.y);
                const plX = Math.floor(pos.current.x);
                const plZ = Math.floor(pos.current.z);
                if (px === plX && pz === plZ && py >= feet && py <= head) return;

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
                    dir.negate(); // Point towards player

                    let pDir = 0;
                    if (Math.abs(dir.y) > Math.abs(dir.x) && Math.abs(dir.y) > Math.abs(dir.z)) {
                        pDir = dir.y > 0 ? 1 : 0; // 1=Up, 0=Down
                    } else if (Math.abs(dir.x) > Math.abs(dir.z)) {
                        pDir = dir.x > 0 ? 5 : 4; // 5=East, 4=West
                    } else {
                        pDir = dir.z > 0 ? 3 : 2; // 3=South, 2=North
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

                // If placing water/lava, trigger spreading
                if (selected === BlockType.WATER) {
                    spreadWater(px, py, pz);
                }
                if (selected === BlockType.LAVA) {
                    spreadLava(px, py, pz);
                }

                // Trigger gravity for falling blocks
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

            camera.getWorldDirection(forward);
            flatForward.copy(forward); flatForward.y = 0; flatForward.normalize();
            right.crossVectors(flatForward, new THREE.Vector3(0, 1, 0)).normalize();

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
                const move = new THREE.Vector3();
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
            const move = new THREE.Vector3();
            if (k.KeyW) move.add(flatForward);
            if (k.KeyS) move.sub(flatForward);
            if (k.KeyA) move.sub(right);
            if (k.KeyD) move.add(right);
            const hasMoveInput = move.lengthSq() > 0;
            if (hasMoveInput) move.normalize().multiplyScalar(speed);

            // Minecraft-like inertia: acceleration + friction instead of instant velocity snap.
            const accel = inWater ? WATER_ACCEL : (onGround.current ? GROUND_ACCEL : AIR_ACCEL);
            const friction = inWater ? WATER_FRICTION : (onGround.current ? GROUND_FRICTION : AIR_FRICTION);
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
                        const blockBelow = storeRef.current.getBlock(Math.floor(p.x), Math.floor(p.y - PLAYER_HEIGHT - 0.1), Math.floor(p.z));
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

            const ny = p.y + vel.y * dt;
            const wasInAir = !onGround.current;
            onGround.current = false;

            if (vel.y < 0 && !flying) {
                if (
                    isSolid(p.x - w, ny - PLAYER_HEIGHT, p.z - w) || isSolid(p.x + w, ny - PLAYER_HEIGHT, p.z - w) ||
                    isSolid(p.x - w, ny - PLAYER_HEIGHT, p.z + w) || isSolid(p.x + w, ny - PLAYER_HEIGHT, p.z + w)
                ) {
                    p.y = Math.floor(ny - PLAYER_HEIGHT) + 1 + PLAYER_HEIGHT;

                    // ─── Fall Damage ───────────────────────────
                    const fallDist = fallStart.current - p.y;
                    if (wasInAir && mode === 'survival' && !inWater) {
                        if (fallDist > FALL_DAMAGE_THRESHOLD) {
                            const damage = Math.floor(fallDist - FALL_DAMAGE_THRESHOLD);
                            if (damage > 0) {
                                s.takeDamage(damage, { ignoreArmor: true });
                                playSound('hurt', [p.x, p.y, p.z]);
                            }
                        }
                        playSound('land', [p.x, p.y - PLAYER_HEIGHT, p.z]);
                    } else if (fallDist > 1) {
                        playSound('land', [p.x, p.y - PLAYER_HEIGHT, p.z]);
                    }

                    vel.y = 0;
                    onGround.current = true;
                    isFlying.current = false;
                    fallStart.current = p.y;
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
                    s.takeDamage(1, { ignoreArmor: true });
                }
            } else {
                starvationTimer.current = 0;
            }

            // ─── Lava Damage ─────────────────────────────────
            const inLava = isInLava(p.x, p.y - PLAYER_HEIGHT + 0.1, p.z) || isInLava(p.x, p.y - 0.5, p.z);
            if (mode === 'survival' && inLava) {
                lavaTimer.current += dt;
                if (lavaTimer.current >= LAVA_DAMAGE_INTERVAL) {
                    lavaTimer.current = 0;
                    s.takeDamage(LAVA_DAMAGE_RATE, { ignoreArmor: true });
                    playSound('hurt');
                }
                // Slow movement in lava
                vel.x *= 0.4;
                vel.z *= 0.4;
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
                                s.takeDamage(2, { ignoreArmor: true });
                                playSound('hurt');
                                drowningTimer.current = 0;
                            }
                        }
                    } else if (s.oxygen <= 0) {
                        // Only accumulate damage timer if O2 is empty
                        drowningTimer.current += dt;
                        if (drowningTimer.current >= 1.0) {
                            s.takeDamage(2, { ignoreArmor: true });
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
                    const tType = s.getBlock(tbx, tby, tbz);
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
                    const mType = s.getBlock(mbx, mby, mbz);
                    if (mType && mType !== BlockType.BEDROCK) {
                        const bData = BLOCK_DATA[mType];
                        if (bData) {
                            // Tool speed multiplier
                            let breakTime = bData.breakTime;
                            const selectedItem = s.getSelectedBlock();
                            if (selectedItem && BLOCK_DATA[selectedItem]?.isItem) {
                                // Check if tool matches block type
                                const toolName = BLOCK_DATA[selectedItem]?.name?.toLowerCase() ?? '';
                                const isPickaxe = toolName.includes('kilof');
                                const isAxe = toolName.includes('siekier');
                                const isShovel = toolName.includes('łopat');
                                const matchesTool = (bData.tool === 'pickaxe' && isPickaxe) ||
                                    (bData.tool === 'axe' && isAxe) ||
                                    (bData.tool === 'shovel' && isShovel);
                                if (matchesTool) {
                                    // Tier bonus: higher tier = faster
                                    const tierMultiplier = toolName.includes('diament') ? 8 :
                                        toolName.includes('żelaz') ? 6 :
                                            toolName.includes('złot') ? 10 :
                                                toolName.includes('kamien') ? 4 : 2;
                                    breakTime /= tierMultiplier;
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
                }
            } else if (!miningHeld.current && miningProgress.current > 0) {
                miningProgress.current = 0;
                s.setMiningProgress(0);
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
            const curBlock = s.getBlock(Math.floor(p.x), Math.floor(p.y + 0.1), Math.floor(p.z));
            const legBlock = s.getBlock(Math.floor(p.x), Math.floor(p.y - 0.5), Math.floor(p.z));

            if (portalCooldown.current > 0) {
                portalCooldown.current -= dt;
            } else if (curBlock === BlockType.END_PORTAL_BLOCK || legBlock === BlockType.END_PORTAL_BLOCK) {
                if (s.dimension === 'overworld' || s.dimension === 'nether') {
                    s.setDimension('end');
                    p.set(0, 65, 0);
                    vel.set(0, 0, 0);
                    fallStart.current = 65;
                    playSound('portal');
                } else if (s.dimension === 'end') {
                    s.setDimension('overworld');
                    const h = getSpawnHeight(8, 8);
                    p.set(8, h + 2, 8);
                    vel.set(0, 0, 0);
                    fallStart.current = h + 2;
                    if (s.dragonDefeated) {
                        s.setScreen('credits');
                    }
                }
            } else if (curBlock === BlockType.NETHER_PORTAL_BLOCK || legBlock === BlockType.NETHER_PORTAL_BLOCK) {
                portalCooldown.current = 4.0; // 4 seconds cooldown
                if (s.dimension === 'overworld') {
                    s.setDimension('nether');
                    const nx = Math.floor(p.x / 8);
                    const nz = Math.floor(p.z / 8);
                    // Search for a safe height in Nether (typical interior is 32-110)
                    const ny = getSafeHeight(nx, nz, [32, 110]);

                    p.set(nx + 0.5, ny + 1.5, nz + 0.5);
                    vel.set(0, 0, 0);
                    buildNetherPortalSafe(nx, ny, nz);
                    playSound('portal');
                } else if (s.dimension === 'nether') {
                    s.setDimension('overworld');
                    const ox = Math.floor(p.x * 8);
                    const oz = Math.floor(p.z * 8);
                    // Search for ground in Overworld (0-150)
                    const oy = getSafeHeight(ox, oz, [62, 150]);

                    p.set(ox + 0.5, oy + 1.5, oz + 0.5);
                    vel.set(0, 0, 0);
                    buildNetherPortalSafe(ox, oy, oz);
                    playSound('portal');
                }
            }

            // ─── Step Sounds ─────────────────────────────────
            if (onGround.current && (Math.abs(vel.x) > 0.5 || Math.abs(vel.z) > 0.5)) {
                stepTimer.current += dt;
                const interval = isSneaking ? 0.62 : (isSprinting ? 0.32 : 0.45);
                if (stepTimer.current > interval) {
                    const blockBelow = s.getBlock(Math.floor(p.x), Math.floor(p.y - PLAYER_HEIGHT - 0.1), Math.floor(p.z));
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
        camera.position.y += bobY + crouchVisualOffset.current;

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

        // ─── Block Highlight ─────────────────────────────────
        const hit = raycastBlock();
        if (highlightRef.current) {
            if (hit && s.gameMode !== 'spectator') {
                highlightRef.current.position.set(hit.block[0] + 0.5, hit.block[1] + 0.5, hit.block[2] + 0.5);
                highlightRef.current.visible = true;
                s.setLookingAt(hit.block);
            } else {
                highlightRef.current.visible = false;
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
                <boxGeometry args={[1.01, 1.01, 1.01]} />
                <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.4} />
            </mesh>
        </>
    );
};

export default Player;
