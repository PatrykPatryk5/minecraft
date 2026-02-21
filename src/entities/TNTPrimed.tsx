import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';
import { getAtlasTexture, getAtlasUV } from '../core/textures';
import { BlockType } from '../core/blockTypes';
import { explodeAt } from '../core/blockActions';

const TNTPrimedNode: React.FC<{ id: string; initialPos: [number, number, number]; fuse: number }> = ({ id, initialPos, fuse }) => {
    const rbRef = useRef<RapierRigidBody>(null);
    const meshRef = useRef<THREE.Mesh>(null);
    const atlas = getAtlasTexture();
    const [currentFuse, setCurrentFuse] = useState(fuse);
    const exploded = useRef(false);

    // Geometry with TNT textures
    const geometry = useMemo(() => {
        const geo = new THREE.BoxGeometry(0.98, 0.98, 0.98); // Slightly smaller to avoid clipping
        const uvs = geo.attributes.uv;
        const array = uvs.array as Float32Array;
        const faces: ('right' | 'left' | 'top' | 'bottom' | 'front' | 'back')[] = ['right', 'left', 'top', 'bottom', 'front', 'back'];

        for (let i = 0; i < 6; i++) {
            const face = faces[i];
            const uvData = getAtlasUV(BlockType.TNT, face);
            const v0 = i * 4 * 2;
            array[v0 + 0] = uvData.u; array[v0 + 1] = uvData.v + uvData.sv;
            array[v0 + 2] = uvData.u + uvData.su; array[v0 + 3] = uvData.v + uvData.sv;
            array[v0 + 4] = uvData.u; array[v0 + 5] = uvData.v;
            array[v0 + 6] = uvData.u + uvData.su; array[v0 + 7] = uvData.v;
        }
        geo.attributes.uv.needsUpdate = true;
        return geo;
    }, []);

    useFrame((state, delta) => {
        if (exploded.current) return;

        // Tick fuse (Minecraft is 20tps, but we tick every frame approx)
        const ticks = delta * 20;
        const nextFuse = Math.max(0, currentFuse - ticks);

        if (nextFuse <= 0) {
            exploded.current = true;
            const pos = rbRef.current?.translation() || { x: initialPos[0], y: initialPos[1], z: initialPos[2] };

            // Remove entity from store FIRST so mesh disappears immediately
            useGameStore.getState().removeTNT(id);

            // Trigger explosion logic
            explodeAt(Math.round(pos.x), Math.round(pos.y), Math.round(pos.z));
            return;
        }

        setCurrentFuse(nextFuse);

        // Flashing effect
        if (meshRef.current) {
            // Flash white every 10 ticks
            const flash = Math.floor(nextFuse / 5) % 2 === 0;
            const mat = meshRef.current.material as THREE.MeshStandardMaterial;
            mat.emissiveIntensity = flash ? 0.5 : 0;
            mat.emissive.set(flash ? '#fff' : '#000');

            // Swelling effect before explosion
            if (nextFuse < 20) {
                const s = 1.0 + (1.0 - nextFuse / 20) * 0.2;
                meshRef.current.scale.set(s, s, s);
            }
        }
    });

    return (
        <RigidBody
            ref={rbRef}
            type="dynamic"
            colliders="cuboid"
            position={initialPos}
            restitution={0.3}
            friction={0.5}
            ccd
        >
            <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
                <meshStandardMaterial map={atlas} transparent alphaTest={0.1} emissiveIntensity={0} />
            </mesh>
        </RigidBody>
    );
};

export const TNTManager: React.FC = () => {
    const tntList = useGameStore((s) => s.primedTNT);
    return (
        <>
            {tntList.map((t) => (
                <TNTPrimedNode key={t.id} id={t.id} initialPos={t.pos} fuse={t.fuse} />
            ))}
        </>
    );
};

export default TNTManager;
