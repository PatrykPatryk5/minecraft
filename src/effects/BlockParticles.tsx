import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { particles, MAX_PARTICLES } from '../core/particles';

const dummy = new THREE.Object3D();

const BlockParticles: React.FC = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null);

    useFrame((_, delta) => {
        if (!meshRef.current) return;
        const mesh = meshRef.current;
        let drawCount = 0;

        for (let i = 0; i < MAX_PARTICLES; i++) {
            const p = particles[i];
            if (!p.active) continue;

            p.life -= delta;
            if (p.life <= 0) {
                p.active = false;
                continue;
            }

            p.velocity.y -= 15 * delta;
            p.position.addScaledVector(p.velocity, delta);

            dummy.position.copy(p.position);
            // Shrink as it dies instead of fading opacity
            const scale = Math.max(0, p.size * (p.life * 2));
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();

            mesh.setMatrixAt(drawCount, dummy.matrix);
            mesh.setColorAt(drawCount, p.color);
            drawCount++;
        }

        mesh.count = drawCount;
        if (drawCount > 0) {
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PARTICLES]} frustumCulled={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial />
        </instancedMesh>
    );
};

export default BlockParticles;


