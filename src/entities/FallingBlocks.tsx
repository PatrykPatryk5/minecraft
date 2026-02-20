import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';
import { getAtlasTexture, getAtlasUV } from '../core/textures';
import { checkGravityAbove } from '../core/gravityBlocks';

const FallingBlockNode: React.FC<{ id: string; type: number; initialPos: [number, number, number] }> = ({ id, type, initialPos }) => {
    const rbRef = useRef<RapierRigidBody>(null);
    const meshRef = useRef<THREE.Mesh>(null);
    const atlas = getAtlasTexture();
    const landed = useRef(false);

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
        return geo;
    }, [type]);

    useFrame(() => {
        if (!rbRef.current || landed.current) return;

        const pos = rbRef.current.translation();
        const vel = rbRef.current.linvel();

        // If it stopped falling (or nearly stopped) and is at least below its start Y slightly
        if (Math.abs(vel.y) < 0.05 && Math.abs(vel.x) < 0.05 && Math.abs(vel.z) < 0.05 && Math.abs(initialPos[1] - pos.y) > 0.1) {
            // Check if the body just woke up or is actually resting on something
            // We use standard grid rounding, Minecraft drops grid-aligned.
            landed.current = true;
            const gridX = Math.floor(pos.x);
            let gridY = Math.floor(pos.y);
            // Sometimes it stops slightly above/below, adjust it to nearest integer + 0.5 to check grid
            if (pos.y - gridY > 0.5) {
                // Closer to ceil
                gridY = Math.floor(pos.y + 0.5);
            }
            const gridZ = Math.floor(pos.z);

            useGameStore.getState().landFallingBlock(id, [gridX, gridY, gridZ], type);
            // Force checking for anything that was resting on this block
            setTimeout(() => checkGravityAbove(gridX, gridY, gridZ), 100);
        }
    });

    return (
        <RigidBody
            ref={rbRef}
            type="dynamic"
            colliders="cuboid"
            position={initialPos}
            restitution={0}
            friction={1.0}
            lockRotations // sand falls straight down
            ccd
        >
            <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
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
                <FallingBlockNode key={b.id} id={b.id} type={b.type} initialPos={b.pos} />
            ))}
        </>
    );
};

export default FallingBlocksManager;
