/**
 * Texture & Material System (Performance-Optimized)
 *
 * Uses MeshLambertMaterial for maximum GPU performance.
 * MeshStandardMaterial was causing frame drops on RTX 3060.
 *
 * Features:
 *   - 16×16 procedural pixel textures
 *   - MeshLambertMaterial (fast shading)
 *   - Shared material cache (reduces draw calls)
 *   - 3D isometric block icon renderer for inventory
 */

import * as THREE from 'three';
import { BLOCK_DATA, BlockType } from './blockTypes';

const TEX_SIZE = 16;
const cache = new Map<string, THREE.CanvasTexture>();
const materialCache = new Map<string, THREE.MeshLambertMaterial>();

// ─── Deterministic RNG ───────────────────────────────────
function seededRng(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

function hexToRgb(hex: string): [number, number, number] {
    return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
    ];
}

function varyColor(rgb: [number, number, number], amount: number, rng: () => number): [number, number, number] {
    return [
        Math.max(0, Math.min(255, rgb[0] + (rng() - 0.5) * amount)),
        Math.max(0, Math.min(255, rgb[1] + (rng() - 0.5) * amount)),
        Math.max(0, Math.min(255, rgb[2] + (rng() - 0.5) * amount)),
    ];
}

function darken(rgb: [number, number, number], factor: number): [number, number, number] {
    return [rgb[0] * factor | 0, rgb[1] * factor | 0, rgb[2] * factor | 0];
}

interface DrawOpts {
    variance?: number;
    oreColor?: string;
    brick?: boolean;
    planks?: boolean;
    grassTop?: string;
    logRings?: boolean;
    leafy?: boolean;
    glassy?: boolean;
    cracks?: boolean;
    stripes?: boolean;
    glow?: boolean;
}

function drawPixelTexture(ctx: CanvasRenderingContext2D, baseHex: string, seed: number, opts: DrawOpts = {}): void {
    const rng = seededRng(seed);
    const base = hexToRgb(baseHex);
    const v = opts.variance ?? 30;

    // Base noise fill
    for (let y = 0; y < TEX_SIZE; y++) {
        const yFade = 1 - y * 0.012;
        for (let x = 0; x < TEX_SIZE; x++) {
            const c = varyColor(base, v, rng);
            ctx.fillStyle = `rgb(${(c[0] * yFade) | 0},${(c[1] * yFade) | 0},${(c[2] * yFade) | 0})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    if (opts.oreColor) {
        const oreRgb = hexToRgb(opts.oreColor);
        const bright = [Math.min(255, oreRgb[0] + 50), Math.min(255, oreRgb[1] + 50), Math.min(255, oreRgb[2] + 50)] as [number, number, number];
        for (let i = 0; i < 7; i++) {
            const ox = (rng() * 13 + 1) | 0;
            const oy = (rng() * 13 + 1) | 0;
            const sz = (rng() * 2 + 1) | 0;
            for (let dy = 0; dy < sz; dy++) {
                for (let dx = 0; dx < sz; dx++) {
                    const c = varyColor(dx === 0 && dy === 0 ? bright : oreRgb, 12, rng);
                    ctx.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
                    ctx.fillRect(ox + dx, oy + dy, 1, 1);
                }
            }
        }
    }

    if (opts.brick) {
        ctx.fillStyle = 'rgba(50,35,25,0.45)';
        for (let row = 0; row < 4; row++) {
            ctx.fillRect(0, row * 4, TEX_SIZE, 1);
            const off = row % 2 === 0 ? 0 : 8;
            ctx.fillRect(off, row * 4, 1, 4);
            ctx.fillRect(off + 8, row * 4, 1, 4);
        }
    }

    if (opts.grassTop) {
        const grassRgb = hexToRgb(opts.grassTop);
        for (let x = 0; x < TEX_SIZE; x++) {
            const h = 2 + (rng() * 3) | 0;
            for (let y = 0; y < h; y++) {
                const c = varyColor(grassRgb, 20, rng);
                ctx.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }

    if (opts.planks) {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let row = 0; row < 4; row++) ctx.fillRect(0, row * 4, TEX_SIZE, 1);
        ctx.fillRect(4, 0, 1, TEX_SIZE);
        ctx.fillRect(12, 0, 1, TEX_SIZE);
    }

    if (opts.logRings) {
        for (let y = 0; y < TEX_SIZE; y++) {
            for (let x = 0; x < TEX_SIZE; x++) {
                const dist = Math.sqrt((x - 8) ** 2 + (y - 8) ** 2);
                if (Math.floor(dist) % 3 === 0) {
                    const c = darken(base, 0.8);
                    ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.35)`;
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
        ctx.fillStyle = 'rgba(60,40,20,0.6)';
        ctx.fillRect(7, 7, 2, 2);
    }

    if (opts.leafy) {
        for (let y = 0; y < TEX_SIZE; y++) {
            for (let x = 0; x < TEX_SIZE; x++) {
                if (rng() < 0.18) {
                    ctx.fillStyle = 'rgba(0,0,0,0.18)';
                    ctx.fillRect(x, y, 1, 1);
                } else if (rng() < 0.08) {
                    ctx.fillStyle = 'rgba(100,200,50,0.25)';
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    }

    if (opts.glassy) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(1, 1, 3, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(15, 0, 1, TEX_SIZE);
        ctx.fillRect(0, 15, TEX_SIZE, 1);
    }

    if (opts.cracks) {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let i = 0; i < 3; i++) {
            let cx = (rng() * 14 + 1) | 0;
            let cy = (rng() * 14 + 1) | 0;
            for (let j = 0; j < 4; j++) {
                ctx.fillRect(cx, cy, 1, 1);
                cx += rng() > 0.5 ? 1 : 0;
                cy += rng() > 0.5 ? 1 : -1;
            }
        }
    }

    if (opts.stripes) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        for (let y = 0; y < TEX_SIZE; y += 2) ctx.fillRect(0, y, TEX_SIZE, 1);
    }

    if (opts.glow) {
        const grad = ctx.createRadialGradient(8, 8, 2, 8, 8, 8);
        grad.addColorStop(0, 'rgba(255,255,200,0.2)');
        grad.addColorStop(1, 'rgba(255,255,200,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    }
}

function getDrawOpts(blockId: number, face: 'top' | 'bottom' | 'side'): DrawOpts {
    const data = BLOCK_DATA[blockId];
    if (!data) return {};
    const opts: DrawOpts = { variance: data.transparent ? 15 : 28 };
    if (data.ore) opts.oreColor = data.ore;
    if (blockId === BlockType.BRICK || blockId === BlockType.STONE_BRICKS || blockId === BlockType.MOSSY_STONE_BRICKS) opts.brick = true;
    if (blockId === BlockType.PLANKS || blockId === BlockType.SPRUCE_PLANKS || blockId === BlockType.BIRCH_PLANKS || blockId === BlockType.BOOKSHELF) opts.planks = true;
    if (face === 'side' && data.sideOverlay) opts.grassTop = data.sideOverlay;
    if (face === 'top' && (blockId === BlockType.OAK_LOG || blockId === BlockType.SPRUCE || blockId === BlockType.BIRCH_LOG)) opts.logRings = true;
    if (blockId === BlockType.LEAVES) opts.leafy = true;
    if (blockId === BlockType.GLASS) opts.glassy = true;
    if (blockId === BlockType.STONE || blockId === BlockType.COBBLE || blockId === BlockType.MOSSY_COBBLE) opts.cracks = true;
    if (blockId >= BlockType.WOOL_WHITE && blockId <= BlockType.WOOL_BLACK) opts.stripes = true;
    if (blockId === BlockType.GLOWSTONE || blockId === BlockType.TORCH) opts.glow = true;
    return opts;
}

function createTexture(blockId: number, face: 'top' | 'bottom' | 'side'): THREE.CanvasTexture {
    const key = `${blockId}_${face}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const data = BLOCK_DATA[blockId];
    if (!data) return createFallbackTexture();

    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d')!;

    let color = data.color;
    if (face === 'top' && data.top) color = data.top;
    if (face === 'bottom' && data.bottom) color = data.bottom;

    const seed = blockId * 1000 + (face === 'top' ? 1 : face === 'bottom' ? 2 : 3);
    drawPixelTexture(ctx, color, seed, getDrawOpts(blockId, face));

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;

    cache.set(key, tex);
    return tex;
}

function createFallbackTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = c.height = TEX_SIZE;
    const ctx = c.getContext('2d')!;
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            ctx.fillStyle = (x + y) % 2 === 0 ? '#ff00ff' : '#000';
            ctx.fillRect(x, y, 1, 1);
        }
    }
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    return t;
}

/**
 * Get cached material for a block face.
 * Uses MeshLambertMaterial for maximum performance.
 */
export function getBlockMaterial(blockId: number, face: 'top' | 'bottom' | 'side'): THREE.MeshLambertMaterial {
    const key = `${blockId}_${face}`;
    const cached = materialCache.get(key);
    if (cached) return cached;

    const data = BLOCK_DATA[blockId];
    const tex = createTexture(blockId, face);

    const isGlass = blockId === BlockType.GLASS;
    const isWater = blockId === BlockType.WATER;
    const isLeaf = blockId === BlockType.LEAVES;
    const isGlow = blockId === BlockType.GLOWSTONE || blockId === BlockType.TORCH;

    const mat = new THREE.MeshLambertMaterial({
        map: tex,
        transparent: data?.transparent ?? false,
        opacity: isWater ? 0.55 : isGlass ? 0.7 : isLeaf ? 0.9 : 1,
        side: data?.transparent ? THREE.DoubleSide : THREE.FrontSide,
        emissive: isGlow ? new THREE.Color(data?.color ?? '#eedd66') : undefined,
        emissiveIntensity: isGlow ? 0.5 : 0,
        alphaTest: isLeaf ? 0.15 : 0,
        vertexColors: true,
    });

    materialCache.set(key, mat);
    return mat;
}

/** Pre-generate all textures */
export function preloadAllTextures(): void {
    for (const id of Object.keys(BLOCK_DATA)) {
        const numId = Number(id);
        if (numId >= 100) continue;
        createTexture(numId, 'top');
        createTexture(numId, 'side');
        createTexture(numId, 'bottom');
    }
}

// ─── 3D Isometric Block Icon Renderer ────────────────────
const iconCache = new Map<number, string>();

export function getBlockIcon(blockId: number): string {
    const cached = iconCache.get(blockId);
    if (cached) return cached;

    const data = BLOCK_DATA[blockId];
    if (!data) return '';

    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const topColor = data.top ?? data.color;
    const sideColor = data.color;
    const frontColor = data.bottom ?? data.color;

    const cx = size / 2;
    const cy = size / 2;
    const s = size * 0.35;

    if (data.isItem) {
        const rgb = hexToRgb(data.color);
        ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        ctx.fillRect(size * 0.4, size * 0.1, size * 0.2, size * 0.5);
        ctx.fillStyle = '#8B6B3E';
        ctx.fillRect(size * 0.45, size * 0.5, size * 0.1, size * 0.4);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(size * 0.4, size * 0.1, size * 0.2, size * 0.5);
        ctx.strokeRect(size * 0.45, size * 0.5, size * 0.1, size * 0.4);
    } else {
        // Top face
        const topRgb = hexToRgb(topColor);
        ctx.fillStyle = `rgb(${Math.min(255, topRgb[0] + 25)},${Math.min(255, topRgb[1] + 25)},${Math.min(255, topRgb[2] + 25)})`;
        ctx.beginPath();
        ctx.moveTo(cx, cy - s * 0.6); ctx.lineTo(cx + s, cy); ctx.lineTo(cx, cy + s * 0.6); ctx.lineTo(cx - s, cy);
        ctx.closePath(); ctx.fill();

        // Left face
        const sideRgb = hexToRgb(sideColor);
        ctx.fillStyle = `rgb(${(sideRgb[0] * 0.7) | 0},${(sideRgb[1] * 0.7) | 0},${(sideRgb[2] * 0.7) | 0})`;
        ctx.beginPath();
        ctx.moveTo(cx - s, cy); ctx.lineTo(cx, cy + s * 0.6); ctx.lineTo(cx, cy + s * 1.5); ctx.lineTo(cx - s, cy + s * 0.9);
        ctx.closePath(); ctx.fill();

        // Right face
        const frontRgb = hexToRgb(frontColor);
        ctx.fillStyle = `rgb(${(frontRgb[0] * 0.5) | 0},${(frontRgb[1] * 0.5) | 0},${(frontRgb[2] * 0.5) | 0})`;
        ctx.beginPath();
        ctx.moveTo(cx + s, cy); ctx.lineTo(cx, cy + s * 0.6); ctx.lineTo(cx, cy + s * 1.5); ctx.lineTo(cx + s, cy + s * 0.9);
        ctx.closePath(); ctx.fill();

        // Edges
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy - s * 0.6); ctx.lineTo(cx + s, cy); ctx.lineTo(cx, cy + s * 0.6); ctx.lineTo(cx - s, cy);
        ctx.closePath(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - s, cy); ctx.lineTo(cx - s, cy + s * 0.9); ctx.lineTo(cx, cy + s * 1.5); ctx.lineTo(cx, cy + s * 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + s, cy); ctx.lineTo(cx + s, cy + s * 0.9); ctx.lineTo(cx, cy + s * 1.5); ctx.lineTo(cx, cy + s * 0.6);
        ctx.stroke();

        // Ore dots
        if (data.ore) {
            const oreRgb = hexToRgb(data.ore);
            ctx.fillStyle = `rgba(${oreRgb[0]},${oreRgb[1]},${oreRgb[2]},0.65)`;
            const irng = seededRng(blockId * 777);
            for (let i = 0; i < 3; i++) {
                ctx.fillRect((irng() * (size - 10) + 5) | 0, (irng() * (size - 10) + 5) | 0, 3, 3);
            }
        }
    }

    const url = canvas.toDataURL();
    iconCache.set(blockId, url);
    return url;
}
