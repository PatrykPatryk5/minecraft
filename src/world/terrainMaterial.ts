import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { attribute, cos, modelPosition, positionGeometry, sin, vec3 } from 'three/tsl';
import { globalTerrainUniforms } from '../core/constants';

const terrainMaterialCache = new WeakMap<THREE.Texture, {
    solid?: MeshStandardNodeMaterial;
    water?: MeshStandardNodeMaterial;
}>();

export function createTerrainMaterial(atlas: THREE.Texture, water = false): MeshStandardNodeMaterial {
    let cached = terrainMaterialCache.get(atlas);
    const cachedMaterial = water ? cached?.water : cached?.solid;
    if (cachedMaterial) return cachedMaterial;

    const material = new MeshStandardNodeMaterial({
        map: atlas,
        vertexColors: true,
        alphaTest: water ? 0 : 0.5,
        transparent: water,
        opacity: water ? 0.8 : 1,
        side: water ? THREE.DoubleSide : THREE.FrontSide,
        depthWrite: !water,
        roughness: water ? 0.1 : 0.9,
        metalness: water ? 0.1 : 0.05,
    });

    const local = positionGeometry;
    const worldX = local.x.add(modelPosition.x);
    const worldZ = local.z.add(modelPosition.z);
    const flora = attribute('isFlora', 'float');
    const liquid = attribute('isLiquid', 'float');

    const swayX = sin(worldX.mul(2).add(local.y.mul(3)).add(globalTerrainUniforms.uTime.mul(2)))
        .mul(0.08).mul(flora);
    const swayZ = cos(worldZ.mul(2).add(local.y.mul(3)).add(globalTerrainUniforms.uTime.mul(2.4)))
        .mul(0.08).mul(flora);
    const wave = sin(worldX.mul(2).add(worldZ.mul(2)).add(globalTerrainUniforms.uTime.mul(1.5)))
        .mul(water ? 0.06 : 0).mul(liquid);

    // TSL node displacement replaces the former GLSL onBeforeCompile hook.
    material.positionNode = local.add(vec3(swayX, wave, swayZ));

    if (!cached) {
        cached = {};
        terrainMaterialCache.set(atlas, cached);
    }
    if (water) cached.water = material;
    else cached.solid = material;

    return material;
}
