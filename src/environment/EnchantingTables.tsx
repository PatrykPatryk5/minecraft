import React, { useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import useGameStore, { chunkKey } from '../store/gameStore';
import { BlockType } from '../core/blockTypes';
import * as THREE from 'three';

const SCAN_RADIUS = 2; // 5x5 chunks around player
const SCAN_INTERVAL_MS = 1000;
const MAX_TABLES = 16;

interface TablePos {
    x: number;
    y: number;
    z: number;
    distSq: number;
}

const EnchantingTables: React.FC = () => {
    const [tables, setTables] = useState<TablePos[]>([]);
    const lastScanTime = useRef(0);
    const cameraPos = useRef(new THREE.Vector3());

    useFrame((state) => {
        cameraPos.current.copy(state.camera.position);
        const now = performance.now();
        if (now - lastScanTime.current > SCAN_INTERVAL_MS) {
            lastScanTime.current = now;
            scanForTables();
        }
    });

    const scanForTables = () => {
        const store = useGameStore.getState();
        if (store.dimension !== 'overworld' && store.dimension !== 'nether' && store.dimension !== 'end') return;

        const px = Math.floor(cameraPos.current.x);
        const py = Math.floor(cameraPos.current.y);
        const pz = Math.floor(cameraPos.current.z);

        const pcx = Math.floor(px / 16);
        const pcz = Math.floor(pz / 16);

        const found: TablePos[] = [];

        for (let dx = -SCAN_RADIUS; dx <= SCAN_RADIUS; dx++) {
            for (let dz = -SCAN_RADIUS; dz <= SCAN_RADIUS; dz++) {
                const cx = pcx + dx;
                const cz = pcz + dz;
                const key = chunkKey(cx, cz);
                const chunk = store.chunks[key];
                if (!chunk) continue;

                // Doing a flat array search
                for (let i = 0; i < chunk.length; i++) {
                    const blockId = chunk[i] & 0x0FFF;
                    if (blockId === BlockType.ENCHANTING_TABLE) {
                        const y = i >> 8;
                        const lz = (i >> 4) & 0x0F;
                        const lx = i & 0x0F;
                        const wx = cx * 16 + lx;
                        const wz = cz * 16 + lz;

                        const distSq = (wx - px) ** 2 + (y - py) ** 2 + (wz - pz) ** 2;
                        if (distSq < (SCAN_RADIUS * 16) ** 2) {
                            found.push({ x: wx + 0.5, y: y + 1.25, z: wz + 0.5, distSq });
                        }
                    }
                }
            }
        }

        // Limit to nearest ones
        found.sort((a, b) => a.distSq - b.distSq);
        const top = found.slice(0, MAX_TABLES);

        setTables(prev => {
            if (prev.length !== top.length) return top;
            for (let i = 0; i < prev.length; i++) {
                if (prev[i].x !== top[i].x || prev[i].y !== top[i].y || prev[i].z !== top[i].z) return top;
            }
            return prev;
        });
    };

    return (
        <group>
            {tables.map(t => (
                <FloatingBook key={`${t.x},${t.y},${t.z}`} pos={t} />
            ))}
        </group>
    );
};

const FloatingBook: React.FC<{ pos: TablePos }> = ({ pos }) => {
    const bookRef = useRef<THREE.Group>(null);
    useFrame((state) => {
        if (!bookRef.current) return;
        const t = state.clock.elapsedTime * 2;
        // Bobbing & hovering
        bookRef.current.position.y = pos.y + Math.sin(t) * 0.1;
        bookRef.current.rotation.y = t * 0.5;
    });

    return (
        <group ref={bookRef} position={[pos.x, pos.y, pos.z]}>
            {/* Book Cover */}
            <mesh>
                <boxGeometry args={[0.4, 0.05, 0.3]} />
                <meshStandardMaterial color="#8b3a00" roughness={0.7} />
            </mesh>
            {/* Pages (slightly inset, white) */}
            <mesh position={[0, 0.01, 0]}>
                <boxGeometry args={[0.36, 0.06, 0.28]} />
                <meshStandardMaterial color="#ffffff" roughness={1.0} emissive="#333333" emissiveIntensity={0.2} />
            </mesh>
        </group>
    );
};

export default EnchantingTables;
