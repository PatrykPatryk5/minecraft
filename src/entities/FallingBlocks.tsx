import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';
import { getAtlasTexture, getAtlasUV } from '../core/textures';
import { checkGravityAbove } from '../core/gravityBlocks';

const FallingBlockNode: React.FC<{ id: string; type: number; initialPos: [number, number, number]; velocity?: [number, number, number]; isDebris?: boolean }> = ({ id, type, initialPos, velocity, isDebris }) => {
    const rbRef = useRef<RapierRigidBody>(null);
    const meshRef = useRef<THREE.Mesh>(null);
    const atlas = getAtlasTexture();
    const landed = useRef(false);
    const lifeTimer = useRef(0);
    const restTimer = useRef(0); // Tracks how long the block has been resting

    // Set initial velocity and random rotation for debris
    React.useEffect(() => {
        if (rbRef.current && velocity) {
            rbRef.current.setLinvel({ x: velocity[0], y: velocity[1], z: velocity[2] }, true);
            if (isDebris) {
                // Random spin for debris
                rbRef.current.setAngvel({
                    x: (Math.random() - 0.5) * 10,
                    y: (Math.random() - 0.5) * 10,
                    z: (Math.random() - 0.5) * 10
                }, true);
            }
        }
    }, [velocity, isDebris]);

    // Generate accurate texture mapping for the full block based on the atlas
    const geometry = useMemo(() => {
        const geo = new THREE.BoxGeometry(1, 1, 1);
        const uvs = geo.attributes.uv;
        const array = uvs.array as Float32Array;
        const faces: ('right' | 'left' | 'top' | 'bottom' | 'front' | 'back')[] = ['right', 'left', 'top', 'bottom', 'front', 'back'];

        for (let i = 0; i < 6; i++) {
            const face = faces[i];
            const uvData = getAtlasUV(type, face);
            const v0 = i * 4 * 2;
            array[v0 + 0] = uvData.u; array[v0 + 1] = uvData.v + uvData.sv;
            array[v0 + 2] = uvData.u + uvData.su; array[v0 + 3] = uvData.v + uvData.sv;
            array[v0 + 4] = uvData.u; array[v0 + 5] = uvData.v;
            array[v0 + 6] = uvData.u + uvData.su; array[v0 + 7] = uvData.v;
        }
        geo.attributes.uv.needsUpdate = true;

        // Scale down if debris
        if (isDebris) {
            geo.scale(0.3, 0.3, 0.3);
        }

        return geo;
    }, [type, isDebris]);

    useFrame((state, delta) => {
        if (!rbRef.current || landed.current) return;

        // Debris disappear after a max of 4 seconds or when completely stopped
        if (isDebris) {
            lifeTimer.current += delta;
            if (lifeTimer.current > 4) {
                landed.current = true;
                useGameStore.getState().removeFallingBlock(id);
                return;
            }
        }

        const pos = rbRef.current.translation();
        const vel = rbRef.current.linvel();

        // If it stopped falling (or nearly stopped) and is at least below its start Y slightly
        // We use Math.abs(vel.y) < 0.2 because sometimes blocks bounce forever with 0.1 velocity
        if (Math.abs(vel.y) < 0.2 && Math.abs(vel.x) < 0.2 && Math.abs(vel.z) < 0.2) {
            restTimer.current += delta;

            // Only solidify if it's been resting for 0.5 seconds, avoiding bouncing freezes
            if (restTimer.current > 0.5 && pos.y < initialPos[1] + 0.1) {
                landed.current = true;

                if (isDebris) {
                    // Debris just vanishes instead of placing a block
                    useGameStore.getState().removeFallingBlock(id);
                    return;
                }

                // Normal falling block places itself
                // Position centers are perfectly at X.5, Y.5, Z.5 aligned inside grid blocks
                // Math.floor directly maps a continuous coordinate back to the block origin
                const gridX = Math.floor(pos.x);
                const gridY = Math.floor(pos.y);
                const gridZ = Math.floor(pos.z);

                useGameStore.getState().landFallingBlock(id, [gridX, gridY, gridZ], type);
                // Force checking for anything that was resting on this block
                setTimeout(() => checkGravityAbove(gridX, gridY, gridZ), 100);
            }
        } else {
            // Reset rest timer if it started moving again (bounced)
            restTimer.current = 0;
        }
    });

    return (
        <RigidBody
            ref={rbRef}
            type="dynamic"
            colliders="cuboid"
            position={initialPos}
            restitution={isDebris ? 0.3 : 0}
            friction={isDebris ? 1.0 : 0.0} // 0 friction for falling blocks so they don't stick to walls
            linearDamping={0.1}
            lockRotations={!isDebris} // sand falls straight down, debris rotates
            ccd={true} // continuous collision detection to prevent falling through floor
        >
            <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow scale={isDebris ? 1 : 0.98}>
                <meshStandardMaterial map={atlas} transparent alphaTest={0.1} />
            </mesh>
        </RigidBody>
    );
};

const FallingBlocksManager: React.FC = () => {
    const blocks = useGameStore((s) => s.fallingBlocks);
    return (
        <>
            {blocks.map((b) => (
                <FallingBlockNode key={b.id} id={b.id} type={b.type} initialPos={b.pos} velocity={b.velocity} isDebris={b.isDebris} />
            ))}
        </>
    );
};

export default FallingBlocksManager;
