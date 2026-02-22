/**
 * Texture & Material System — Minecraft-Accurate Procedural Textures
 *
 * Generates pixel-accurate 16×16 textures that closely replicate real Minecraft.
 * Uses MeshLambertMaterial for maximum GPU performance.
 * All textures are cached; materials are shared to minimize draw calls.
 */

import * as THREE from 'three';
import seedrandom from 'seedrandom';
import { BLOCK_DATA, BlockType } from './blockTypes';

const TEX_SIZE = 16;
const cache = new Map<string, THREE.CanvasTexture>();
const materialCache = new Map<string, THREE.MeshStandardMaterial>();

// ─── Deterministic RNG ───────────────────────────────────
function sRng(seed: number): () => number {
    return seedrandom(seed.toString());
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
    // Stone base with subtle gray variation
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = (rng() - 0.5) * 20;
        px(ctx, x, y, base[0] + v, base[1] + v, base[2] + v);
    }
    // High-frequency craggy noise
    for (let i = 0; i < 60; i++) {
        const sx = (rng() * 16) | 0, sy = (rng() * 16) | 0;
        const v = (rng() - 0.5) * 40;
        px(ctx, sx, sy, base[0] + v, base[1] + v, base[2] + v);
    }
    // Craggy detail lines
    for (let i = 0; i < 10; i++) {
        let cx = (rng() * 16) | 0, cy = (rng() * 16) | 0;
        const len = 2 + (rng() * 3 | 0);
        const color = rng() > 0.5 ? 90 : 140; // dark cracks or light highlights
        for (let j = 0; j < len; j++) {
            px(ctx, cx & 15, cy & 15, color, color, color);
            cx += rng() > 0.5 ? 1 : 0;
            cy += rng() > 0.5 ? 1 : 0;
        }
    }
}



function drawCobble(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    // Dark mortar base
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(ctx, x, y, 70, 70, 70);
    // Draw 8-10 random stone clumps
    for (let i = 0; i < 10; i++) {
        const sx = (rng() * 12 + 1) | 0, sy = (rng() * 12 + 1) | 0;
        const sw = 2 + (rng() * 3 | 0);
        const sh = 2 + (rng() * 3 | 0);
        const base = 100 + (rng() * 40 | 0);
        for (let dy = 0; dy < sh; dy++) {
            for (let dx = 0; dx < sw; dx++) {
                if (((dx === 0 || dx === sw - 1) && (dy === 0 || dy === sh - 1)) && rng() < 0.5) continue;
                const v = base + (rng() * 20 - 10);
                px(ctx, (sx + dx) & 15, (sy + dy) & 15, v, v, v);
            }
        }
    }
    // Extra details
    fillNoise(ctx, [110, 110, 110], 15, seed + 1);
    drawInnerEdge(ctx, [80, 80, 80]);
}

function drawDirt(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    const base: RGB = [134, 96, 67];
    fillNoise(ctx, base, 15, seed);

    // High-frequency detail noise (pebbles and dirt clumps)
    for (let i = 0; i < 30; i++) {
        const sx = (rng() * 16) | 0, sy = (rng() * 16) | 0;
        const v = rng() * 30 - 15;
        px(ctx, sx, sy, base[0] + v, base[1] + v * 0.8, base[2] + v * 0.6);
    }
    // Real pebbles
    for (let i = 0; i < 5; i++) {
        const sx = (rng() * 14 + 1) | 0, sy = (rng() * 14 + 1) | 0;
        px(ctx, sx, sy, 100, 80, 60);
    }
}

function drawStoneBricks(ctx: CanvasRenderingContext2D, mossy: boolean, seed: number, overlay = false) {
    const rng = sRng(seed);
    const base: RGB = [120, 120, 120];
    if (!overlay) fillNoise(ctx, base, 10, seed);

    // Mortar lines - use specific colors to ensure visibility
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.strokeRect(0, 0, 16, 16);
    ctx.moveTo(0, 8); ctx.lineTo(16, 8);
    ctx.moveTo(8, 0); ctx.lineTo(8, 8);
    ctx.moveTo(4, 8); ctx.lineTo(4, 16);
    ctx.moveTo(12, 8); ctx.lineTo(12, 16);
    ctx.stroke();

    if (mossy) {
        for (let i = 0; i < 15; i++) {
            const sx = (rng() * 16) | 0, sy = (rng() * 16) | 0;
            px(ctx, sx, sy, 50 + (rng() * 20 | 0), 80 + (rng() * 20 | 0), 40);
        }
    }
}

function drawGrassSide(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    // Explicitly fill before calling drawDirt to ensure no transparent corners
    ctx.fillStyle = '#8B6B3E';
    ctx.fillRect(0, 0, 16, 16);
    // Dirt base
    drawDirt(ctx, seed);
    // Green top edge with grass hanging down
    for (let x = 0; x < 16; x++) {
        const g: RGB = [85 + (rng() * 20 | 0), 150 + (rng() * 30 | 0), 35 + (rng() * 15 | 0)];
        const h = 3 + (rng() * 4 | 0);
        for (let dy = 0; dy <= h; dy++) {
            const v = (1.0 - dy / 8) + (rng() * 0.1);
            px(ctx, x, dy, g[0] * v, g[1] * v, g[2] * v);
        }
    }
}

function drawGrassTop(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    // 1. Solid base - use a slightly more vibrant green
    ctx.fillStyle = '#71bc4c';
    ctx.fillRect(0, 0, 16, 16);

    // 2. Soft tonal variation (strictly NO near-black pixels)
    // The previous implementation might have had issues with rounding or range
    for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
            const v = (rng() * 20 - 10);
            // Ensure R, G, B are always in healthy green ranges
            const r = Math.max(100, Math.min(130, Math.round(115 + v * 0.4)));
            const g = Math.max(160, Math.min(200, Math.round(180 + v)));
            const b = Math.max(40, Math.min(70, Math.round(55 + v * 0.3)));
            px(ctx, x, y, r, g, b);
        }
    }

    // 3. Add brighter micro-flecks (highlights)
    for (let i = 0; i < 35; i++) {
        const sx = (rng() * 16) | 0;
        const sy = (rng() * 16) | 0;
        const boost = 5 + ((rng() * 15) | 0);
        const r = 120 + ((rng() * 10) | 0);
        const g = Math.min(215, 185 + boost);
        const b = 50 + ((rng() * 10) | 0);
        px(ctx, sx, sy, r, g, b);
    }

    // 4. Stabilize border/corners with explicit colors
    // This helps with mipmapping and texture filtration artifacts
    ctx.strokeStyle = '#7cbd52';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, 15, 15);
}

function drawSand(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = rng() * 26 - 13; // Increased variance
        px(ctx, x, y, 219 + v, 206 + v * 0.9, 163 + v * 0.6);
    }
    // Small dark grains
    for (let i = 0; i < 30; i++) {
        const sx = (rng() * 16) | 0, sy = (rng() * 16) | 0;
        px(ctx, sx, sy, 190, 175, 130);
    }
}

function drawGranite(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    const base: RGB = [178, 116, 100]; // Pinkish red
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = (rng() - 0.5) * 40;
        px(ctx, x, y, base[0] + v, base[1] + v, base[2] + v);
    }
    // Dark spots
    for (let i = 0; i < 30; i++) {
        px(ctx, (rng() * 16) | 0, (rng() * 16) | 0, 120, 80, 70);
    }
}

function drawDiorite(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    const base: RGB = [207, 207, 207]; // Light gray
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = (rng() - 0.5) * 30;
        px(ctx, x, y, base[0] + v, base[1] + v, base[2] + v);
    }
    // Large dark "bird poop" splotches
    for (let i = 0; i < 20; i++) {
        const sx = (rng() * 15) | 0, sy = (rng() * 15) | 0;
        px(ctx, sx, sy, 80, 80, 80);
        if (rng() > 0.5) px(ctx, sx + 1, sy, 80, 80, 80);
    }
}

function drawAndesite(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    const base: RGB = [139, 139, 139]; // Mid gray
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = (rng() - 0.5) * 20;
        px(ctx, x, y, base[0] + v, base[1] + v, base[2] + v);
    }
    // Smooth grain
    for (let i = 0; i < 40; i++) {
        px(ctx, (rng() * 16) | 0, (rng() * 16) | 0, 110, 110, 110);
    }
}

function drawDeepslate(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    const base: RGB = [77, 77, 80];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = (rng() - 0.5) * 15;
        px(ctx, x, y, base[0] + v, base[1] + v, base[2] + v);
    }
    // Deepslate horizontal grain
    for (let y = 0; y < 16; y += 2) {
        const dark = rng() > 0.5;
        for (let x = 0; x < 16; x++) {
            if (rng() > 0.2) {
                const c = dark ? 60 : 85;
                px(ctx, x, y, c, c, c + 5);
            }
        }
    }
}

function drawBasalt(ctx: CanvasRenderingContext2D, seed: number, isTop: boolean) {
    const rng = sRng(seed);
    if (isTop) {
        const base: RGB = [63, 63, 64];
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const v = (rng() - 0.5) * 10;
            px(ctx, x, y, base[0] + v, base[1] + v, base[2] + v);
        }
        // Rings/circular noise
        for (let i = 0; i < 4; i++) {
            const rad = 2 + i * 2;
            for (let a = 0; a < Math.PI * 2; a += 0.2) {
                const px_x = (8 + Math.cos(a) * rad) | 0;
                const px_y = (8 + Math.sin(a) * rad) | 0;
                if (px_x >= 0 && px_x < 16 && px_y >= 0 && px_y < 16) {
                    px(ctx, px_x, px_y, 50, 50, 51);
                }
            }
        }
    } else {
        const base: RGB = [80, 81, 81];
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const v = (rng() - 0.5) * 15;
            px(ctx, x, y, base[0] + v, base[1] + v, base[2] + v);
        }
        // Vertical pillar lines
        for (let x = 0; x < 16; x += 4) {
            for (let y = 0; y < 16; y++) px(ctx, x, y, 60, 60, 61);
        }
    }
}

function drawBlackstone(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    const base: RGB = [39, 34, 35];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = (rng() - 0.5) * 20;
        px(ctx, x, y, base[0] + v, base[1] + v, base[2] + v);
    }
    // Rough gold/pyrite specks (subtle)
    for (let i = 0; i < 5; i++) {
        px(ctx, (rng() * 16) | 0, (rng() * 16) | 0, 80, 70, 40);
    }
}

function drawAmethyst(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    const base: RGB = [154, 92, 198];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = (rng() - 0.5) * 30;
        px(ctx, x, y, base[0] + v, base[1] + v, base[2] + v);
    }
    // Crystal highlights
    for (let i = 0; i < 15; i++) {
        const sx = (rng() * 16) | 0, sy = (rng() * 16) | 0;
        px(ctx, sx, sy, 200, 150, 255);
    }
}

function drawCopper(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    const base: RGB = [209, 114, 91];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = (rng() - 0.5) * 20;
        px(ctx, x, y, base[0] + v, base[1] + v, base[2] + v);
    }
    // Subtle oxide spots (cyan)
    for (let i = 0; i < 5; i++) {
        px(ctx, (rng() * 16) | 0, (rng() * 16) | 0, 78, 175, 147);
    }
}

function drawRawOre(ctx: CanvasRenderingContext2D, color: RGB, seed: number) {
    const rng = sRng(seed);
    // Rough "lumpy" texture
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const dist = Math.sqrt((x - 8) ** 2 + (y - 8) ** 2);
        if (dist < 6 + rng() * 2) {
            const v = (rng() - 0.5) * 40;
            px(ctx, x, y, color[0] + v, color[1] + v, color[2] + v);
        }
    }
}

function drawOakLogSide(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    const bark: RGB = [107, 84, 51];
    for (let y = 0; y < 16; y++) {
        const stripe = y % 4 === 0 ? -15 : 0;
        for (let x = 0; x < 16; x++) {
            const v = rng() * 25 - 12 + stripe; // Increased variance
            px(ctx, x, y, bark[0] + v, bark[1] + v * 0.8, bark[2] + v * 0.5);
        }
    }
    // Vertical bark lines (more pronounced)
    for (let x = 0; x < 16; x += 2 + (rng() * 2 | 0)) {
        for (let y = 0; y < 16; y++) if (rng() < 0.4) px(ctx, x, y, 75, 55, 30); // Darker furrows
        for (let y = 0; y < 16; y++) if (rng() < 0.2) px(ctx, x + 1, y, 125, 100, 65); // Lighter edges
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
        const v = (rng() - 0.5) * 15;
        px(ctx, x, y, base[0] + v, base[1] + v * 0.9, base[2] + v * 0.7);
    }
    // Grain pattern
    for (let y = 0; y < 16; y++) {
        for (let i = 0; i < 3; i++) {
            const gx = (rng() * 16) | 0;
            const c = darken(base, 0.85);
            px(ctx, gx, y, c[0], c[1], c[2]);
        }
    }
    // Horizontal separators
    for (const py of [0, 15]) {
        for (let x = 0; x < 16; x++) px(ctx, x, py, base[0] - 30, base[1] - 25, base[2] - 20);
    }
    // Vertical seams
    for (let y = 0; y < 16; y++) {
        if (y % 4 === 0) {
            const jx = (y % 8 === 0) ? 4 : 12;
            px(ctx, jx, y, base[0] - 25, base[1] - 20, base[2] - 15);
            px(ctx, jx, y + 1, base[0] - 25, base[1] - 20, base[2] - 15);
            px(ctx, jx, y + 2, base[0] - 25, base[1] - 20, base[2] - 15);
            px(ctx, jx, y + 3, base[0] - 25, base[1] - 20, base[2] - 15);
        }
    }
}

function drawLeaves(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (rng() < 0.05) continue; // transparent gaps (no px drawn) - made less transparent
        const v = rng() * 40 - 20;
        px(ctx, x, y, 45 + v * 0.5, 120 + v, 25 + v * 0.3);
    }
}

function drawOreOverlay(ctx: CanvasRenderingContext2D, oreColor: RGB, seed: number) {
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
    drawInnerEdge(ctx, [100, 30, 25]);
}

function drawGlass(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    // Border frame (lighter edge)
    for (let i = 0; i < 16; i++) {
        px(ctx, i, 0, 180, 210, 235); px(ctx, i, 15, 180, 210, 235);
        px(ctx, 0, i, 180, 210, 235); px(ctx, 15, i, 180, 210, 235);
    }
    // Highlight corner reflection
    px(ctx, 1, 1, 245, 250, 255); px(ctx, 2, 1, 240, 248, 255); px(ctx, 1, 2, 240, 248, 255);
    // A couple streaks
    px(ctx, 3, 3, 220, 230, 245); px(ctx, 4, 3, 220, 230, 245);
    px(ctx, 12, 12, 220, 230, 245); px(ctx, 12, 11, 220, 230, 245);
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
    const base: RGB = [190, 140, 80];
    fillNoise(ctx, base, 10, seed);

    // 3x3 grid (dark lines)
    ctx.fillStyle = '#8B6B3E';
    for (const line of [4, 5, 10, 11]) {
        ctx.fillRect(0, line, 16, 1);
        ctx.fillRect(line, 0, 1, 16);
    }

    // Outer border
    ctx.strokeStyle = '#5c4120';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 16, 16);

    // Corners
    ctx.fillStyle = '#634725';
    ctx.fillRect(0, 0, 2, 2); ctx.fillRect(14, 0, 2, 2);
    ctx.fillRect(0, 14, 2, 2); ctx.fillRect(14, 14, 2, 2);
}

function drawCraftingSide(ctx: CanvasRenderingContext2D, face: string, seed: number) {
    drawPlanks(ctx, [165, 120, 70], seed);

    // Top border connecting to the generic plank texture
    for (let x = 0; x < 16; x++) px(ctx, x, 0, 190, 140, 80);

    // Add tools depending on face
    if (face === 'front' || face === 'left') {
        // Saw
        ctx.fillStyle = '#aaaaaa'; ctx.fillRect(4, 5, 8, 2);
        ctx.fillStyle = '#664422'; ctx.fillRect(12, 5, 2, 3);
        px(ctx, 4, 7, 170, 170, 170); px(ctx, 6, 7, 170, 170, 170); px(ctx, 8, 7, 170, 170, 170);
    } else {
        // Scissors / Hammer
        ctx.fillStyle = '#aaaaaa'; ctx.fillRect(6, 4, 3, 4);
        ctx.fillStyle = '#664422'; ctx.fillRect(7, 8, 1, 5);
        ctx.fillStyle = '#444'; ctx.fillRect(5, 3, 5, 2);
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
    if (face === 'front') {
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

function drawBed(ctx: CanvasRenderingContext2D, face: string, seed: number, isHead = false) {
    const rng = sRng(seed);
    if (face === 'top') {
        if (isHead) {
            // White pillow area
            fillNoise(ctx, [230, 230, 230], 10, seed);
            // Indentation
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(2, 4, 12, 8);
        } else {
            // Red blanket
            fillNoise(ctx, [160, 30, 30], 10, seed);
            // Blanket fold
            for (let x = 0; x < 16; x++) px(ctx, x, 0, 140, 25, 25);
        }
    } else if (face !== 'bottom') {
        // Side view: White top, Red middle, Wood legs/frame bottom
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                if (y < 4 && isHead) { // Pillow side
                    px(ctx, x, y, 220, 220, 220);
                } else if (y < 10) { // Blanket
                    px(ctx, x, y, 150, 30, 30);
                } else { // Wood
                    const c = vary([107, 84, 51], 10, rng);
                    px(ctx, x, y, c[0], c[1], c[2]);
                }
            }
        }
        // Legs
        if (face === 'left' || face === 'right') {
            const lx = isHead ? 2 : 12;
            ctx.fillStyle = '#4a3822';
            ctx.fillRect(lx, 12, 2, 4);
        }
    } else {
        drawPlanks(ctx, [107, 84, 51], seed);
    }
}

function drawLapisBlock(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    fillNoise(ctx, [34, 68, 170], 15, seed);
    // Darker corner squares
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, 0, 3, 3); ctx.fillRect(13, 0, 3, 3);
    ctx.fillRect(0, 13, 3, 3); ctx.fillRect(13, 13, 3, 3);
    drawInnerEdge(ctx, [25, 50, 130]);
}

function drawRedstoneBlock(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    const base: RGB = [180, 20, 20];
    fillNoise(ctx, base, 35, seed);
    // Glowing particles
    for (let i = 0; i < 20; i++) {
        const sx = (rng() * 16) | 0, sy = (rng() * 16) | 0;
        const c = vary([255, 60, 60], 40, rng);
        px(ctx, sx, sy, c[0], c[1], c[2]);
    }
    drawInnerEdge(ctx, [140, 10, 10]);
}

function drawInnerEdge(ctx: CanvasRenderingContext2D, color: RGB) {
    ctx.strokeStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, 15, 15);
}

function drawDoor(ctx: CanvasRenderingContext2D, face: string, seed: number) {
    // Oak door style
    const rng = sRng(seed);
    const base: RGB = [107, 84, 51];
    fillNoise(ctx, base, 15, seed);

    if (face !== 'top' && face !== 'bottom') {
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

function drawAncientDebris(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    fillNoise(ctx, [77, 59, 59], 20, seed);
    // Swirl pattern
    for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = `rgba(100, 80, 80, ${0.4 + rng() * 0.4})`;
        ctx.strokeRect(i * 1.5, i * 1.5, 16 - i * 3, 16 - i * 3);
    }
}

function drawLantern(ctx: CanvasRenderingContext2D, soul: boolean, seed: number) {
    const rng = sRng(seed);
    ctx.fillStyle = '#444444'; // Frame
    ctx.fillRect(0, 0, 16, 16);
    // Glass/Light center
    const light: RGB = soul ? [0, 204, 255] : [255, 204, 0];
    ctx.fillStyle = `rgb(${light[0]},${light[1]},${light[2]})`;
    ctx.fillRect(4, 4, 8, 10);
    // Frame details
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, 16, 2); ctx.fillRect(0, 14, 16, 2);
    ctx.fillRect(0, 0, 2, 16); ctx.fillRect(14, 0, 16, 16);
}

function drawCake(ctx: CanvasRenderingContext2D, face: string, seed: number) {
    if (face === 'top') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 16, 16);
        // Red spots
        for (let i = 0; i < 6; i++) {
            px(ctx, (sRng(seed + i)() * 14 + 1) | 0, (sRng(seed + i + 10)() * 14 + 1) | 0, 204, 34, 34);
        }
    } else if (face === 'bottom') {
        fillNoise(ctx, [139, 115, 85], 10, seed);
    } else {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 16, 8); // Icing
        fillNoise(ctx, [139, 115, 85], 12, seed + 1); // Bread
        ctx.fillRect(0, 8, 16, 8);
    }
}

function drawChain(ctx: CanvasRenderingContext2D, seed: number) {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = '#444444';
    // Two links
    ctx.fillRect(6, 2, 4, 4); ctx.fillRect(6, 10, 4, 4);
    ctx.fillStyle = '#333333';
    ctx.fillRect(7, 3, 2, 2); ctx.fillRect(7, 11, 2, 2);
}

function drawMud(ctx: CanvasRenderingContext2D, seed: number) {
    fillNoise(ctx, [61, 52, 45], 15, seed);
    const rng = sRng(seed);
    // Dark wet splotches
    for (let i = 0; i < 15; i++) {
        px(ctx, (rng() * 16) | 0, (rng() * 16) | 0, 45, 38, 33);
    }
}

function drawMudBricks(ctx: CanvasRenderingContext2D, seed: number) {
    drawBricks(ctx, seed);
    // Recoloring bricks to mud colors
    const imgData = ctx.getImageData(0, 0, 16, 16);
    for (let i = 0; i < imgData.data.length; i += 4) {
        // Simple brown tint
        imgData.data[i] = (imgData.data[i] * 0.5) | 0;
        imgData.data[i + 1] = (imgData.data[i + 1] * 0.45) | 0;
        imgData.data[i + 2] = (imgData.data[i + 2] * 0.4) | 0;
    }
    ctx.putImageData(imgData, 0, 0);
}

function drawNetheriteBlock(ctx: CanvasRenderingContext2D, seed: number) {
    fillNoise(ctx, [49, 46, 46], 10, seed);
    drawInnerEdge(ctx, [35, 33, 33]);
    // Subtle metallic highlights
    const rng = sRng(seed);
    for (let i = 0; i < 8; i++) {
        px(ctx, (rng() * 16) | 0, (rng() * 16) | 0, 70, 68, 68);
    }
}

function drawEndStone(ctx: CanvasRenderingContext2D, seed: number) {
    fillNoise(ctx, [232, 232, 170], 15, seed);
    const rng = sRng(seed);
    for (let i = 0; i < 8; i++) {
        px(ctx, (rng() * 14 + 1) | 0, (rng() * 14 + 1) | 0, 210, 210, 145);
    }
}

function drawNetherBricks(ctx: CanvasRenderingContext2D, seed: number) {
    fillNoise(ctx, [44, 22, 26], 12, seed);
    for (let i = 0; i < 16; i++) {
        px(ctx, i, 0, 35, 15, 18); px(ctx, i, 4, 35, 15, 18);
        px(ctx, i, 8, 35, 15, 18); px(ctx, i, 12, 35, 15, 18);
    }
    const rng = sRng(seed);
    for (let y = 0; y < 16; y++) {
        const off = (Math.floor(y / 4) % 2 === 0) ? 0 : 8;
        px(ctx, off, y, 35, 15, 18);
        px(ctx, (off + 8) % 16, y, 35, 15, 18);
    }
}

function drawCryingObsidian(ctx: CanvasRenderingContext2D, seed: number) {
    drawObsidian(ctx, seed);
    const rng = sRng(seed);
    for (let i = 0; i < 6; i++) {
        const sx = (rng() * 14 + 1) | 0, sy = (rng() * 14 + 1) | 0;
        px(ctx, sx, sy, 120, 40, 200);
    }
}

function drawEndPortalFrame(ctx: CanvasRenderingContext2D, face: string, seed: number) {
    const rng = sRng(seed);
    if (face === 'top') {
        fillNoise(ctx, [26, 74, 74], 12, seed);
        // Eye socket
        ctx.fillStyle = '#153232'; ctx.fillRect(5, 5, 6, 6);
        ctx.fillStyle = '#0ae0e0'; ctx.fillRect(7, 7, 2, 2);
    } else {
        fillNoise(ctx, [59, 107, 75], 15, seed);
        for (let x = 0; x < 16; x++) { px(ctx, x, 0, 45, 88, 58); px(ctx, x, 15, 45, 88, 58); }
    }
}

function drawEndPortalBlock(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const star = rng() < 0.05;
        if (star) px(ctx, x, y, 255, 255, 255);
        else px(ctx, x, y, 0, 10, 25);
    }
}

function drawDragonEgg(ctx: CanvasRenderingContext2D, seed: number) {
    fillNoise(ctx, [13, 0, 22], 8, seed);
    const rng = sRng(seed);
    for (let i = 0; i < 4; i++) px(ctx, (rng() * 14 + 1) | 0, (rng() * 14 + 1) | 0, 80, 20, 120);
}

function drawNetherPortalBlock(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = rng() * 40 - 20;
        px(ctx, x, y, 100 + v, 0, 160 + v);
    }
}

function drawSoulSand(ctx: CanvasRenderingContext2D, seed: number) {
    fillNoise(ctx, [91, 69, 56], 18, seed);
    const rng = sRng(seed);
    for (let i = 0; i < 12; i++) {
        const sx = (rng() * 14 + 1) | 0, sy = (rng() * 14 + 1) | 0;
        px(ctx, sx, sy, 50, 35, 25);
    }
}

function drawSculk(ctx: CanvasRenderingContext2D, seed: number) {
    fillNoise(ctx, [11, 29, 33], 15, seed);
    const rng = sRng(seed);
    for (let i = 0; i < 12; i++) {
        const sx = (rng() * 16) | 0, sy = (rng() * 16) | 0;
        px(ctx, sx, sy, 0, 204, 255); // Glowing blue speckles
    }
}

function drawMoss(ctx: CanvasRenderingContext2D, seed: number) {
    fillNoise(ctx, [89, 125, 48], 25, seed);
    const rng = sRng(seed);
    for (let i = 0; i < 20; i++) {
        const sx = (rng() * 16) | 0, sy = (rng() * 16) | 0;
        px(ctx, sx, sy, 70, 100, 35);
    }
}

function drawAzalea(ctx: CanvasRenderingContext2D, flowering: boolean, seed: number) {
    drawMoss(ctx, seed);
    const rng = sRng(seed);
    if (flowering) {
        for (let i = 0; i < 8; i++) {
            const sx = (rng() * 14 + 1) | 0, sy = (rng() * 14 + 1) | 0;
            px(ctx, sx, sy, 255, 153, 204); // Pink flowers
        }
    }
}

function drawDripstone(ctx: CanvasRenderingContext2D, seed: number) {
    fillNoise(ctx, [132, 103, 82], 15, seed);
    const rng = sRng(seed);
    for (let x = 0; x < 16; x += 4) {
        for (let y = 0; y < 16; y++) {
            if (rng() < 0.3) px(ctx, x + (rng() > 0.5 ? 1 : 0), y, 100, 75, 55);
        }
    }
}

function drawFroglight(ctx: CanvasRenderingContext2D, baseColor: [number, number, number], seed: number) {
    fillNoise(ctx, baseColor, 10, seed);
    drawInnerEdge(ctx, [Math.min(255, baseColor[0] + 30), Math.min(255, baseColor[1] + 30), Math.min(255, baseColor[2] + 30)]);
}

function drawSeaLantern(ctx: CanvasRenderingContext2D, seed: number) {
    fillNoise(ctx, [179, 209, 209], 10, seed);
    drawInnerEdge(ctx, [220, 255, 255]);
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.strokeRect(4, 4, 8, 8);
}

function drawQuartz(ctx: CanvasRenderingContext2D, chiseled: boolean, seed: number) {
    fillNoise(ctx, [240, 236, 228], 5, seed);
    drawInnerEdge(ctx, [255, 255, 255]);
    if (chiseled) {
        ctx.strokeStyle = '#e0dcd4';
        ctx.strokeRect(3, 3, 10, 10);
        ctx.strokeRect(5, 5, 6, 6);
    }
}

function drawQuartzBricks(ctx: CanvasRenderingContext2D, seed: number) {
    drawQuartz(ctx, false, seed);
    drawStoneBricks(ctx, false, seed);
}

function drawBamboo(ctx: CanvasRenderingContext2D, planks: boolean, seed: number) {
    const color: RGB = planks ? [151, 140, 74] : [89, 125, 48];
    fillNoise(ctx, color, 15, seed);
    const rng = sRng(seed);
    for (let x = 0; x < 16; x += 4) {
        ctx.fillStyle = `rgba(0,0,0,${rng() * 0.2})`;
        ctx.fillRect(x, 0, 1, 16);
    }
}

function drawBambooMosaic(ctx: CanvasRenderingContext2D, seed: number) {
    fillNoise(ctx, [151, 140, 74], 15, seed);
    for (let i = 0; i < 16; i += 4) {
        for (let j = 0; j < 16; j += 4) {
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.strokeRect(i, j, 4, 4);
        }
    }
}

function drawButton(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    ctx.clearRect(0, 0, 16, 16);
    // Button is a small 6x4 or so block in center
    const base: RGB = [120, 120, 120];
    for (let y = 6; y < 10; y++) for (let x = 5; x < 11; x++) {
        const v = rng() * 10 - 5;
        px(ctx, x, y, base[0] + v, base[1] + v, base[2] + v);
    }
    // Edge
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.strokeRect(5, 6, 6, 4);
}

function drawEndCrystal(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    ctx.clearRect(0, 0, 16, 16);
    // Obsidian base
    ctx.fillStyle = '#1a0a2e';
    ctx.fillRect(4, 12, 8, 3);
    // Crystal core
    const c: RGB = [255, 100, 255];
    for (let i = 0; i < 20; i++) {
        const x = 5 + (rng() * 6 | 0);
        const y = 3 + (rng() * 8 | 0);
        px(ctx, x, y, c[0], c[1], c[2]);
    }
    // High-res sparkles (white)
    for (let i = 0; i < 5; i++) {
        px(ctx, 5 + (rng() * 6 | 0), 3 + (rng() * 8 | 0), 255, 255, 255);
    }
}

function drawTotem(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    ctx.clearRect(0, 0, 16, 16);
    // Golden body
    ctx.fillStyle = '#ffff55';
    ctx.fillRect(6, 4, 4, 8); // Head/body
    ctx.fillRect(4, 6, 8, 2); // Arms
    // Emerald eyes
    ctx.fillStyle = '#55ff55';
    px(ctx, 7, 5, 85, 255, 85); px(ctx, 8, 5, 85, 255, 85);
    // Darker details
    ctx.fillStyle = '#aa8800';
    ctx.fillRect(6, 11, 4, 1);
}

function drawDragonBreath(ctx: CanvasRenderingContext2D, seed: number) {
    const rng = sRng(seed);
    ctx.clearRect(0, 0, 16, 16);
    // Glass bottle outline
    ctx.strokeStyle = 'rgba(200, 200, 255, 0.5)';
    ctx.strokeRect(5, 6, 6, 8);
    ctx.strokeRect(7, 3, 2, 3);
    // Magenta swirling vapor
    for (let i = 0; i < 15; i++) {
        const x = 6 + (rng() * 4 | 0);
        const y = 7 + (rng() * 6 | 0);
        px(ctx, x, y, 200 + (rng() * 55 | 0), 30, 200 + (rng() * 55 | 0));
    }
}

// ─── Main Texture Creation (MC-Accurate) ──────────────────

function drawBlockTexture(ctx: CanvasRenderingContext2D, blockId: number, face: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right', seed: number): void {
    const data = BLOCK_DATA[blockId];
    if (!data) return;

    const rng = sRng(seed);

    switch (blockId) {
        case BlockType.BED: drawBed(ctx, face, seed, false); return;
        case BlockType.BED_HEAD: drawBed(ctx, face, seed, true); return;
        case BlockType.DOOR_OAK: drawDoor(ctx, face, seed); return;
        case BlockType.FENCE_OAK: drawFence(ctx, seed); return;

        case BlockType.STONE: drawStone(ctx, seed); return;
        // ─── 1.17+ Stones ──────────────────────────────
        case BlockType.GRANITE: drawGranite(ctx, seed); return;
        case BlockType.POLISHED_GRANITE: drawGranite(ctx, seed); drawInnerEdge(ctx, [140, 90, 80]); return;
        case BlockType.DIORITE: drawDiorite(ctx, seed); return;
        case BlockType.POLISHED_DIORITE: drawDiorite(ctx, seed); drawInnerEdge(ctx, [180, 180, 180]); return;
        case BlockType.ANDESITE: drawAndesite(ctx, seed); return;
        case BlockType.POLISHED_ANDESITE: drawAndesite(ctx, seed); drawInnerEdge(ctx, [110, 110, 110]); return;
        case BlockType.DEEPSLATE: drawDeepslate(ctx, seed); return;
        case BlockType.COBBLED_DEEPSLATE: drawDeepslate(ctx, seed); return; // add cobble texture later
        case BlockType.POLISHED_DEEP_SLATE: drawDeepslate(ctx, seed); drawInnerEdge(ctx, [50, 50, 55]); return;
        case BlockType.DEEPSLATE_BRICKS: drawDeepslate(ctx, seed); drawStoneBricks(ctx, false, seed); return;

        case BlockType.COAL_ORE:
        case BlockType.IRON_ORE:
        case BlockType.GOLD_ORE:
        case BlockType.DIAMOND:
        case BlockType.EMERALD_ORE:
        case BlockType.LAPIS_ORE:
        case BlockType.REDSTONE_ORE:
        case BlockType.COPPER_ORE:
            drawStone(ctx, seed);
            drawOreOverlay(ctx, hex(data.ore || '#ffffff'), seed);
            return;
        case BlockType.DEEPSLATE_COPPER_ORE:
            drawDeepslate(ctx, seed);
            drawOreOverlay(ctx, hex(data.ore || '#ffffff'), seed);
            return;
        case BlockType.NETHER_QUARTZ_ORE:
            drawNetherrack(ctx, seed);
            drawOreOverlay(ctx, hex(data.ore || '#ffffff'), seed);
            return;

        case BlockType.COBBLE: drawCobble(ctx, seed); return;
        case BlockType.MOSSY_COBBLE: drawCobble(ctx, seed); // add moss
            for (let i = 0; i < 18; i++) { const sx = (rng() * 14 + 1) | 0, sy = (rng() * 14 + 1) | 0; px(ctx, sx, sy, 60 + (rng() * 25 | 0), 110 + (rng() * 20 | 0), 40); } return;
        case BlockType.DIRT: drawDirt(ctx, seed); return;
        case BlockType.GRASS:
            if (face === 'top') drawGrassTop(ctx, seed);
            else if (face === 'bottom') drawDirt(ctx, seed);
            else drawGrassSide(ctx, seed);
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
        case BlockType.CRYING_OBSIDIAN: drawCryingObsidian(ctx, seed); return;
        case BlockType.SANDSTONE: drawSandstone(ctx, face, seed); return;
        case BlockType.STONE_BRICKS: drawStoneBricks(ctx, false, seed); return;
        case BlockType.MOSSY_STONE_BRICKS: drawStoneBricks(ctx, true, seed); return;
        case BlockType.NETHERRACK: drawNetherrack(ctx, seed); return;
        case BlockType.SOUL_SAND: drawSoulSand(ctx, seed); return;
        case BlockType.END_STONE: drawEndStone(ctx, seed); return;
        case BlockType.GLOWSTONE: drawGlowstone(ctx, seed); return;
        case BlockType.NETHER_BRICKS: drawNetherBricks(ctx, seed); return;
        case BlockType.ANCIENT_DEBRIS: drawAncientDebris(ctx, seed); return;
        case BlockType.NETHERITE_BLOCK: drawNetheriteBlock(ctx, seed); return;
        case BlockType.GILDED_BLACKSTONE:
            drawBlackstone(ctx, seed);
            drawOreOverlay(ctx, [255, 215, 0], seed + 1);
            return;
        case BlockType.CHISELED_POLISHED_BLACKSTONE:
            drawBlackstone(ctx, seed);
            drawInnerEdge(ctx, [30, 30, 35]);
            ctx.strokeStyle = '#000'; ctx.strokeRect(4, 4, 8, 8);
            return;
        case BlockType.SOUL_TORCH:
            fillNoise(ctx, [20, 20, 20], 5, seed);
            for (let y = 4; y < 14; y++) px(ctx, 7, y, 90, 70, 45);
            for (let y = 2; y < 5; y++) for (let x = 6; x < 10; x++) px(ctx, x, y, 0, 200, 255);
            return;
        case BlockType.LANTERN: drawLantern(ctx, false, seed); return;
        case BlockType.SOUL_LANTERN: drawLantern(ctx, true, seed); return;
        case BlockType.CHAIN: drawChain(ctx, seed); return;
        case BlockType.CAKE: drawCake(ctx, face, seed); return;
        case BlockType.TNT: drawTNT(ctx, face, seed); return;
        case BlockType.BOOKSHELF: drawBookshelf(ctx, face, seed); return;
        case BlockType.CRAFTING:
            if (face === 'top') drawCraftingTop(ctx, seed);
            else if (face === 'bottom') drawPlanks(ctx, [165, 120, 70], seed);
            else drawCraftingSide(ctx, face, seed);
            return;
        case BlockType.FURNACE:
        case BlockType.FURNACE_ON:
            drawFurnaceSide(ctx, face === 'front', blockId === BlockType.FURNACE_ON, seed); return;
        case BlockType.CHEST: drawChest(ctx, face, seed); return;
        case BlockType.CACTUS: drawCactus(ctx, face, seed); return;
        case BlockType.MELON: drawMelon(ctx, face, seed); return;
        case BlockType.PUMPKIN: drawPumpkin(ctx, face, seed); return;
        // Wool
        case BlockType.WOOL_WHITE: drawWool(ctx, [232, 232, 232], seed); return;
        case BlockType.WOOL_RED: drawWool(ctx, [184, 32, 32], seed); return;
        case BlockType.WOOL_BLUE: drawWool(ctx, [32, 32, 184], seed); return;
        case BlockType.WOOL_GREEN: drawWool(ctx, [32, 184, 32], seed); return;
        case BlockType.WOOL_YELLOW: drawWool(ctx, [212, 212, 32], seed); return;
        case BlockType.WOOL_BLACK: drawWool(ctx, [34, 34, 34], seed); return;
        // Metal/gem blocks
        case BlockType.IRON_BLOCK:
            fillNoise(ctx, [216, 216, 216], 10, seed);
            drawInnerEdge(ctx, [150, 150, 150]);
            return;
        case BlockType.GOLD_BLOCK: fillNoise(ctx, [255, 215, 0], 12, seed); return;
        case BlockType.DIAMOND_BLOCK: fillNoise(ctx, [68, 238, 238], 12, seed); return;
        case BlockType.EMERALD_BLOCK: fillNoise(ctx, [34, 204, 68], 12, seed); return;
        case BlockType.LAPIS_BLOCK: drawLapisBlock(ctx, seed); return;
        case BlockType.REDSTONE_BLOCK: drawRedstoneBlock(ctx, seed); return;
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
        // Flowers & tall grass (cutout textures, no opaque square background)
        case BlockType.FLOWER_RED: {
            ctx.clearRect(0, 0, 16, 16);
            for (let y = 7; y < 16; y++) px(ctx, 8, y, 55 + (rng() * 20 | 0), 150 + (rng() * 30 | 0), 45);
            const petals: [number, number][] = [[8, 4], [7, 5], [9, 5], [6, 6], [8, 6], [10, 6], [7, 7], [9, 7]];
            for (const [x, y] of petals) px(ctx, x, y, 210 + (rng() * 30 | 0), 40 + (rng() * 20 | 0), 40 + (rng() * 20 | 0));
            px(ctx, 8, 6, 250, 220, 90);
            return;
        }
        case BlockType.FLOWER_YELLOW: {
            ctx.clearRect(0, 0, 16, 16);
            for (let y = 7; y < 16; y++) px(ctx, 8, y, 55 + (rng() * 20 | 0), 150 + (rng() * 30 | 0), 45);
            const petals: [number, number][] = [[8, 4], [7, 5], [9, 5], [6, 6], [8, 6], [10, 6], [7, 7], [9, 7]];
            for (const [x, y] of petals) px(ctx, x, y, 225 + (rng() * 25 | 0), 195 + (rng() * 35 | 0), 35 + (rng() * 20 | 0));
            px(ctx, 8, 6, 255, 235, 120);
            return;
        }
        case BlockType.TALL_GRASS: {
            ctx.clearRect(0, 0, 16, 16);
            for (let i = 0; i < 20; i++) {
                const baseX = 3 + (rng() * 10 | 0);
                const h = 5 + (rng() * 7 | 0);
                for (let y = 0; y < h; y++) {
                    const bend = ((y / h) * (rng() > 0.5 ? 1 : -1)) | 0;
                    const x = Math.max(0, Math.min(15, baseX + bend));
                    const pyY = 15 - y;
                    px(ctx, x, pyY, 45 + (rng() * 30 | 0), 135 + (rng() * 55 | 0), 30 + (rng() * 25 | 0));
                }
            }
            return;
        }
        case BlockType.OAK_SAPLING: {
            // Sapling: small stem + leaves
            const rng = sRng(seed);
            ctx.clearRect(0, 0, 16, 16);
            // Stem
            for (let y = 8; y < 16; y++) px(ctx, 7, y, 107, 84, 51);
            // Leaves
            for (let i = 0; i < 15; i++) {
                const sx = (rng() * 10 + 3) | 0;
                const sy = (rng() * 10 + 2) | 0;
                if (Math.abs(sx - 7.5) + Math.abs(sy - 10) < 6) {
                    px(ctx, sx, sy, 40 + (rng() * 20 | 0), 100 + (rng() * 40 | 0), 30);
                }
            }
            return;
        }
        case BlockType.TUFF: drawAndesite(ctx, seed); return; // Tuff is similar enough to andesite for now
        case BlockType.CALCITE: fillNoise(ctx, [227, 227, 227], 10, seed); return;
        case BlockType.AMETHYST_BLOCK:
        case BlockType.BUDDING_AMETHYST:
            drawAmethyst(ctx, seed); return;
        case BlockType.AMETHYST_CLUSTER:
            ctx.clearRect(0, 0, 16, 16);
            drawAmethyst(ctx, seed); return;
        case BlockType.TINTED_GLASS:
            ctx.fillStyle = 'rgba(51, 35, 69, 0.8)';
            ctx.fillRect(0, 0, 16, 16);
            drawInnerEdge(ctx, [60, 40, 80]);
            return;

        case BlockType.RAW_COPPER_BLOCK: drawRawOre(ctx, [209, 114, 91], seed); return;
        case BlockType.COPPER_BLOCK:
        case BlockType.CUT_COPPER:
            drawCopper(ctx, seed);
            if (blockId === BlockType.CUT_COPPER) drawInnerEdge(ctx, [180, 100, 80]);
            return;
        case BlockType.RAW_IRON_BLOCK: drawRawOre(ctx, [216, 175, 147], seed); return;
        case BlockType.RAW_GOLD_BLOCK: drawRawOre(ctx, [240, 209, 45], seed); return;

        case BlockType.BLACKSTONE: drawBlackstone(ctx, seed); return;
        case BlockType.POLISHED_BLACKSTONE: drawBlackstone(ctx, seed); drawInnerEdge(ctx, [30, 30, 35]); return;
        case BlockType.BASALT: drawBasalt(ctx, seed, face === 'top' || face === 'bottom'); return;
        case BlockType.POLISHED_BASALT: drawBasalt(ctx, seed, face === 'top' || face === 'bottom'); drawInnerEdge(ctx, [70, 71, 71]); return;
        case BlockType.CRIMSON_STEM:
            if (face === 'top' || face === 'bottom') fillNoise(ctx, [90, 25, 29], 15, seed);
            else fillNoise(ctx, [139, 45, 72], 20, seed);
            return;
        case BlockType.WARPED_STEM:
            if (face === 'top' || face === 'bottom') fillNoise(ctx, [58, 142, 140], 15, seed);
            else fillNoise(ctx, [58, 142, 140], 20, seed);
            return;
        case BlockType.CRIMSON_PLANKS: drawPlanks(ctx, [122, 45, 72], seed); return;
        case BlockType.WARPED_PLANKS: drawPlanks(ctx, [58, 142, 140], seed); return;
        case BlockType.NETHER_WART_BLOCK: fillNoise(ctx, [115, 11, 11], 20, seed); return;

        case BlockType.MUD: drawMud(ctx, seed); return;
        case BlockType.MUD_BRICKS: drawMudBricks(ctx, seed); return;
        case BlockType.CHERRY_LOG:
            if (face === 'top' || face === 'bottom') drawLogTop(ctx, [77, 59, 59], [234, 176, 190], seed);
            else drawOakLogSide(ctx, seed);
            return;
        case BlockType.CHERRY_PLANKS: drawPlanks(ctx, [234, 176, 190], seed); return;
        case BlockType.CHERRY_LEAVES: fillNoise(ctx, [234, 176, 190], 30, seed); return;
        case BlockType.MANGROVE_LOG:
            if (face === 'top' || face === 'bottom') drawLogTop(ctx, [74, 61, 52], [122, 45, 72], seed);
            else drawOakLogSide(ctx, seed);
            return;
        case BlockType.MANGROVE_PLANKS: drawPlanks(ctx, [122, 45, 72], seed); return;
        case BlockType.MANGROVE_LEAVES: drawLeaves(ctx, seed); return;

        // ─── Deep Dark ──────────────────────────────────
        case BlockType.SCULK: drawSculk(ctx, seed); return;
        case BlockType.SCULK_SENSOR:
            drawSculk(ctx, seed);
            if (face === 'top') { ctx.fillStyle = '#00ccff'; ctx.fillRect(4, 4, 8, 8); }
            return;
        case BlockType.SCULK_CATALYST:
            drawSculk(ctx, seed);
            if (face === 'top') drawInnerEdge(ctx, [0, 204, 255]);
            return;
        case BlockType.SCULK_SHRIEKER:
            drawSculk(ctx, seed);
            if (face === 'top') { ctx.fillStyle = '#fff'; ctx.fillRect(5, 5, 6, 6); }
            return;
        case BlockType.SCULK_VEIN: drawSculk(ctx, seed); return;

        // ─── Lush Caves ──────────────────────────────────
        case BlockType.MOSS_BLOCK: drawMoss(ctx, seed); return;
        case BlockType.MOSS_CARPET: drawMoss(ctx, seed); return;
        case BlockType.AZALEA: drawAzalea(ctx, false, seed); return;
        case BlockType.FLOWERING_AZALEA: drawAzalea(ctx, true, seed); return;
        case BlockType.SPORE_BLOSSOM:
            ctx.clearRect(0, 0, 16, 16);
            ctx.fillStyle = '#ffb3cc'; ctx.fillRect(4, 4, 8, 8);
            return;
        case BlockType.DRIPSTONE_BLOCK: drawDripstone(ctx, seed); return;
        case BlockType.POINTED_DRIPSTONE: drawDripstone(ctx, seed); return;
        case BlockType.REINFORCED_DEEPSLATE:
            drawDeepslate(ctx, seed);
            drawInnerEdge(ctx, [100, 100, 105]);
            return;

        // ─── Froglights & Sea ────────────────────────────
        case BlockType.OCHRE_FROGLIGHT: drawFroglight(ctx, [247, 227, 156], seed); return;
        case BlockType.VERDANT_FROGLIGHT: drawFroglight(ctx, [227, 247, 156], seed); return;
        case BlockType.PEARLESCENT_FROGLIGHT: drawFroglight(ctx, [247, 156, 227], seed); return;
        case BlockType.SEA_LANTERN: drawSeaLantern(ctx, seed); return;

        // ─── Construction ────────────────────────────────
        case BlockType.DEEPSLATE_TILES:
            drawDeepslate(ctx, seed);
            drawInnerEdge(ctx, [40, 40, 45]);
            ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.strokeRect(4, 4, 8, 8);
            return;
        case BlockType.CHISELED_DEEPSLATE:
            drawDeepslate(ctx, seed);
            ctx.strokeStyle = '#000'; ctx.strokeRect(3, 3, 10, 10);
            return;
        case BlockType.END_STONE_BRICKS:
            drawEndStone(ctx, seed);
            drawStoneBricks(ctx, false, seed);
            return;

        // ─── Quartz & Bamboo ────────────────────────────
        case BlockType.QUARTZ_BLOCK:
        case BlockType.SMOOTH_QUARTZ:
            drawQuartz(ctx, false, seed); return;
        case BlockType.QUARTZ_BRICKS:
            drawQuartzBricks(ctx, seed); return;
        case BlockType.CHISELED_QUARTZ:
            drawQuartz(ctx, true, seed); return;
        case BlockType.BAMBOO_BLOCK:
            drawBamboo(ctx, false, seed); return;
        case BlockType.BAMBOO_PLANKS:
            drawBamboo(ctx, true, seed); return;
        case BlockType.BAMBOO_MOSAIC:
            drawBambooMosaic(ctx, seed); return;

        case BlockType.LAVA: drawLava(ctx, seed); return;

        default:
            // Missing texture (Magenta/Black checkerboard)
            if (seed === 0) { // Only log once or for one seed variant?
                // No logging to console to avoid spam
            }
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(0, 0, 8, 8);
            ctx.fillRect(8, 8, 8, 8);
            ctx.fillStyle = '#000000';
            ctx.fillRect(8, 0, 8, 8);
            ctx.fillRect(0, 8, 8, 8);
            return;

        // ─── Nether & End Blocks ────────────────────────
        case BlockType.END_STONE: drawEndStone(ctx, seed); return;
        case BlockType.END_PORTAL_FRAME:
            drawEndStone(ctx, seed);
            if (face === 'top') {
                ctx.fillStyle = '#0a2e1f'; ctx.fillRect(4, 4, 8, 8); // Eye slot
                ctx.strokeStyle = '#2d8c6b'; ctx.strokeRect(4, 4, 8, 8);
            } else {
                drawInnerEdge(ctx, [160, 160, 120]);
            }
            return;
        case BlockType.END_PORTAL_BLOCK:
            ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 16, 16);
            for (let i = 0; i < 5; i++) {
                const sx = (rng() * 16) | 0, sy = (rng() * 16) | 0;
                px(ctx, sx, sy, 200, 100, 255); // Stars
            }
            return;
        case BlockType.DRAGON_EGG:
            fillNoise(ctx, [20, 15, 25], 5, seed);
            for (let i = 0; i < 12; i++) {
                const sx = (rng() * 16) | 0, sy = (rng() * 16) | 0;
                px(ctx, sx, sy, 60, 40, 80);
            }
            return;
        case BlockType.ENDER_CHEST:
            fillNoise(ctx, [30, 45, 45], 10, seed);
            drawInnerEdge(ctx, [60, 120, 120]);
            if (face === 'front') {
                ctx.fillStyle = '#ffcc00'; ctx.fillRect(7, 6, 2, 4); // Lock
            }
            return;
        case BlockType.NETHER_PORTAL_BLOCK:
            drawNetherPortalBlock(ctx, seed);
            return;
        case BlockType.BUTTON:
            drawButton(ctx, seed);
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
        case BlockType.JUKEBOX_PLAYING:
            drawPlanks(ctx, [107, 66, 38], seed);
            if (face === 'top') {
                // Record slot
                const isPlaying = blockId === BlockType.JUKEBOX_PLAYING;
                for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) {
                    const dist = Math.sqrt((x - 8) ** 2 + (y - 8) ** 2);
                    if (dist < 3.5) {
                        px(ctx, x, y, 30, 30, 30);
                        // Center of record
                        if (dist < 1.5 && isPlaying) {
                            // Animated/Colored center when playing
                            const c = [255, 50, 50]; // Just a red center for now
                            px(ctx, x, y, c[0], c[1], c[2]);
                        }
                    }
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
            if (face !== 'top' && face !== 'bottom') {
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
        // ─── Farming ────────────────────────────────────
        case BlockType.FARMLAND:
            if (face === 'top') {
                fillNoise(ctx, [55, 35, 20], 15, seed);
                // Furrows
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                for (let i = 2; i < 16; i += 4) ctx.fillRect(0, i, 16, 2);
            } else {
                drawDirt(ctx, seed);
            }
            return;
        case BlockType.SEEDS:
            // Visualize as item (handled by icon usually, but if block?)
            // Seeds are an item, but if placed? They become WHEAT_0 block.
            // So SEEDS texture is only for Item Icon.
            // Draw generic seed pile
            fillNoise(ctx, [0, 0, 0], 0, seed); // transparent background?
            // Items need special rendering if they are just icons.
            // But icons use `drawBlockTexture` for Top/Side.
            // Let's just draw noise.
            fillNoise(ctx, [130, 160, 80], 40, seed);
            return;
        case BlockType.WHEAT_0:
        case BlockType.WHEAT_1:
        case BlockType.WHEAT_2:
        case BlockType.WHEAT_3:
        case BlockType.WHEAT_4:
        case BlockType.WHEAT_5:
        case BlockType.WHEAT_6:
        case BlockType.WHEAT_7:
            // Clear background
            ctx.clearRect(0, 0, 16, 16); // Assuming context is clean or needs clearing?
            // Usually we fill noise.
            // If transparent, we need to handle it.
            // `createTexture` creates canvas.
            // `drawBlockTexture` expects to fill it.

            const stage = blockId - BlockType.WHEAT_0;
            const height = 4 + stage * 1.5;
            const r = stage === 7 ? 220 : 50;
            const g = stage === 7 ? 200 : 200;
            const b = stage === 7 ? 60 : 50;

            ctx.fillStyle = `rgba(${r},${g},${b}, 1)`;
            for (let i = 0; i < 5 + stage; i++) {
                const x = (rng() * 14) | 0;
                const h = (rng() * height * 0.8 + 2) | 0;
                ctx.fillRect(x, 16 - h, 2, h);
            }
            return;

        // ─── Music Discs ──────────────────────────────
        case BlockType.MUSIC_DISC_1:
        case BlockType.MUSIC_DISC_2:
        case BlockType.MUSIC_DISC_3:
        case BlockType.MUSIC_DISC_4:
        case BlockType.MUSIC_DISC_5:
        case BlockType.MUSIC_DISC_6:
        case BlockType.MUSIC_DISC_7:
        case BlockType.MUSIC_DISC_8:
            ctx.clearRect(0, 0, 16, 16);
            // Disc shape
            const colors = {
                [BlockType.MUSIC_DISC_1]: [29, 185, 84],
                [BlockType.MUSIC_DISC_2]: [255, 85, 85],
                [BlockType.MUSIC_DISC_3]: [96, 165, 250],
                [BlockType.MUSIC_DISC_4]: [251, 191, 36],
                [BlockType.MUSIC_DISC_5]: [255, 215, 0],   // Gold/Yellow
                [BlockType.MUSIC_DISC_6]: [56, 189, 248],  // Sky Blue
                [BlockType.MUSIC_DISC_7]: [168, 85, 247],  // Purple
                [BlockType.MUSIC_DISC_8]: [236, 72, 153]   // Pink
            };
            const discCol = colors[blockId as keyof typeof colors] || [255, 255, 255];

            for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) {
                const dist = Math.sqrt((x - 7.5) ** 2 + (y - 7.5) ** 2);
                if (dist < 5.5) {
                    if (dist > 1.5) px(ctx, x, y, 30, 30, 30); // Outer vinyl
                    else px(ctx, x, y, discCol[0], discCol[1], discCol[2]); // Inner label
                }
            }
            return;
        case BlockType.END_CRYSTAL:
            drawEndCrystal(ctx, seed);
            return;
        case BlockType.TOTEM_OF_UNDYING:
            drawTotem(ctx, seed);
            return;
        case BlockType.DRAGON_BREATH:
            drawDragonBreath(ctx, seed);
            return;
    }

    // Generic fallback: use block color with noise
    let color = data.color;
    if (face === 'top' && data.top) color = data.top!;
    if (face === 'bottom' && data.bottom) color = data.bottom!;
    fillNoise(ctx, hex(color), 22, seed);
}

// ─── Texture & Material Creation ─────────────────────────

function createTexture(blockId: number, face: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'): THREE.CanvasTexture {
    const key = `${blockId}_${face}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const data = BLOCK_DATA[blockId];
    if (!data) return createFallbackTexture();

    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE; canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

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
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    for (let y = 0; y < TEX_SIZE; y++) for (let x = 0; x < TEX_SIZE; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#ff00ff' : '#000';
        ctx.fillRect(x, y, 1, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    return t;
}

/** Get cached material for a block face — MeshStandardMaterial for better graphics */
export function getBlockMaterial(blockId: number, face: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'): THREE.MeshStandardMaterial {
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

    const mat = new THREE.MeshStandardMaterial({
        map: tex,
        transparent: data?.transparent ?? false,
        opacity: isWater ? 0.55 : isGlass ? 0.7 : isLeaf ? 0.9 : 1,
        side: data?.transparent ? THREE.DoubleSide : THREE.FrontSide,
        emissive: isEmissive ? new THREE.Color(data?.color ?? '#eedd66') : new THREE.Color(0x000000),
        emissiveIntensity: isLava ? 0.8 : isEmissive ? 0.5 : 0,
        alphaTest: isLeaf ? 0.15 : 0,
        vertexColors: true,
        roughness: 0.9,
        metalness: 0.05
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
        createTexture(numId, 'bottom');
        createTexture(numId, 'front');
        createTexture(numId, 'back');
        createTexture(numId, 'left');
        createTexture(numId, 'right');
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
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    if (data.isItem) {
        const rgb = hex(data.color);
        const isOre = blockId === BlockType.RAW_IRON || blockId === BlockType.RAW_GOLD || blockId === BlockType.RAW_COPPER;
        const isShard = blockId === BlockType.AMETHYST_SHARD;
        const isIngot = blockId === BlockType.IRON_INGOT || blockId === BlockType.GOLD_INGOT || blockId === BlockType.COPPER_INGOT || blockId === BlockType.NETHERITE_INGOT;
        const isArmor = blockId >= 400 && blockId <= 423 || (blockId >= 610 && blockId <= 613);

        if (isOre || blockId === BlockType.NETHERITE_SCRAP) {
            // Lumpy raw ore/scrap shape
            ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
            ctx.beginPath();
            ctx.arc(size * 0.45, size * 0.5, size * 0.25, 0, Math.PI * 2);
            ctx.arc(size * 0.6, size * 0.45, size * 0.2, 0, Math.PI * 2);
            ctx.fill();
        } else if (isShard) {
            // Crystal shard shape
            ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
            ctx.beginPath();
            ctx.moveTo(size * 0.5, size * 0.2);
            ctx.lineTo(size * 0.7, size * 0.8);
            ctx.lineTo(size * 0.5, size * 0.7);
            ctx.lineTo(size * 0.3, size * 0.8);
            ctx.closePath(); ctx.fill();
        } else if (isIngot) {
            // Rounded rectangle ingot
            ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
            ctx.fillRect(size * 0.25, size * 0.35, size * 0.5, size * 0.3);
            drawInnerEdge(ctx, darken(rgb, 0.8));
        } else if (isArmor) {
            // Simple armor piece representation
            ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
            ctx.fillRect(size * 0.3, size * 0.3, size * 0.4, size * 0.4);
            drawInnerEdge(ctx, lighten(rgb, 30));
        } else {
            // Existing Tool rendering shape
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
        }
    } else {
        // Create mini 16x16 textures for each face
        const topTex = document.createElement('canvas');
        topTex.width = TEX_SIZE; topTex.height = TEX_SIZE;
        const topCtx = topTex.getContext('2d', { willReadFrequently: true })!;
        const topSeed = blockId * 1000 + 1;
        drawBlockTexture(topCtx, blockId, 'top', topSeed);

        const leftTex = document.createElement('canvas');
        leftTex.width = TEX_SIZE; leftTex.height = TEX_SIZE;
        const leftCtx = leftTex.getContext('2d', { willReadFrequently: true })!;
        const leftSeed = blockId * 1000 + 3;
        drawBlockTexture(leftCtx, blockId, 'left', leftSeed);

        const rightTex = document.createElement('canvas');
        rightTex.width = TEX_SIZE; rightTex.height = TEX_SIZE;
        const rightCtx = rightTex.getContext('2d', { willReadFrequently: true })!;
        const rightSeed = blockId * 1000 + 4;
        drawBlockTexture(rightCtx, blockId, 'right', rightSeed);

        const topImgData = topCtx.getImageData(0, 0, TEX_SIZE, TEX_SIZE);
        const leftImgData = leftCtx.getImageData(0, 0, TEX_SIZE, TEX_SIZE);
        const rightImgData = rightCtx.getImageData(0, 0, TEX_SIZE, TEX_SIZE);

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
                const r = leftImgData.data[idx], g = leftImgData.data[idx + 1], b = leftImgData.data[idx + 2];
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
                const r = rightImgData.data[idx], g = rightImgData.data[idx + 1], b = rightImgData.data[idx + 2];
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

// ─── Texture Atlas System ────────────────────────────────

const ATLAS_SIZE = 4096; // 64x64 slots of 64px
const SLOT_SIZE = 64;
const SLOTS_PER_ROW = ATLAS_SIZE / SLOT_SIZE;

interface AtlasUV {
    u: number;
    v: number;
    su: number; // width in uv space
    sv: number; // height in uv space
}

let atlasTexture: THREE.CanvasTexture | null = null;
const atlasUVs = new Map<string, AtlasUV>();

export function getAtlasTexture(): THREE.CanvasTexture {
    if (atlasTexture) return atlasTexture;

    // Create Atlas
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_SIZE;
    canvas.height = ATLAS_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    // Disable smoothing for sharp upscaled pixels
    ctx.imageSmoothingEnabled = false;

    // Clear to a neutral grass color instead of transparent black to prevent black bleeding
    ctx.fillStyle = '#5da83a';
    ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

    let currentSlot = 0;

    // Helper to assign slot
    const assignSlot = (
        key: string,
        drawFn: (c: CanvasRenderingContext2D) => void,
        options?: { transparentSlot?: boolean; addOverlay?: boolean }
    ) => {
        const transparentSlot = options?.transparentSlot ?? false;
        const addOverlay = options?.addOverlay ?? true;
        const col = currentSlot % SLOTS_PER_ROW;
        const row = Math.floor(currentSlot / SLOTS_PER_ROW);

        const pxX = col * SLOT_SIZE;
        const pxY = row * SLOT_SIZE;

        ctx.save();
        ctx.translate(pxX, pxY);
        // Clip to slot to prevent bleeding during draw
        ctx.beginPath();
        ctx.rect(0, 0, SLOT_SIZE, SLOT_SIZE);
        ctx.clip();

        // Transparent textures must start with fully transparent slot content.
        if (transparentSlot) {
            ctx.clearRect(0, 0, SLOT_SIZE, SLOT_SIZE);
        }

        // Scale by 4 for high-res look (16 * 4 = 64)
        ctx.scale(4, 4);

        drawFn(ctx);

        // Return to 1:1 scale to add HD noise overlay
        ctx.scale(0.25, 0.25);

        // Add deterministic high-res procedural noise overlay
        if (addOverlay) {
            const noiseRng = sRng(currentSlot + 999);
            for (let i = 0; i < 400; i++) {
                ctx.fillStyle = `rgba(255, 255, 255, 0.03)`;
                ctx.fillRect((noiseRng() * 64) | 0, (noiseRng() * 64) | 0, 1, 1);
                ctx.fillStyle = `rgba(0, 0, 0, 0.04)`;
                ctx.fillRect((noiseRng() * 64) | 0, (noiseRng() * 64) | 0, 1, 1);
            }
        }

        ctx.restore();

        // Calculate UVs (bottom-left origin for Three.js, but canvas is top-left)
        // Add more padding (1.5px) to prevent bleeding on the high-res 4096px atlas
        const pad = 1.5;
        const u = (pxX + pad) / ATLAS_SIZE;
        const v = 1.0 - ((pxY + SLOT_SIZE - pad) / ATLAS_SIZE);
        const su = (SLOT_SIZE - 2 * pad) / ATLAS_SIZE;
        const sv = (SLOT_SIZE - 2 * pad) / ATLAS_SIZE;

        atlasUVs.set(key, { u, v, su, sv });
        currentSlot++;
    };

    // Iterate all blocks
    Object.keys(BLOCK_DATA).forEach((key) => {
        const id = Number(key);
        const faces: ('top' | 'bottom' | 'front' | 'back' | 'left' | 'right')[] = ['top', 'bottom', 'front', 'back', 'left', 'right'];
        const blockInfo = BLOCK_DATA[id];
        const isTransparentBlock = blockInfo?.transparent ?? false;

        for (const face of faces) {
            const cacheKey = `${id}_${face}`;
            const disableOverlay = id === BlockType.GRASS;
            assignSlot(
                cacheKey,
                (c) => drawBlockTexture(c, id, face, id),
                {
                    transparentSlot: isTransparentBlock,
                    addOverlay: !isTransparentBlock && !disableOverlay,
                }
            );
        }
    });

    atlasTexture = new THREE.CanvasTexture(canvas);
    atlasTexture.magFilter = THREE.NearestFilter;
    atlasTexture.minFilter = THREE.NearestFilter;
    atlasTexture.generateMipmaps = false;
    atlasTexture.anisotropy = 1;
    atlasTexture.colorSpace = THREE.SRGBColorSpace;
    atlasTexture.premultiplyAlpha = false;
    atlasTexture.wrapS = THREE.ClampToEdgeWrapping;
    atlasTexture.wrapT = THREE.ClampToEdgeWrapping;
    atlasTexture.needsUpdate = true;

    return atlasTexture;
}

export function getAtlasUV(blockId: number, face: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'): AtlasUV {
    if (!atlasTexture) getAtlasTexture(); // Ensure init
    const uv = atlasUVs.get(`${blockId}_${face}`);
    if (!uv) {
        return { u: 0, v: 0, su: 0, sv: 0 };
    }
    return uv;
}

export function getAllAtlasUVs(): Record<string, AtlasUV> {
    if (!atlasTexture) getAtlasTexture();
    const result: Record<string, AtlasUV> = {};
    atlasUVs.forEach((val, key) => { result[key] = val; });
    return result;
}
