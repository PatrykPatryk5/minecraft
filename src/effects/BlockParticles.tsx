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

            // Physics with drag
            if (p.type !== 'smoke') p.velocity.y -= 15 * delta; // Gravity
            p.velocity.multiplyScalar(Math.pow(p.drag, delta * 60));
            p.position.addScaledVector(p.velocity, delta);

            dummy.position.copy(p.position);

            // Type-specific behavior
            if (p.type === 'block') {
                p.rotation += p.rotationVelocity * delta;
                dummy.rotation.set(p.rotation, p.rotation * 0.5, p.rotation * 0.2);
                const scale = Math.max(0, p.size * (Math.min(1, p.life * 4)));
                dummy.scale.set(scale, scale, scale);
            } else if (p.type === 'smoke') {
                dummy.rotation.set(0, 0, 0);
                // Smoke grows slightly then shrinks
                const lifeAlpha = p.life / 1.5;
                const scale = p.size * (1 + (1 - lifeAlpha) * 1.5) * Math.min(1, lifeAlpha * 5);
                dummy.scale.set(scale, scale, scale);
                // Darken smoke over time
                p.color.setHSL(0, 0, 0.5 * lifeAlpha + 0.1);
            } else if (p.type === 'spark') {
                dummy.rotation.set(0, 0, 0);
                const scale = p.size * Math.min(1, p.life * 10);
                dummy.scale.set(scale, scale, scale);
            }

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
            <meshLambertMaterial transparent={true} />
        </instancedMesh>
    );
};

export default BlockParticles;


