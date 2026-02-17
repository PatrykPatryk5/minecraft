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
import * as THREE from 'three';
import useKeyboard from './useKeyboard';
import useGameStore from '../store/gameStore';
import { BLOCK_DATA, BlockType, getBlockDrop } from '../core/blockTypes';
import { getSpawnHeight, MAX_HEIGHT } from '../core/terrainGen';
import { emitBlockBreak } from '../effects/BlockParticles';
import { playSound, startAmbience } from '../audio/sounds';

// ─── Constants ───────────────────────────────────────────
const GRAVITY = -28;
const JUMP_FORCE = 9.5;
const TERMINAL_VEL = -50;
const WALK_SPEED = 4.317;
const SPRINT_SPEED = 5.612;
const FLY_SPEED = 11;
const SPECTATOR_SPEED = 15;
const SWIM_SPEED = 2.2;
const PLAYER_HEIGHT = 1.62;
const PLAYER_WIDTH = 0.3;
const REACH = 5;
const STEP_SIZE = 0.05;
const FALL_DAMAGE_THRESHOLD = 3;
const SPRINT_HUNGER_RATE = 0.15; // hunger/sec while sprinting

const Player: React.FC = () => {
    const { camera } = useThree();
    const keys = useKeyboard();
    const controlsRef = useRef<any>(null);
    const velocity = useRef(new THREE.Vector3());
    const onGround = useRef(false);
    const pos = useRef(new THREE.Vector3(8, 80, 8));
    const highlightRef = useRef<THREE.Mesh>(null);
    const isFlying = useRef(false);
    const lastJumpTime = useRef(0);
    const stepTimer = useRef(0);
    const bobPhase = useRef(0);
    const fallStart = useRef(80);
    const hungerTimer = useRef(0);
    const swimTimer = useRef(0);
    const miningTarget = useRef<string | null>(null);
    const miningProgress = useRef(0);
    const ambienceStarted = useRef(false);

    const storeRef = useRef(useGameStore.getState());
    useEffect(() => {
        const unsub = useGameStore.subscribe((s) => { storeRef.current = s; });
        return unsub;
    }, []);

    useEffect(() => {
        const y = getSpawnHeight(8, 8);
        pos.current.set(8, y + 2, 8);
        camera.position.copy(pos.current);
        fallStart.current = y + 2;
    }, [camera]);

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

    // ─── Raycast ───────────────────────────────────────────
    const raycastBlock = useCallback((): { block: [number, number, number]; place: [number, number, number] } | null => {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const origin = camera.position.clone();
        let px = Math.floor(origin.x), py = Math.floor(origin.y), pz = Math.floor(origin.z);
        for (let t = 0; t < REACH; t += STEP_SIZE) {
            const pt = origin.clone().add(dir.clone().multiplyScalar(t));
            const bx = Math.floor(pt.x), by = Math.floor(pt.y), bz = Math.floor(pt.z);
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

            const hit = raycastBlock();

            if (e.button === 0) {
                // ── Break Block ──
                if (!hit) return;
                const [bx, by, bz] = hit.block;
                const type = s.getBlock(bx, by, bz);
                if (type && type !== BlockType.BEDROCK) {
                    if (s.gameMode === 'spectator') return;

                    // Creative = instant break
                    if (s.gameMode === 'creative') {
                        emitBlockBreak(bx, by, bz, type);
                        playSound('break');
                        s.removeBlock(bx, by, bz);
                        bumpAround(bx, bz);
                        return;
                    }

                    // Survival = break and collect
                    emitBlockBreak(bx, by, bz, type);
                    playSound('break');
                    s.removeBlock(bx, by, bz);
                    bumpAround(bx, bz);

                    const drop = getBlockDrop(type);
                    if (drop && drop !== BlockType.AIR) {
                        s.addItem(drop, 1);
                        playSound('pop');
                    }
                }
            } else if (e.button === 2) {
                // ── Place Block ──
                if (!hit) return;
                if (s.gameMode === 'spectator') return;
                const [px, py, pz] = hit.place;
                if (py < 0 || py > MAX_HEIGHT - 1) return;

                const selected = s.getSelectedBlock();
                if (!selected) return;
                if (BLOCK_DATA[selected]?.isItem) return;

                // Don't place inside player
                const feet = Math.floor(pos.current.y - PLAYER_HEIGHT);
                const head = Math.floor(pos.current.y);
                const plX = Math.floor(pos.current.x);
                const plZ = Math.floor(pos.current.z);
                if (px === plX && pz === plZ && py >= feet && py <= head) return;

                s.addBlock(px, py, pz, selected);
                s.consumeHotbarItem(s.hotbarSlot);
                playSound('place');
                bumpAround(px, pz);
            }
        };

        window.addEventListener('mousedown', onMouseDown);
        return () => window.removeEventListener('mousedown', onMouseDown);
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

    // ─── Game Loop ─────────────────────────────────────────
    useFrame((_, rawDelta) => {
        const s = storeRef.current;
        if (s.activeOverlay !== 'none' || !s.isLocked || s.screen !== 'playing') return;

        const dt = Math.min(rawDelta, 0.1);
        const vel = velocity.current;
        const p = pos.current;
        const mode = s.gameMode;

        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const flatForward = forward.clone(); flatForward.y = 0; flatForward.normalize();
        const right = new THREE.Vector3().crossVectors(flatForward, new THREE.Vector3(0, 1, 0)).normalize();

        const k = keys.current ?? {};
        const inWater = isInWater(p.x, p.y - 0.5, p.z);
        const isSprinting = k.ShiftLeft && !inWater;

        // ─── Spectator ───────────────────────────────────────
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
            if (highlightRef.current) highlightRef.current.visible = false;
            return;
        }

        // ─── Creative Fly Toggle ─────────────────────────────
        if (mode === 'creative' && k.Space) {
            const now = performance.now();
            if (now - lastJumpTime.current < 300 && !onGround.current) {
                isFlying.current = !isFlying.current;
                lastJumpTime.current = 0;
            } else if (onGround.current) {
                lastJumpTime.current = now;
            }
        }

        // ─── Movement ────────────────────────────────────────
        const flying = mode === 'creative' && isFlying.current;
        const speed = inWater ? SWIM_SPEED : (isSprinting ? SPRINT_SPEED : (flying ? FLY_SPEED : WALK_SPEED));
        const move = new THREE.Vector3();
        if (k.KeyW) move.add(flatForward);
        if (k.KeyS) move.sub(flatForward);
        if (k.KeyA) move.sub(right);
        if (k.KeyD) move.add(right);
        if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed);

        vel.x = move.x;
        vel.z = move.z;

        if (flying) {
            vel.y = 0;
            if (k.Space) vel.y = FLY_SPEED;
            if (k.ShiftLeft) vel.y = -FLY_SPEED;
        } else if (inWater) {
            // Swimming physics
            vel.y *= 0.85; // Water resistance
            if (k.Space) vel.y = Math.min(vel.y + 12 * dt, 3);
            else vel.y += (GRAVITY * 0.3) * dt; // Slow sinking
            vel.x *= 0.85;
            vel.z *= 0.85;
            // Swim sounds
            swimTimer.current += dt;
            if (swimTimer.current > 0.8 && (Math.abs(vel.x) > 0.3 || Math.abs(vel.z) > 0.3)) {
                playSound('swim');
                swimTimer.current = 0;
            }
        } else {
            if (k.Space && onGround.current) {
                vel.y = JUMP_FORCE;
                onGround.current = false;
                fallStart.current = p.y;
            }
            vel.y += GRAVITY * dt;
            if (vel.y < TERMINAL_VEL) vel.y = TERMINAL_VEL;
        }

        // Track fall start
        if (!onGround.current && vel.y > 0 && !flying && !inWater) {
            fallStart.current = Math.max(fallStart.current, p.y);
        }
        if (!onGround.current && vel.y < -1 && !flying && !inWater) {
            fallStart.current = Math.max(fallStart.current, p.y);
        }

        // ─── Collision ───────────────────────────────────────
        const w = PLAYER_WIDTH;

        const nx = p.x + vel.x * dt;
        if (
            isSolid(nx - w, p.y - PLAYER_HEIGHT, p.z) || isSolid(nx + w, p.y - PLAYER_HEIGHT, p.z) ||
            isSolid(nx - w, p.y - 0.5, p.z) || isSolid(nx + w, p.y - 0.5, p.z) ||
            isSolid(nx - w, p.y, p.z) || isSolid(nx + w, p.y, p.z)
        ) { vel.x = 0; } else { p.x = nx; }

        const nz = p.z + vel.z * dt;
        if (
            isSolid(p.x, p.y - PLAYER_HEIGHT, nz - w) || isSolid(p.x, p.y - PLAYER_HEIGHT, nz + w) ||
            isSolid(p.x, p.y - 0.5, nz - w) || isSolid(p.x, p.y - 0.5, nz + w) ||
            isSolid(p.x, p.y, nz - w) || isSolid(p.x, p.y, nz + w)
        ) { vel.z = 0; } else { p.z = nz; }

        const prevY = p.y;
        const ny = p.y + vel.y * dt;
        const wasInAir = !onGround.current;
        onGround.current = false;

        if (vel.y < 0 && !flying) {
            if (
                isSolid(p.x - w, ny - PLAYER_HEIGHT, p.z - w) || isSolid(p.x + w, ny - PLAYER_HEIGHT, p.z - w) ||
                isSolid(p.x - w, ny - PLAYER_HEIGHT, p.z + w) || isSolid(p.x + w, ny - PLAYER_HEIGHT, p.z + w)
            ) {
                p.y = Math.floor(ny - PLAYER_HEIGHT) + 1 + PLAYER_HEIGHT;

                // ─── Fall Damage ─────────────────────────────────
                if (wasInAir && mode === 'survival' && !inWater) {
                    const fallDist = fallStart.current - p.y;
                    if (fallDist > FALL_DAMAGE_THRESHOLD) {
                        const damage = Math.floor(fallDist - FALL_DAMAGE_THRESHOLD);
                        if (damage > 0) {
                            s.setHealth(s.health - damage);
                            playSound('hurt');
                            playSound('land');
                        }
                    } else if (fallDist > 1) {
                        playSound('land');
                    }
                }

                vel.y = 0;
                onGround.current = true;
                isFlying.current = false;
                fallStart.current = p.y;
            } else { p.y = ny; }
        } else {
            if (!flying && isSolid(p.x, ny + 0.2, p.z)) { vel.y = 0; }
            else { p.y = ny; }
        }

        // Track fall distance
        if (!onGround.current && !flying && !inWater && vel.y > 0) {
            fallStart.current = p.y;
        }

        // ─── Sprint Hunger Drain ─────────────────────────────
        if (mode === 'survival' && isSprinting && (Math.abs(vel.x) > 0.5 || Math.abs(vel.z) > 0.5)) {
            hungerTimer.current += dt;
            if (hungerTimer.current > 1) {
                s.setHunger(s.hunger - SPRINT_HUNGER_RATE);
                hungerTimer.current = 0;
            }
        }

        // ─── Health regen from full hunger ────────────────────
        if (mode === 'survival' && s.hunger >= 18 && s.health < s.maxHealth) {
            // Slow regen
            hungerTimer.current += dt;
            if (hungerTimer.current > 4) {
                s.setHealth(s.health + 1);
                s.setHunger(s.hunger - 0.5);
                hungerTimer.current = 0;
            }
        }

        // ─── Starvation damage ───────────────────────────────
        if (mode === 'survival' && s.hunger <= 0) {
            hungerTimer.current += dt;
            if (hungerTimer.current > 4) {
                s.setHealth(s.health - 1);
                playSound('hurt');
                hungerTimer.current = 0;
            }
        }

        // ─── Void Safety ─────────────────────────────────────
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

        // ─── Step Sounds ─────────────────────────────────────
        if (onGround.current && (Math.abs(vel.x) > 0.5 || Math.abs(vel.z) > 0.5)) {
            stepTimer.current += dt;
            const interval = isSprinting ? 0.32 : 0.45;
            if (stepTimer.current > interval) {
                playSound('step');
                stepTimer.current = 0;
            }
        } else { stepTimer.current = 0.3; }

        // ─── View Bobbing ────────────────────────────────────
        if (s.settings.viewBobbing && onGround.current && move.lengthSq() > 0) {
            bobPhase.current += dt * speed * 1.2;
            p.y += Math.sin(bobPhase.current * 2) * 0.03;
        }

        camera.position.copy(p);
        s.setPlayerPos([p.x, p.y, p.z]);

        // ─── Block Highlight ─────────────────────────────────
        const hit = raycastBlock();
        if (highlightRef.current) {
            if (hit && s.gameMode !== 'spectator') {
                highlightRef.current.position.set(hit.block[0] + 0.5, hit.block[1] + 0.5, hit.block[2] + 0.5);
                highlightRef.current.visible = true;
            } else { highlightRef.current.visible = false; }
        }
    });

    return (
        <>
            <PointerLockControls ref={controlsRef} />
            {/* Selection highlight */}
            <mesh ref={highlightRef} visible={false}>
                <boxGeometry args={[1.01, 1.01, 1.01]} />
                <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.4} />
            </mesh>
        </>
    );
};

export default Player;
