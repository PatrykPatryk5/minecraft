/**
 * Shared Meshing Utilities
 * Useful for both main thread and meshing workers.
 */

import { BLOCK_DATA, BlockType } from './blockTypes';

export interface FaceDef {
    dir: [number, number, number];
    corners: [number, number, number][];
    uv: [number, number][];
    name: 'right' | 'left' | 'top' | 'bottom' | 'front' | 'back';
}

export interface AtlasUV {
    u: number;
    v: number;
    su: number;
    sv: number;
}

export const FACES: FaceDef[] = [
    { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], uv: [[0, 0], [0, 1], [1, 1], [1, 0]], name: 'right' },
    { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], uv: [[0, 0], [0, 1], [1, 1], [1, 0]], name: 'left' },
    { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], name: 'top' },
    { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], name: 'bottom' },
    { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], name: 'front' },
    { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], name: 'back' },
];

let globalUVMap: Record<string, AtlasUV> = {};

export function initWorkerUVs(uvs: Record<string, AtlasUV>) {
    globalUVMap = uvs;
}

export function getAtlasUV(blockId: number, faceName: string): AtlasUV {
    return globalUVMap[`${blockId}_${faceName}`] || { u: 0, v: 0, su: 0, sv: 0 };
}

export function isTransparent(bt: number): boolean {
    const id = bt & 0x0FFF;
    if (!id) return true;
    return BLOCK_DATA[id]?.transparent ?? true;
}
