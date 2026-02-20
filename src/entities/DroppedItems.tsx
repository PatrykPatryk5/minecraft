import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';
import { getAtlasTexture, getAtlasUV } from '../core/textures';
import { playSound } from '../audio/sounds';

const DroppedItem: React.FC<{ id: string; type: number; initialPos: [number, number, number]; initialVel?: [number, number, number] }> = ({ id, type, initialPos, initialVel }) => {
    const rbRef = useRef<RapierRigidBody>(null);
    const meshRef = useRef<THREE.Mesh>(null);
    const pickedUp = useRef(false);
    const atlas = getAtlasTexture();

    // Generate accurate texture mapping for the small box based on the atlas
    const geometry = useMemo(() => {
        const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
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
        geo.translate(0, 0.15, 0); // Visual offset so it doesn't look sunken into the floor
        return geo;
    }, [type]);

    useFrame(() => {
        // Spin the mesh for classic Minecraft visual feel
        if (meshRef.current) {
            meshRef.current.rotation.y += 0.02;
        }

        // Check pickup distance continuously
        if (rbRef.current && !pickedUp.current) {
            const pos = rbRef.current.translation();
            const playerPos = useGameStore.getState().playerPos;
            const distSq = (pos.x - playerPos[0]) ** 2 + (pos.y - playerPos[1]) ** 2 + (pos.z - playerPos[2]) ** 2;

            // Pickup radius: ~2.0 blocks
            if (distSq < 4.0) {
                pickedUp.current = true;
                const s = useGameStore.getState();
                const added = s.addItem(type, 1);
                if (added) {
                    s.removeDroppedItem(id);
                    playSound('pop');
                } else {
                    pickedUp.current = false; // Inventory full
                }
            }
        }
    });

    return (
        <RigidBody
            ref={rbRef}
            type="dynamic"
            colliders="cuboid"
            position={initialPos}
            linearVelocity={initialVel || [0, 3, 0]}
            restitution={0.2}
            friction={0.8}
            ccd={true}
            lockRotations // keep it upright, only spinning visually via the inner mesh
        >
            <mesh ref={meshRef} geometry={geometry} castShadow>
                <meshStandardMaterial map={atlas} transparent alphaTest={0.1} />
            </mesh>
        </RigidBody>
    );
};

const DroppedItemsManager: React.FC = () => {
    const items = useGameStore((s) => s.droppedItems);
    return (
        <>
            {items.map((item) => (
                <DroppedItem key={item.id} id={item.id} type={item.type} initialPos={item.pos} initialVel={item.velocity} />
            ))}
        </>
    );
};

export default DroppedItemsManager;
