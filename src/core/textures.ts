/**
 * Texture & Material System — Minecraft-Accurate Procedural Textures
 *
 * Generates pixel-accurate 16×16 textures that closely replicate real Minecraft.
 * Uses MeshLambertMaterial for maximum GPU performance.
 * All textures are cached; materials are shared to minimize draw calls.
 */

import * as THREE from 'three';
import { BLOCK_DATA, BlockType } from './blockTypes';

const TEX_SIZE = 16;
const cache = new Map<string, THREE.CanvasTexture>();
const materialCache = new Map<string, THREE.MeshLambertMaterial>();

// ─── Deterministic RNG ───────────────────────────────────
function sRng(seed: number): () => number {
    let s = seed;
    return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

type RGB = [number, number, number];

function hex(h: string): RGB {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, g: number, b: number) {
    ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
    ctx.fillRect(x, y, 1, 1);
}

function vary(c: RGB, a: number, rng: () => number): RGB {
    return [
        Math.max(0, Math.min(255, c[0] + (rng() - 0.5) * a)),
        Math.max(0, Math.min(255, c[1] + (rng() - 0.5) * a)),
        Math.max(0, Math.min(255, c[2] + (rng() - 0.5) * a)),
    ];
}

function darken(c: RGB, f: number): RGB { return [(c[0] * f) | 0, (c[1] * f) | 0, (c[2] * f) | 0]; }
function lighten(c: RGB, a: number): RGB { return [Math.min(255, c[0] + a), Math.min(255, c[1] + a), Math.min(255, c[2] + a)]; }

function fillNoise(ctx: CanvasRenderingContext2D, base: RGB, v: number, seed: number) {
    const rng = sRng(seed);
    for (let y = 0; y < TEX_SIZE; y++)
        for (let x = 0; x < TEX_SIZE; x++) {
            const c = vary(base, v, rng);
            px(ctx, x, y, c[0], c[1], c[2]);
        }
}

// ─── Per-Block Texture Draws (MC-Accurate) ───────────────

function drawStone(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    const base: RGB = [125, 125, 125];
    // Stone has subtle gray variation with darker cracks
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = (rng() - 0.5) * 25;
        px(ctx, x, y, base[0] + v, base[1] + v, base[2] + v);
    }
    // Dark crack lines
    const dark: RGB = [100, 100, 100];
    for (let i = 0; i < 4; i++) {
        let cx = (rng() * 14 + 1) | 0, cy = (rng() * 14 + 1) | 0;
        for (let j = 0; j < 3 + (rng() * 3 | 0); j++) {
            px(ctx, cx & 15, cy & 15, dark[0], dark[1], dark[2]);
            cx += rng() > 0.5 ? 1 : 0;
            cy += rng() > 0.5 ? 1 : 0;
        }
    }
}

function drawCobble(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    // Irregular stone pieces with dark mortar
    fillNoise(ctx, [122, 122, 122], 20, seed);
    // Mortar grid (dark lines)
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const onGrid = ((x + y) % 5 === 0 && rng() < 0.6) || ((x * y + 3) % 7 === 0 && rng() < 0.4);
        if (onGrid) px(ctx, x, y, 85, 85, 85);
    }
    // Brighter highlight stones
    for (let i = 0; i < 6; i++) {
        const sx = (rng() * 13 + 1) | 0, sy = (rng() * 13 + 1) | 0;
        const c = 130 + (rng() * 25 | 0);
        px(ctx, sx, sy, c, c, c);
        px(ctx, sx + 1, sy, c - 5, c - 5, c - 5);
        px(ctx, sx, sy + 1, c - 10, c - 10, c - 10);
    }
}

function drawDirt(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = rng() * 30 - 15;
        px(ctx, x, y, 134 + v, 96 + v * 0.7, 67 + v * 0.5);
    }
    // Small pebble spots
    for (let i = 0; i < 5; i++) {
        const sx = (rng() * 14 + 1) | 0, sy = (rng() * 14 + 1) | 0;
        px(ctx, sx, sy, 115, 82, 55);
    }
}

function drawGrassSide(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    // Dirt base
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = rng() * 25 - 12;
        px(ctx, x, y, 134 + v, 96 + v * 0.7, 67 + v * 0.5);
    }
    // Green top edge with grass hanging down
    for (let x = 0; x < 16; x++) {
        const g: RGB = [90 + (rng() * 30 | 0), 160 + (rng() * 20 | 0), 40 + (rng() * 20 | 0)];
        px(ctx, x, 0, g[0], g[1], g[2]);
        const h = 1 + (rng() * 2 | 0);
        for (let dy = 1; dy <= h; dy++) {
            const gc = darken(g, 0.85 - dy * 0.1);
            px(ctx, x, dy, gc[0], gc[1], gc[2]);
        }
    }
}

function drawGrassTop(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = rng() * 35 - 17;
        px(ctx, x, y, 90 + v * 0.5, 155 + v, 40 + v * 0.3);
    }
    for (let i = 0; i < 8; i++) {
        const sx = (rng() * 14 + 1) | 0, sy = (rng() * 14 + 1) | 0;
        px(ctx, sx, sy, 70 + (rng() * 20 | 0), 140 + (rng() * 15 | 0), 30);
    }
}

function drawSand(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = rng() * 18 - 9;
        px(ctx, x, y, 219 + v, 206 + v * 0.9, 163 + v * 0.6);
    }
}

function drawOakLogSide(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    const bark: RGB = [107, 84, 51];
    for (let y = 0; y < 16; y++) {
        const stripe = y % 4 === 0 ? -15 : 0;
        for (let x = 0; x < 16; x++) {
            const v = rng() * 15 - 7 + stripe;
            px(ctx, x, y, bark[0] + v, bark[1] + v * 0.8, bark[2] + v * 0.5);
        }
    }
    // Vertical bark lines
    for (let x = 0; x < 16; x += 3 + (rng() * 2 | 0)) {
        for (let y = 0; y < 16; y++) if (rng() < 0.3) px(ctx, x, y, 85, 65, 38);
    }
}

function drawLogTop(ctx: CanvasRenderingContext2D, barkColor: RGB, ringColor: RGB, seed: number) {
    const rng = sRng(seed);
    // Bark border
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const c = vary(barkColor, 15, rng);
        px(ctx, x, y, c[0], c[1], c[2]);
    }
    // Inner wood with rings
    const inner: RGB = [178, 144, 88];
    for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) {
        const dist = Math.sqrt((x - 8) ** 2 + (y - 8) ** 2);
        const onRing = Math.floor(dist) % 3 === 0;
        const c = onRing ? darken(inner, 0.78) : vary(inner, 10, rng);
        px(ctx, x, y, c[0], c[1], c[2]);
    }
    // Center dot
    px(ctx, 7, 7, 90, 65, 35); px(ctx, 8, 7, 90, 65, 35);
    px(ctx, 7, 8, 90, 65, 35); px(ctx, 8, 8, 90, 65, 35);
}

function drawPlanks(ctx: CanvasRenderingContext2D, base: RGB, seed: number) {
    const rng = sRng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = rng() * 18 - 9;
        px(ctx, x, y, base[0] + v, base[1] + v * 0.8, base[2] + v * 0.5);
    }
    // Horizontal plank separators
    for (const py of [0, 4, 8, 12]) {
        for (let x = 0; x < 16; x++) px(ctx, x, py, base[0] - 25, base[1] - 20, base[2] - 15);
    }
    // Vertical joints (staggered)
    for (let sec = 0; sec < 4; sec++) {
        const jx = sec % 2 === 0 ? 6 : 12;
        for (let dy = 0; dy < 4; dy++) px(ctx, jx, sec * 4 + dy, base[0] - 20, base[1] - 15, base[2] - 10);
    }
}

function drawLeaves(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (rng() < 0.15) { px(ctx, x, y, 20, 50, 15); continue; } // gaps (dark)
        const v = rng() * 40 - 20;
        px(ctx, x, y, 45 + v * 0.5, 120 + v, 25 + v * 0.3);
    }
}

function drawOre(ctx: CanvasRenderingContext2D, oreColor: RGB, seed: number) {
    // Stone base
    drawStone(ctx, seed);
    const rng = sRng(seed + 9999);
    // Ore patches — 3-4 clusters of 2-3 pixels
    for (let i = 0; i < 4; i++) {
        const ox = (rng() * 12 + 2) | 0, oy = (rng() * 12 + 2) | 0;
        const sz = 2 + (rng() * 2 | 0);
        for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) {
            if (rng() < 0.3) continue;
            const c = vary(oreColor, 20, rng);
            const bright = dx === 0 && dy === 0;
            px(ctx, (ox + dx) & 15, (oy + dy) & 15,
                bright ? Math.min(255, c[0] + 40) : c[0],
                bright ? Math.min(255, c[1] + 40) : c[1],
                bright ? Math.min(255, c[2] + 40) : c[2]);
        }
    }
}

function drawBricks(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    // Mortar fill
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(ctx, x, y, 155, 145, 130);
    // Individual bricks
    const brickRows = [[0, 0, 7, 3], [8, 0, 15, 3], [4, 4, 11, 7], [12, 4, 15, 7], [0, 4, 3, 7],
    [0, 8, 7, 11], [8, 8, 15, 11], [4, 12, 11, 15], [12, 12, 15, 15], [0, 12, 3, 15]];
    for (const [x1, y1, x2, y2] of brickRows) {
        const baseR = 170 + (rng() * 30 - 15 | 0);
        for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) {
            if (x === x1 || x === x2 || y === y1 || y === y2) continue; // keep mortar
            const v = rng() * 12 - 6;
            px(ctx, x, y, baseR + v, 75 + v * 0.5, 60 + v * 0.3);
        }
    }
}

function drawGlass(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    // Clear center
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        px(ctx, x, y, 200 + (rng() * 10 | 0), 230 + (rng() * 10 | 0), 255);
    }
    // Border frame (lighter edge)
    for (let i = 0; i < 16; i++) {
        px(ctx, i, 0, 180, 210, 235); px(ctx, i, 15, 180, 210, 235);
        px(ctx, 0, i, 180, 210, 235); px(ctx, 15, i, 180, 210, 235);
    }
    // Highlight corner
    px(ctx, 1, 1, 245, 250, 255); px(ctx, 2, 1, 240, 248, 255); px(ctx, 1, 2, 240, 248, 255);
}

function drawTNT(ctx: CanvasRenderingContext2D, face: string, seed: number) {
    const rng = sRng(seed);
    if (face === 'top') {
        // Gray/tan top with fuse hole
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const v = rng() * 15 - 7;
            px(ctx, x, y, 180 + v, 160 + v, 120 + v);
        }
        // Dark circle fuse
        for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) px(ctx, x, y, 50, 50, 50);
        px(ctx, 7, 7, 25, 25, 25); px(ctx, 8, 7, 25, 25, 25);
    } else {
        // Red body with white band
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            if (y >= 5 && y <= 10) {
                // White label band
                const v = rng() * 8 - 4;
                px(ctx, x, y, 230 + v, 225 + v, 215 + v);
            } else {
                const v = rng() * 20 - 10;
                px(ctx, x, y, 205 + v, 55 + v * 0.3, 45 + v * 0.2);
            }
        }
        // TNT letters on band
        // T
        for (let x = 2; x < 5; x++) px(ctx, x, 6, 60, 50, 45);
        px(ctx, 3, 7, 60, 50, 45); px(ctx, 3, 8, 60, 50, 45); px(ctx, 3, 9, 60, 50, 45);
        // N
        px(ctx, 6, 6, 60, 50, 45); px(ctx, 6, 7, 60, 50, 45); px(ctx, 6, 8, 60, 50, 45); px(ctx, 6, 9, 60, 50, 45);
        px(ctx, 7, 7, 60, 50, 45); px(ctx, 8, 8, 60, 50, 45);
        px(ctx, 9, 6, 60, 50, 45); px(ctx, 9, 7, 60, 50, 45); px(ctx, 9, 8, 60, 50, 45); px(ctx, 9, 9, 60, 50, 45);
        // T
        for (let x = 11; x < 14; x++) px(ctx, x, 6, 60, 50, 45);
        px(ctx, 12, 7, 60, 50, 45); px(ctx, 12, 8, 60, 50, 45); px(ctx, 12, 9, 60, 50, 45);
    }
}

function drawCraftingTop(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    // Wood base
    const base: RGB = [165, 120, 70];
    fillNoise(ctx, base, 15, seed);
    // 2x2 grid (darker lines at center)
    for (let i = 0; i < 16; i++) {
        px(ctx, 7, i, 120, 85, 45); px(ctx, 8, i, 120, 85, 45);
        px(ctx, i, 7, 120, 85, 45); px(ctx, i, 8, 120, 85, 45);
    }
}

function drawFurnaceSide(ctx: CanvasRenderingContext2D, isFront: boolean, isLit: boolean, seed: number) {
    const rng = sRng(seed);
    // Stone-ish base
    fillNoise(ctx, [130, 130, 130], 18, seed);
    if (isFront) {
        // Dark furnace opening
        for (let y = 7; y < 14; y++) for (let x = 4; x < 12; x++) {
            if (isLit) px(ctx, x, y, 200 + (rng() * 55 | 0), 100 + (rng() * 40 | 0), 20);
            else px(ctx, x, y, 45, 40, 38);
        }
        // Top grate
        for (let x = 4; x < 12; x++) px(ctx, x, 7, 65, 60, 55);
    }
}

function drawSnow(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = rng() * 12 - 6;
        px(ctx, x, y, 240 + v, 245 + v, 250);
    }
}

function drawWool(ctx: CanvasRenderingContext2D, base: RGB, seed: number) {
    const rng = sRng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = rng() * 16 - 8;
        px(ctx, x, y, base[0] + v, base[1] + v, base[2] + v);
    }
    // Fiber pattern: subtle diagonal lines
    for (let i = 0; i < 16; i++) {
        const fx = (i * 3 + 2) % 16, fy = (i * 5 + 1) % 16;
        const c = lighten(base, 8);
        px(ctx, fx, fy, c[0], c[1], c[2]);
    }
}

function drawGlowstone(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = rng() * 35 - 17;
        px(ctx, x, y, 220 + v, 200 + v * 0.8, 80 + v * 0.4);
    }
    // Cracked pattern
    for (let i = 0; i < 5; i++) {
        const sx = (rng() * 14 + 1) | 0, sy = (rng() * 14 + 1) | 0;
        px(ctx, sx, sy, 180, 155, 50);
    }
}

function drawNetherrack(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = rng() * 30 - 15;
        px(ctx, x, y, 110 + v, 35 + v * 0.3, 35 + v * 0.3);
    }
    for (let i = 0; i < 8; i++) {
        const sx = (rng() * 14 + 1) | 0, sy = (rng() * 14 + 1) | 0;
        px(ctx, sx, sy, 80, 25, 25);
    }
}

function drawObsidian(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = rng() * 15 - 7;
        px(ctx, x, y, 20 + v, 10 + v * 0.5, 35 + v);
    }
    // Purple glossy highlights
    for (let i = 0; i < 4; i++) {
        const sx = (rng() * 14 + 1) | 0, sy = (rng() * 14 + 1) | 0;
        px(ctx, sx, sy, 45, 20, 70);
    }
}

function drawSandstone(ctx: CanvasRenderingContext2D, face: string, seed: number) {
    const rng = sRng(seed);
    const base: RGB = [220, 200, 155];
    fillNoise(ctx, base, 12, seed);
    if (face === 'top') {
        // Top is slightly different shade
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            if (rng() < 0.1) px(ctx, x, y, 200, 180, 140);
        }
    } else {
        // Side: horizontal layers
        for (const ly of [3, 8, 13]) {
            for (let x = 0; x < 16; x++) px(ctx, x, ly, 195, 175, 135);
        }
    }
}

function drawStoneBricks(ctx: CanvasRenderingContext2D, mossy: boolean, seed: number) {
    const rng = sRng(seed);
    fillNoise(ctx, [120, 120, 120], 15, seed);
    // Brick pattern: 4 rows of 2 bricks
    for (let i = 0; i < 16; i++) {
        px(ctx, i, 0, 95, 95, 95); px(ctx, i, 4, 95, 95, 95);
        px(ctx, i, 8, 95, 95, 95); px(ctx, i, 12, 95, 95, 95);
    }
    for (let y = 0; y < 16; y++) {
        const off = (Math.floor(y / 4) % 2 === 0) ? 0 : 8;
        px(ctx, off, y, 95, 95, 95);
        px(ctx, (off + 8) % 16, y, 95, 95, 95);
    }
    if (mossy) {
        for (let i = 0; i < 20; i++) {
            const sx = (rng() * 14 + 1) | 0, sy = (rng() * 14 + 1) | 0;
            px(ctx, sx, sy, 60 + (rng() * 20 | 0), 105 + (rng() * 20 | 0), 45);
        }
    }
}

function drawBookshelf(ctx: CanvasRenderingContext2D, face: string, seed: number) {
    if (face === 'top' || face === 'bottom') { drawPlanks(ctx, [184, 148, 95], seed); return; }
    const rng = sRng(seed);
    // Plank frame
    drawPlanks(ctx, [184, 148, 95], seed);
    // Books in middle section
    const bookColors: RGB[] = [[120, 30, 30], [30, 50, 120], [50, 100, 40], [130, 100, 30], [30, 30, 80], [100, 30, 60]];
    for (let row = 0; row < 2; row++) {
        const by = row === 0 ? 1 : 9;
        let bx = 1;
        while (bx < 15) {
            const w = 2 + (rng() > 0.5 ? 1 : 0);
            const bc = bookColors[(rng() * bookColors.length) | 0];
            for (let dy = 0; dy < 6; dy++) for (let dx = 0; dx < w; dx++) {
                const c = vary(bc, 12, rng);
                px(ctx, bx + dx, by + dy, c[0], c[1], c[2]);
            }
            bx += w + 1;
        }
    }
}

function drawCactus(ctx: CanvasRenderingContext2D, face: string, seed: number) {
    const rng = sRng(seed);
    const base: RGB = face === 'top' ? [50, 130, 45] : [35, 105, 25];
    fillNoise(ctx, base, 18, seed);
    if (face !== 'top') {
        // Vertical ribs
        for (let y = 0; y < 16; y++) {
            for (const x of [3, 7, 11]) px(ctx, x, y, base[0] - 15, base[1] - 15, base[2] - 8);
        }
        // Spines
        for (let i = 0; i < 6; i++) {
            const sx = (rng() * 14 + 1) | 0, sy = (rng() * 14 + 1) | 0;
            px(ctx, sx, sy, 200, 210, 150);
        }
    }
}

function drawLava(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = rng() * 40 - 20;
        const hot = rng() < 0.15;
        if (hot) px(ctx, x, y, 255, 200 + (rng() * 55 | 0), 50);
        else px(ctx, x, y, 210 + v, 90 + v * 0.5, 15 + v * 0.2);
    }
    // Bright lava veins
    for (let i = 0; i < 3; i++) {
        let cx = (rng() * 14 + 1) | 0, cy = (rng() * 14 + 1) | 0;
        for (let j = 0; j < 4; j++) {
            px(ctx, cx & 15, cy & 15, 255, 220, 80);
            cx += rng() > 0.5 ? 1 : -1; cy += rng() > 0.5 ? 1 : 0;
        }
    }
}

function drawWater(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = rng() * 25 - 12;
        px(ctx, x, y, 30 + v * 0.3, 60 + v * 0.5, 170 + v);
    }
}

function drawChest(ctx: CanvasRenderingContext2D, face: string, seed: number) {
    const rng = sRng(seed);
    const base: RGB = [160, 120, 60];
    fillNoise(ctx, base, 12, seed);
    if (face === 'side') {
        // Latch
        px(ctx, 7, 6, 50, 45, 40); px(ctx, 8, 6, 50, 45, 40);
        px(ctx, 7, 7, 60, 55, 45); px(ctx, 8, 7, 60, 55, 45);
        // Horizontal band
        for (let x = 0; x < 16; x++) px(ctx, x, 8, 130, 95, 45);
    } else if (face === 'top') {
        // Darker top with edge frame
        for (let i = 0; i < 16; i++) {
            px(ctx, i, 0, 130, 95, 40); px(ctx, i, 15, 130, 95, 40);
            px(ctx, 0, i, 130, 95, 40); px(ctx, 15, i, 130, 95, 40);
        }
    }
}

function drawMelon(ctx: CanvasRenderingContext2D, face: string, seed: number) {
    const rng = sRng(seed);
    if (face === 'top') {
        fillNoise(ctx, [110, 140, 60], 15, seed);
    } else {
        fillNoise(ctx, [90, 140, 40], 15, seed);
        // Vertical stripes
        for (let y = 0; y < 16; y++) {
            for (const x of [2, 5, 8, 11, 14]) {
                const v = rng() * 10 - 5;
                px(ctx, x, y, 75 + v, 120 + v, 30 + v);
            }
        }
    }
}

function drawPumpkin(ctx: CanvasRenderingContext2D, face: string, seed: number) {
    const rng = sRng(seed);
    if (face === 'top') {
        fillNoise(ctx, [140, 105, 30], 15, seed);
        // Stem
        px(ctx, 7, 7, 60, 90, 30); px(ctx, 8, 7, 60, 90, 30);
        px(ctx, 7, 8, 60, 90, 30); px(ctx, 8, 8, 60, 90, 30);
    } else {
        fillNoise(ctx, [200, 120, 30], 18, seed);
        // Vertical ribs
        for (let y = 0; y < 16; y++) for (const x of [3, 7, 11]) px(ctx, x, y, 170, 100, 20);
    }
}

// ─── Main Texture Creation (MC-Accurate) ──────────────────

function drawBlockTexture(ctx: CanvasRenderingContext2D, blockId: number, face: 'top' | 'bottom' | 'side', seed: number): void {
    const data = BLOCK_DATA[blockId];
    if (!data) return;

    const rng = sRng(seed);

    switch (blockId) {
        case BlockType.STONE: drawStone(ctx, seed); return;
        case BlockType.COBBLE: drawCobble(ctx, seed); return;
        case BlockType.MOSSY_COBBLE: drawCobble(ctx, seed); // add moss
            for (let i = 0; i < 18; i++) { const sx = (rng() * 14 + 1) | 0, sy = (rng() * 14 + 1) | 0; px(ctx, sx, sy, 60 + (rng() * 25 | 0), 110 + (rng() * 20 | 0), 40); } return;
        case BlockType.DIRT: drawDirt(ctx, seed); return;
        case BlockType.GRASS:
            if (face === 'top') drawGrassTop(ctx, seed);
            else if (face === 'side') drawGrassSide(ctx, seed);
            else drawDirt(ctx, seed);
            return;
        case BlockType.SAND: drawSand(ctx, seed); return;
        case BlockType.OAK_LOG:
            if (face === 'top' || face === 'bottom') drawLogTop(ctx, [107, 84, 51], [150, 120, 70], seed);
            else drawOakLogSide(ctx, seed);
            return;
        case BlockType.SPRUCE:
            if (face === 'top' || face === 'bottom') drawLogTop(ctx, [61, 40, 19], [100, 75, 45], seed);
            else {
                fillNoise(ctx, [61, 40, 19], 15, seed);
                for (let x = 0; x < 16; x += 4) for (let y = 0; y < 16; y++) if (rng() < 0.25) px(ctx, x, y, 45, 28, 12);
            }
            return;
        case BlockType.BIRCH_LOG:
            if (face === 'top' || face === 'bottom') drawLogTop(ctx, [212, 204, 160], [180, 155, 110], seed);
            else {
                fillNoise(ctx, [212, 204, 160], 10, seed);
                // Black birch marks
                for (let i = 0; i < 5; i++) {
                    const sy = (rng() * 14 + 1) | 0; const sw = 2 + (rng() * 4 | 0); const sx = (rng() * 10 + 2) | 0;
                    for (let dx = 0; dx < sw; dx++) px(ctx, (sx + dx) & 15, sy, 50, 45, 40);
                }
            } return;
        case BlockType.LEAVES: drawLeaves(ctx, seed); return;
        case BlockType.PLANKS: drawPlanks(ctx, [184, 148, 95], seed); return;
        case BlockType.SPRUCE_PLANKS: drawPlanks(ctx, [107, 66, 38], seed); return;
        case BlockType.BIRCH_PLANKS: drawPlanks(ctx, [212, 200, 160], seed); return;
        case BlockType.BRICK: drawBricks(ctx, seed); return;
        case BlockType.GLASS: drawGlass(ctx, seed); return;
        case BlockType.SNOW: drawSnow(ctx, seed); return;
        case BlockType.GRAVEL: fillNoise(ctx, [120, 115, 110], 30, seed); return;
        case BlockType.CLAY: fillNoise(ctx, [158, 168, 180], 12, seed); return;
        case BlockType.WATER: drawWater(ctx, seed); return;
        case BlockType.BEDROCK: fillNoise(ctx, [55, 55, 55], 25, seed); return;
        case BlockType.OBSIDIAN: drawObsidian(ctx, seed); return;
        case BlockType.SANDSTONE: drawSandstone(ctx, face, seed); return;
        case BlockType.STONE_BRICKS: drawStoneBricks(ctx, false, seed); return;
        case BlockType.MOSSY_STONE_BRICKS: drawStoneBricks(ctx, true, seed); return;
        case BlockType.NETHERRACK: drawNetherrack(ctx, seed); return;
        case BlockType.GLOWSTONE: drawGlowstone(ctx, seed); return;
        case BlockType.TNT: drawTNT(ctx, face, seed); return;
        case BlockType.BOOKSHELF: drawBookshelf(ctx, face, seed); return;
        case BlockType.CRAFTING:
            if (face === 'top') drawCraftingTop(ctx, seed);
            else drawPlanks(ctx, [165, 120, 70], seed);
            return;
        case BlockType.FURNACE:
        case BlockType.FURNACE_ON:
            drawFurnaceSide(ctx, face === 'side', blockId === BlockType.FURNACE_ON, seed); return;
        case BlockType.CHEST: drawChest(ctx, face, seed); return;
        case BlockType.CACTUS: drawCactus(ctx, face, seed); return;
        case BlockType.MELON: drawMelon(ctx, face, seed); return;
        case BlockType.PUMPKIN: drawPumpkin(ctx, face, seed); return;
        // Ores
        case BlockType.COAL_ORE: drawOre(ctx, [35, 35, 35], seed); return;
        case BlockType.IRON_ORE: drawOre(ctx, [196, 168, 130], seed); return;
        case BlockType.GOLD_ORE: drawOre(ctx, [255, 215, 0], seed); return;
        case BlockType.DIAMOND: drawOre(ctx, [68, 255, 238], seed); return;
        case BlockType.EMERALD_ORE: drawOre(ctx, [34, 204, 68], seed); return;
        case BlockType.LAPIS_ORE: drawOre(ctx, [34, 68, 170], seed); return;
        case BlockType.REDSTONE_ORE: drawOre(ctx, [204, 34, 34], seed); return;
        // Wool
        case BlockType.WOOL_WHITE: drawWool(ctx, [232, 232, 232], seed); return;
        case BlockType.WOOL_RED: drawWool(ctx, [184, 32, 32], seed); return;
        case BlockType.WOOL_BLUE: drawWool(ctx, [32, 32, 184], seed); return;
        case BlockType.WOOL_GREEN: drawWool(ctx, [32, 184, 32], seed); return;
        case BlockType.WOOL_YELLOW: drawWool(ctx, [212, 212, 32], seed); return;
        case BlockType.WOOL_BLACK: drawWool(ctx, [34, 34, 34], seed); return;
        // Metal/gem blocks
        case BlockType.IRON_BLOCK: fillNoise(ctx, [216, 216, 216], 10, seed); return;
        case BlockType.GOLD_BLOCK: fillNoise(ctx, [255, 215, 0], 12, seed); return;
        case BlockType.DIAMOND_BLOCK: fillNoise(ctx, [68, 238, 238], 12, seed); return;
        case BlockType.EMERALD_BLOCK: fillNoise(ctx, [34, 204, 68], 12, seed); return;
        case BlockType.LAPIS_BLOCK: fillNoise(ctx, [34, 68, 170], 12, seed); return;
        // Misc
        case BlockType.HAY_BALE: fillNoise(ctx, [200, 168, 48], 15, seed);
            for (let y = 0; y < 16; y++) for (const x of [3, 7, 11]) px(ctx, x, y, 180, 145, 30);
            return;
        case BlockType.COBBLE_SLAB: drawCobble(ctx, seed); return;
        case BlockType.TORCH: fillNoise(ctx, [180, 140, 50], 20, seed);
            px(ctx, 7, 0, 255, 200, 50); px(ctx, 8, 0, 255, 200, 50); return;
        case BlockType.LADDER: fillNoise(ctx, [160, 128, 80], 15, seed);
            for (let x = 0; x < 16; x++) { px(ctx, x, 3, 130, 100, 55); px(ctx, x, 8, 130, 100, 55); px(ctx, x, 13, 130, 100, 55); }
            return;
        case BlockType.TRAPDOOR: drawPlanks(ctx, [128, 96, 48], seed); return;
        // Flowers & tall grass
        case BlockType.FLOWER_RED: fillNoise(ctx, [60, 140, 40], 20, seed);
            for (let y = 4; y < 9; y++) for (let x = 5; x < 11; x++) if (rng() < 0.6) px(ctx, x, y, 220, 40, 40); return;
        case BlockType.FLOWER_YELLOW: fillNoise(ctx, [60, 140, 40], 20, seed);
            for (let y = 4; y < 9; y++) for (let x = 5; x < 11; x++) if (rng() < 0.6) px(ctx, x, y, 240, 220, 40); return;
        case BlockType.TALL_GRASS: fillNoise(ctx, [60, 140, 40], 25, seed); return;
    }

    // Lava (if LAVA = 62 is defined)
    if (blockId === 62) { drawLava(ctx, seed); return; }

    // Generic fallback: use block color with noise
    let color = data.color;
    if (face === 'top' && data.top) color = data.top;
    if (face === 'bottom' && data.bottom) color = data.bottom;
    fillNoise(ctx, hex(color), 22, seed);
}

// ─── Texture & Material Creation ─────────────────────────

function createTexture(blockId: number, face: 'top' | 'bottom' | 'side'): THREE.CanvasTexture {
    const key = `${blockId}_${face}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const data = BLOCK_DATA[blockId];
    if (!data) return createFallbackTexture();

    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE; canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d')!;

    const seed = blockId * 1000 + (face === 'top' ? 1 : face === 'bottom' ? 2 : 3);
    drawBlockTexture(ctx, blockId, face, seed);

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
    for (let y = 0; y < TEX_SIZE; y++) for (let x = 0; x < TEX_SIZE; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#ff00ff' : '#000';
        ctx.fillRect(x, y, 1, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    return t;
}

/** Get cached material for a block face — MeshLambertMaterial for performance */
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
    const isLava = blockId === 62; // BlockType.LAVA if defined

    const mat = new THREE.MeshLambertMaterial({
        map: tex,
        transparent: data?.transparent ?? false,
        opacity: isWater ? 0.55 : isGlass ? 0.7 : isLeaf ? 0.9 : 1,
        side: data?.transparent ? THREE.DoubleSide : THREE.FrontSide,
        emissive: (isGlow || isLava) ? new THREE.Color(data?.color ?? '#eedd66') : undefined,
        emissiveIntensity: isLava ? 0.8 : isGlow ? 0.5 : 0,
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

function hexToRgb(h: string): RGB { return hex(h); }

export function getBlockIcon(blockId: number): string {
    const cached = iconCache.get(blockId);
    if (cached) return cached;

    const data = BLOCK_DATA[blockId];
    if (!data) return '';

    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const topColor = data.top ?? data.color;
    const sideColor = data.color;
    const frontColor = data.bottom ?? data.color;

    const cx = size / 2;
    const cy = size / 2;
    const s = size * 0.35;

    if (data.isItem) {
        const rgb = hex(data.color);
        ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        ctx.fillRect(size * 0.4, size * 0.1, size * 0.2, size * 0.5);
        ctx.fillStyle = '#8B6B3E';
        ctx.fillRect(size * 0.45, size * 0.5, size * 0.1, size * 0.4);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
        ctx.strokeRect(size * 0.4, size * 0.1, size * 0.2, size * 0.5);
        ctx.strokeRect(size * 0.45, size * 0.5, size * 0.1, size * 0.4);
    } else {
        // Top face
        const topRgb = hex(topColor);
        ctx.fillStyle = `rgb(${Math.min(255, topRgb[0] + 25)},${Math.min(255, topRgb[1] + 25)},${Math.min(255, topRgb[2] + 25)})`;
        ctx.beginPath();
        ctx.moveTo(cx, cy - s * 0.6); ctx.lineTo(cx + s, cy); ctx.lineTo(cx, cy + s * 0.6); ctx.lineTo(cx - s, cy);
        ctx.closePath(); ctx.fill();
        // Left face
        const sideRgb = hex(sideColor);
        ctx.fillStyle = `rgb(${(sideRgb[0] * 0.7) | 0},${(sideRgb[1] * 0.7) | 0},${(sideRgb[2] * 0.7) | 0})`;
        ctx.beginPath();
        ctx.moveTo(cx - s, cy); ctx.lineTo(cx, cy + s * 0.6); ctx.lineTo(cx, cy + s * 1.5); ctx.lineTo(cx - s, cy + s * 0.9);
        ctx.closePath(); ctx.fill();
        // Right face
        const frontRgb = hex(frontColor);
        ctx.fillStyle = `rgb(${(frontRgb[0] * 0.5) | 0},${(frontRgb[1] * 0.5) | 0},${(frontRgb[2] * 0.5) | 0})`;
        ctx.beginPath();
        ctx.moveTo(cx + s, cy); ctx.lineTo(cx, cy + s * 0.6); ctx.lineTo(cx, cy + s * 1.5); ctx.lineTo(cx + s, cy + s * 0.9);
        ctx.closePath(); ctx.fill();
        // Edges
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
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
            const oreRgb = hex(data.ore);
            ctx.fillStyle = `rgba(${oreRgb[0]},${oreRgb[1]},${oreRgb[2]},0.65)`;
            const irng = sRng(blockId * 777);
            for (let i = 0; i < 3; i++) ctx.fillRect((irng() * (size - 10) + 5) | 0, (irng() * (size - 10) + 5) | 0, 3, 3);
        }
    }

    const url = canvas.toDataURL();
    iconCache.set(blockId, url);
    return url;
}
