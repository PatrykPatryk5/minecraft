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

function drawBed(ctx: CanvasRenderingContext2D, face: string, seed: number) {
    const rng = sRng(seed);
    if (face === 'top') {
        // Red blanket
        fillNoise(ctx, [160, 30, 30], 10, seed);
        // White pillow area (top 1/4)
        for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) {
            px(ctx, x, y, 220 + (rng() * 30 | 0), 220 + (rng() * 30 | 0), 220 + (rng() * 30 | 0));
        }
    } else if (face === 'side') {
        // Wood legs/frame at bottom
        drawPlanks(ctx, [107, 84, 51], seed);
        // Blanket on top
        for (let y = 0; y < 12; y++) for (let x = 0; x < 16; x++) {
            px(ctx, x, y, 160 + (rng() * 20 | 0), 30 + (rng() * 10 | 0), 30 + (rng() * 10 | 0));
        }
    } else {
        drawPlanks(ctx, [107, 84, 51], seed);
    }
}

function drawDoor(ctx: CanvasRenderingContext2D, face: string, seed: number) {
    // Oak door style
    const rng = sRng(seed);
    const base: RGB = [107, 84, 51];
    fillNoise(ctx, base, 15, seed);

    if (face === 'side') {
        // Frame
        for (let y = 0; y < 16; y++) {
            px(ctx, 0, y, 85, 65, 40); px(ctx, 15, y, 85, 65, 40);
            px(ctx, 1, y, 90, 70, 45); px(ctx, 14, y, 90, 70, 45);
        }
        for (let x = 0; x < 16; x++) {
            px(ctx, x, 0, 85, 65, 40); px(ctx, x, 15, 85, 65, 40);
            px(ctx, x, 7, 85, 65, 40); // Middle rail
        }
        // Inner panels (darker)
        for (let y = 2; y < 7; y++) for (let x = 3; x < 13; x++) px(ctx, x, y, 70, 50, 30); // Top panel
        for (let y = 8; y < 14; y++) for (let x = 3; x < 13; x++) px(ctx, x, y, 70, 50, 30); // Bottom panel
        // Knob
        px(ctx, 12, 8, 50, 50, 50);
    }
}

function drawFence(ctx: CanvasRenderingContext2D, seed: number) {
    drawPlanks(ctx, [107, 84, 51], seed);
}

// ─── Main Texture Creation (MC-Accurate) ──────────────────

function drawBlockTexture(ctx: CanvasRenderingContext2D, blockId: number, face: 'top' | 'bottom' | 'side', seed: number): void {
    const data = BLOCK_DATA[blockId];
    if (!data) return;

    const rng = sRng(seed);

    switch (blockId) {
        case BlockType.BED: drawBed(ctx, face, seed); return;
        case BlockType.DOOR_OAK: drawDoor(ctx, face, seed); return;
        case BlockType.FENCE_OAK: drawFence(ctx, seed); return;

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
        case BlockType.LAVA: drawLava(ctx, seed); return;

        // ─── Nether & End Blocks ────────────────────────
        case BlockType.SOUL_SAND:
            fillNoise(ctx, [91, 69, 56], 18, seed);
            // Dark porous holes
            for (let i = 0; i < 12; i++) {
                const sx = (rng() * 14 + 1) | 0, sy = (rng() * 14 + 1) | 0;
                px(ctx, sx, sy, 50, 35, 25);
                if (rng() > 0.5) px(ctx, (sx + 1) & 15, sy, 55, 40, 28);
            }
            return;
        case BlockType.END_STONE:
            fillNoise(ctx, [232, 232, 170], 15, seed);
            for (let i = 0; i < 8; i++) {
                const sx = (rng() * 14 + 1) | 0, sy = (rng() * 14 + 1) | 0;
                px(ctx, sx, sy, 210, 210, 145);
            }
            return;
        case BlockType.NETHER_BRICKS:
            fillNoise(ctx, [44, 22, 26], 12, seed);
            // Brick mortar pattern
            for (let i = 0; i < 16; i++) {
                px(ctx, i, 0, 35, 15, 18); px(ctx, i, 4, 35, 15, 18);
                px(ctx, i, 8, 35, 15, 18); px(ctx, i, 12, 35, 15, 18);
            }
            for (let y = 0; y < 16; y++) {
                const off = (Math.floor(y / 4) % 2 === 0) ? 0 : 8;
                px(ctx, off, y, 35, 15, 18);
                px(ctx, (off + 8) % 16, y, 35, 15, 18);
            }
            return;
        case BlockType.CRYING_OBSIDIAN:
            drawObsidian(ctx, seed);
            // Purple glowing tears
            for (let i = 0; i < 6; i++) {
                const sx = (rng() * 14 + 1) | 0, sy = (rng() * 14 + 1) | 0;
                px(ctx, sx, sy, 120, 40, 200);
                px(ctx, sx, (sy + 1) & 15, 100, 30, 180);
                px(ctx, sx, (sy + 2) & 15, 80, 20, 160);
            }
            return;
        case BlockType.END_PORTAL_FRAME:
            if (face === 'top') {
                fillNoise(ctx, [26, 74, 74], 12, seed);
                // Eye socket
                for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) {
                    px(ctx, x, y, 15, 50, 50);
                }
                px(ctx, 7, 7, 10, 180, 180); px(ctx, 8, 7, 10, 180, 180);
                px(ctx, 7, 8, 10, 180, 180); px(ctx, 8, 8, 10, 180, 180);
            } else {
                fillNoise(ctx, [59, 107, 75], 15, seed);
                // Side decorative pattern
                for (let x = 0; x < 16; x++) px(ctx, x, 0, 45, 88, 58);
                for (let x = 0; x < 16; x++) px(ctx, x, 15, 45, 88, 58);
            }
            return;
        case BlockType.DRAGON_EGG:
            fillNoise(ctx, [13, 0, 22], 8, seed);
            // Purple sparkle highlights
            for (let i = 0; i < 4; i++) {
                const sx = (rng() * 14 + 1) | 0, sy = (rng() * 14 + 1) | 0;
                px(ctx, sx, sy, 60, 10, 100);
            }
            return;
        case BlockType.NETHER_PORTAL_BLOCK:
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
                const v = rng() * 40 - 20;
                const swirl = Math.sin(x * 0.5 + y * 0.3) * 30;
                px(ctx, x, y, 100 + v + swirl, 0, 160 + v + swirl * 0.5);
            }
            return;
        case BlockType.END_PORTAL_BLOCK:
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
                const starfield = rng() < 0.1;
                if (starfield) px(ctx, x, y, 100 + (rng() * 155 | 0), 180 + (rng() * 75 | 0), 200 + (rng() * 55 | 0));
                else px(ctx, x, y, 0, 8 + (rng() * 15 | 0), 20 + (rng() * 15 | 0));
            }
            return;

        // ─── Redstone Devices ───────────────────────────
        case BlockType.LEVER:
            fillNoise(ctx, [130, 130, 130], 15, seed);
            // Lever handle
            for (let y = 3; y < 12; y++) { px(ctx, 7, y, 90, 70, 45); px(ctx, 8, y, 90, 70, 45); }
            // Base plate
            for (let x = 4; x < 12; x++) { px(ctx, x, 12, 85, 85, 85); px(ctx, x, 13, 80, 80, 80); }
            return;
        case BlockType.REDSTONE_TORCH:
            fillNoise(ctx, [20, 20, 20], 5, seed);
            // Torch stick
            for (let y = 4; y < 14; y++) { px(ctx, 7, y, 90, 70, 45); px(ctx, 8, y, 85, 65, 40); }
            // Red glowing top
            for (let y = 2; y < 5; y++) for (let x = 6; x < 10; x++) {
                px(ctx, x, y, 200 + (rng() * 55 | 0), 20, 10);
            }
            return;
        case BlockType.REDSTONE_LAMP:
            if (face === 'top' || face === 'bottom') {
                fillNoise(ctx, [100, 70, 40], 15, seed);
                for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) {
                    px(ctx, x, y, 180 + (rng() * 40 | 0), 120 + (rng() * 30 | 0), 50);
                }
            } else {
                fillNoise(ctx, [100, 70, 40], 15, seed);
                // Glowing panels
                for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) {
                    if ((x === 2 || x === 13 || y === 2 || y === 13)) continue;
                    px(ctx, x, y, 170 + (rng() * 50 | 0), 110 + (rng() * 30 | 0), 40);
                }
            }
            return;
        case BlockType.REDSTONE_WIRE:
            fillNoise(ctx, [55, 55, 55], 8, seed);
            // Red wire cross pattern
            for (let i = 0; i < 16; i++) {
                px(ctx, 7, i, 200, 0, 0); px(ctx, 8, i, 200, 0, 0);
                px(ctx, i, 7, 200, 0, 0); px(ctx, i, 8, 200, 0, 0);
            }
            return;

        // ─── Advanced Blocks ────────────────────────────
        case BlockType.PISTON:
            if (face === 'top') {
                fillNoise(ctx, [153, 136, 119], 12, seed);
                // Metal plate
                for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) {
                    px(ctx, x, y, 140 + (rng() * 15 | 0), 125 + (rng() * 12 | 0), 100 + (rng() * 10 | 0));
                }
            } else {
                fillNoise(ctx, [139, 115, 85], 15, seed);
                // Side grooves
                for (let y = 0; y < 16; y++) { px(ctx, 0, y, 110, 90, 65); px(ctx, 15, y, 110, 90, 65); }
            }
            return;
        case BlockType.PISTON_STICKY:
            if (face === 'top') {
                fillNoise(ctx, [102, 170, 68], 15, seed);
                // Slime center
                for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) {
                    px(ctx, x, y, 85 + (rng() * 25 | 0), 160 + (rng() * 25 | 0), 50 + (rng() * 15 | 0));
                }
            } else {
                fillNoise(ctx, [139, 115, 85], 15, seed);
                for (let y = 0; y < 16; y++) { px(ctx, 0, y, 110, 90, 65); px(ctx, 15, y, 110, 90, 65); }
            }
            return;
        case BlockType.PISTON_HEAD:
            if (face === 'top') {
                fillNoise(ctx, [153, 136, 119], 12, seed);
                // Metal plate
                for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) {
                    px(ctx, x, y, 140 + (rng() * 15 | 0), 125 + (rng() * 12 | 0), 100 + (rng() * 10 | 0));
                }
            } else {
                // Arm shaft
                fillNoise(ctx, [100, 80, 60], 10, seed);
                for (let y = 0; y < 16; y++) { px(ctx, 4, y, 80, 60, 40); px(ctx, 11, y, 80, 60, 40); }
            }
            return;
        case BlockType.JUKEBOX:
            drawPlanks(ctx, [107, 66, 38], seed);
            if (face === 'top') {
                // Record slot
                for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) {
                    const dist = Math.sqrt((x - 8) ** 2 + (y - 8) ** 2);
                    if (dist < 3.5) px(ctx, x, y, 30, 30, 30);
                }
                px(ctx, 7, 7, 15, 15, 15); px(ctx, 8, 7, 15, 15, 15);
            }
            return;
        case BlockType.SPONGE:
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
                const v = rng() * 30 - 15;
                const hole = rng() < 0.2;
                if (hole) px(ctx, x, y, 160 + v, 155 + v, 60 + v);
                else px(ctx, x, y, 194 + v, 183 + v, 78 + v);
            }
            return;
        case BlockType.ENCHANTING_TABLE:
            if (face === 'top') {
                fillNoise(ctx, [43, 0, 0], 8, seed);
                // Open book
                for (let y = 3; y < 13; y++) for (let x = 2; x < 14; x++) {
                    px(ctx, x, y, 180 + (rng() * 30 | 0), 160 + (rng() * 20 | 0), 120 + (rng() * 15 | 0));
                }
                // Glyphs
                for (let i = 0; i < 8; i++) {
                    const sx = (rng() * 10 + 3) | 0, sy = (rng() * 8 + 4) | 0;
                    px(ctx, sx, sy, 40, 30, 80);
                }
            } else {
                drawObsidian(ctx, seed);
                // Diamond decorations
                for (let x = 4; x < 12; x++) px(ctx, x, 7, 68, 238, 238);
                for (let x = 4; x < 12; x++) px(ctx, x, 8, 58, 218, 218);
            }
            return;
        case BlockType.ENDER_CHEST:
            drawChest(ctx, face, seed + 5000);
            // Replace colors with dark End theme
            if (face === 'side') {
                for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
                    const v = rng() * 12 - 6;
                    px(ctx, x, y, 13 + v, 17 + v, 23 + v);
                }
                // Green latch
                px(ctx, 7, 6, 20, 180, 120); px(ctx, 8, 6, 20, 180, 120);
                px(ctx, 7, 7, 15, 160, 100); px(ctx, 8, 7, 15, 160, 100);
                for (let x = 0; x < 16; x++) px(ctx, x, 8, 10, 14, 20);
            } else {
                fillNoise(ctx, [13, 17, 23], 8, seed);
                for (let i = 0; i < 16; i++) {
                    px(ctx, i, 0, 8, 11, 16); px(ctx, i, 15, 8, 11, 16);
                    px(ctx, 0, i, 8, 11, 16); px(ctx, 15, i, 8, 11, 16);
                }
            }
            return;
        case BlockType.ANVIL:
            if (face === 'top') {
                fillNoise(ctx, [68, 68, 68], 10, seed);
                // T-shape anvil top
                for (let y = 2; y < 14; y++) for (let x = 4; x < 12; x++) {
                    px(ctx, x, y, 85 + (rng() * 10 | 0), 85 + (rng() * 10 | 0), 85 + (rng() * 10 | 0));
                }
            } else {
                fillNoise(ctx, [55, 55, 55], 12, seed);
                // Anvil profile
                for (let x = 2; x < 14; x++) {
                    px(ctx, x, 0, 80, 80, 80); px(ctx, x, 1, 75, 75, 75);
                }
                for (let x = 5; x < 11; x++) for (let y = 2; y < 12; y++) {
                    px(ctx, x, y, 60 + (rng() * 10 | 0), 60 + (rng() * 10 | 0), 60 + (rng() * 10 | 0));
                }
                for (let x = 1; x < 15; x++) {
                    px(ctx, x, 13, 75, 75, 75); px(ctx, x, 14, 80, 80, 80); px(ctx, x, 15, 85, 85, 85);
                }
            }
            return;
        case BlockType.BEACON:
            if (face === 'top') {
                fillNoise(ctx, [122, 233, 233], 10, seed);
                // Light beam center
                for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) {
                    px(ctx, x, y, 200 + (rng() * 55 | 0), 240 + (rng() * 15 | 0), 255);
                }
            } else {
                fillNoise(ctx, [70, 180, 180], 12, seed);
                // Glass-like obsidian frame
                for (let i = 0; i < 16; i++) {
                    px(ctx, i, 0, 30, 15, 45); px(ctx, i, 15, 30, 15, 45);
                    px(ctx, 0, i, 30, 15, 45); px(ctx, 15, i, 30, 15, 45);
                }
                // Inner glow
                for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) {
                    px(ctx, x, y, 140 + (rng() * 60 | 0), 230 + (rng() * 25 | 0), 255);
                }
            }
            return;
        case BlockType.NOTEBLOCK:
            drawPlanks(ctx, [107, 66, 38], seed);
            if (face === 'top') {
                // Note symbol
                px(ctx, 8, 4, 50, 40, 30); px(ctx, 9, 4, 50, 40, 30);
                for (let y = 5; y < 10; y++) px(ctx, 9, y, 50, 40, 30);
                for (let y = 9; y < 12; y++) for (let x = 6; x < 10; x++) {
                    const dist = Math.sqrt((x - 7.5) ** 2 + (y - 10.5) ** 2);
                    if (dist < 2) px(ctx, x, y, 45, 35, 25);
                }
            }
            return;
    }

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
    const isLava = blockId === BlockType.LAVA;
    const isEmissive = data?.emissive || blockId === BlockType.GLOWSTONE || blockId === BlockType.TORCH || isLava;

    const mat = new THREE.MeshLambertMaterial({
        map: tex,
        transparent: data?.transparent ?? false,
        opacity: isWater ? 0.55 : isGlass ? 0.7 : isLeaf ? 0.9 : 1,
        side: data?.transparent ? THREE.DoubleSide : THREE.FrontSide,
        emissive: isEmissive ? new THREE.Color(data?.color ?? '#eedd66') : undefined,
        emissiveIntensity: isLava ? 0.8 : isEmissive ? 0.5 : 0,
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

// ─── 3D Textured Isometric Block Icon ────────────────────
const iconCache = new Map<number, string>();

export function getBlockIcon(blockId: number): string {
    const cached = iconCache.get(blockId);
    if (cached) return cached;

    const data = BLOCK_DATA[blockId];
    if (!data) return '';

    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    if (data.isItem) {
        // Item rendering: sword/tool shape
        const rgb = hex(data.color);
        const grd = ctx.createLinearGradient(size * 0.4, 0, size * 0.6, size);
        grd.addColorStop(0, `rgb(${Math.min(255, rgb[0] + 50)},${Math.min(255, rgb[1] + 50)},${Math.min(255, rgb[2] + 50)})`);
        grd.addColorStop(1, `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`);
        ctx.fillStyle = grd;
        // Blade
        ctx.beginPath();
        ctx.moveTo(size * 0.42, size * 0.05);
        ctx.lineTo(size * 0.58, size * 0.05);
        ctx.lineTo(size * 0.56, size * 0.5);
        ctx.lineTo(size * 0.44, size * 0.5);
        ctx.closePath(); ctx.fill();
        // Guard
        ctx.fillStyle = '#888';
        ctx.fillRect(size * 0.35, size * 0.48, size * 0.3, size * 0.06);
        // Handle
        ctx.fillStyle = '#8B6B3E';
        ctx.fillRect(size * 0.44, size * 0.54, size * 0.12, size * 0.35);
        // Outline
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
        ctx.strokeRect(size * 0.42, size * 0.05, size * 0.16, size * 0.45);
    } else {
        // Create mini 16x16 textures for each face
        const topTex = document.createElement('canvas');
        topTex.width = TEX_SIZE; topTex.height = TEX_SIZE;
        const topCtx = topTex.getContext('2d')!;
        const topSeed = blockId * 1000 + 1;
        drawBlockTexture(topCtx, blockId, 'top', topSeed);

        const sideTex = document.createElement('canvas');
        sideTex.width = TEX_SIZE; sideTex.height = TEX_SIZE;
        const sideCtx = sideTex.getContext('2d')!;
        const sideSeed = blockId * 1000 + 3;
        drawBlockTexture(sideCtx, blockId, 'side', sideSeed);

        const topImgData = topCtx.getImageData(0, 0, TEX_SIZE, TEX_SIZE);
        const sideImgData = sideCtx.getImageData(0, 0, TEX_SIZE, TEX_SIZE);

        const cX = size / 2;
        const cY = size / 2 - 2;
        const sc = size * 0.38;
        const halfH = sc * 0.55;

        // Draw top face (isometric projection with pixel sampling)
        for (let ty = 0; ty < TEX_SIZE; ty++) {
            for (let tx = 0; tx < TEX_SIZE; tx++) {
                const idx = (ty * TEX_SIZE + tx) * 4;
                const r = topImgData.data[idx], g = topImgData.data[idx + 1], b = topImgData.data[idx + 2];
                // Brighten top face
                const u = tx / TEX_SIZE, v = ty / TEX_SIZE;
                const px2 = cX + (u - 0.5) * sc + (v - 0.5) * (-sc);
                const py2 = cY + (u - 0.5) * halfH + (v - 0.5) * halfH - halfH;
                ctx.fillStyle = `rgb(${Math.min(255, r + 30)},${Math.min(255, g + 30)},${Math.min(255, b + 30)})`;
                ctx.fillRect(px2 | 0, py2 | 0, 2, 2);
            }
        }

        // Draw left face
        for (let ty = 0; ty < TEX_SIZE; ty++) {
            for (let tx = 0; tx < TEX_SIZE; tx++) {
                const idx = (ty * TEX_SIZE + tx) * 4;
                const r = sideImgData.data[idx], g = sideImgData.data[idx + 1], b = sideImgData.data[idx + 2];
                const u = tx / TEX_SIZE, v = ty / TEX_SIZE;
                const px2 = cX + (u - 1) * sc;
                const py2 = cY + u * halfH + v * sc * 0.9 - halfH * 0.1;
                ctx.fillStyle = `rgb(${(r * 0.7) | 0},${(g * 0.7) | 0},${(b * 0.7) | 0})`;
                ctx.fillRect(px2 | 0, py2 | 0, 2, 2);
            }
        }

        // Draw right face
        for (let ty = 0; ty < TEX_SIZE; ty++) {
            for (let tx = 0; tx < TEX_SIZE; tx++) {
                const idx = (ty * TEX_SIZE + tx) * 4;
                const r = sideImgData.data[idx], g = sideImgData.data[idx + 1], b = sideImgData.data[idx + 2];
                const u = tx / TEX_SIZE, v = ty / TEX_SIZE;
                const px2 = cX + u * sc;
                const py2 = cY - u * halfH + halfH + v * sc * 0.9 - halfH * 0.1;
                ctx.fillStyle = `rgb(${(r * 0.5) | 0},${(g * 0.5) | 0},${(b * 0.5) | 0})`;
                ctx.fillRect(px2 | 0, py2 | 0, 2, 2);
            }
        }

        // Emissive glow overlay
        if (data.emissive) {
            const rgb2 = hex(data.color);
            ctx.globalCompositeOperation = 'screen';
            const glow = ctx.createRadialGradient(cX, cY + 5, 0, cX, cY + 5, sc * 1.2);
            glow.addColorStop(0, `rgba(${rgb2[0]},${rgb2[1]},${rgb2[2]},0.4)`);
            glow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, size, size);
            ctx.globalCompositeOperation = 'source-over';
        }

        // Subtle edge highlight
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cX, cY - halfH);
        ctx.lineTo(cX + sc, cY);
        ctx.lineTo(cX, cY + halfH);
        ctx.lineTo(cX - sc, cY);
        ctx.closePath();
        ctx.stroke();
    }

    const url = canvas.toDataURL();
    iconCache.set(blockId, url);
    return url;
}
