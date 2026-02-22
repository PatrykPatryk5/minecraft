import useGameStore from '../store/gameStore';
import { BlockType } from './blockTypes';
import { playSound } from '../audio/sounds';

export function attemptNetherPortalIgnite(x: number, y: number, z: number): boolean {
    const s = useGameStore.getState();

    const checkFrame = (dx: number, dz: number) => {
        // Try multiple base positions around the clicked block
        for (let offsetX = -3; offsetX <= 1; offsetX++) {
            for (let offsetZ = -3; offsetZ <= 1; offsetZ++) {
                const bx = x + offsetX * Math.abs(dx);
                const bz = z + offsetZ * Math.abs(dz);

                let valid = true;

                // Typical 4x5 Frame (Interior is 2x3)
                // Bottom: (bx, bz) and (bx+dx, bz+dz)
                // Left pillar: (bx-dx, bz-dz) from y to y+4
                // Right pillar: (bx+2dx, bz+2dz) from y to y+4
                // Top: (bx, bz) and (bx+dx, bz+dz) at y+4

                // Bottom row
                if (s.getBlock(bx, y, bz) !== BlockType.OBSIDIAN) continue;
                if (s.getBlock(bx + dx, y, bz + dz) !== BlockType.OBSIDIAN) continue;

                // Top row
                if (s.getBlock(bx, y + 4, bz) !== BlockType.OBSIDIAN) continue;
                if (s.getBlock(bx + dx, y + 4, bz + dz) !== BlockType.OBSIDIAN) continue;

                for (let h = 1; h <= 3; h++) {
                    if (s.getBlock(bx - dx, y + h, bz - dz) !== BlockType.OBSIDIAN) valid = false;
                    if (s.getBlock(bx + dx * 2, y + h, bz + dz * 2) !== BlockType.OBSIDIAN) valid = false;

                    const in1 = s.getBlock(bx, y + h, bz);
                    const in2 = s.getBlock(bx + dx, y + h, bz + dz);
                    if (in1 !== undefined && in1 !== BlockType.AIR) valid = false;
                    if (in2 !== undefined && in2 !== BlockType.AIR) valid = false;
                }

                if (valid) {
                    const portalBlocks: { x: number, y: number, z: number, typeId: number }[] = [];
                    for (let h = 1; h <= 3; h++) {
                        portalBlocks.push({ x: bx, y: y + h, z: bz, typeId: BlockType.NETHER_PORTAL_BLOCK });
                        portalBlocks.push({ x: bx + dx, y: y + h, z: bz + dz, typeId: BlockType.NETHER_PORTAL_BLOCK });
                    }
                    s.addBlocks(portalBlocks);
                    playSound('fuse');
                    return true;
                }
            }
        }
        return false;
    };

    if (checkFrame(1, 0)) return true;
    if (checkFrame(0, 1)) return true;

    return false;
}

export function getSafeHeight(x: number, z: number, searchRange: [number, number] = [32, 110]): number {
    const s = useGameStore.getState();
    const bx = Math.floor(x);
    const bz = Math.floor(z);

    // Scan for solid ground (top down or bottom up depending on range)
    for (let y = searchRange[1]; y >= searchRange[0]; y--) {
        const type = s.getBlock(bx, y, bz);
        if (type !== BlockType.AIR && type !== BlockType.LAVA && type !== BlockType.WATER) {
            return y;
        }
    }
    return searchRange[0]; // Fallback
}

export function buildNetherPortalSafe(x: number, y: number, z: number): void {
    const s = useGameStore.getState();
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);

    const blocks: { x: number, y: number, z: number, typeId: number }[] = [];

    // 1. Build a 5x5 platform under the portal for enhanced safety
    for (let ox = -2; ox <= 2; ox++) {
        for (let oz = -2; oz <= 2; oz++) {
            const current = s.getBlock(bx + ox, by - 1, bz + oz);
            if (current === BlockType.AIR || current === BlockType.LAVA || current === BlockType.WATER) {
                blocks.push({ x: bx + ox, y: by - 1, z: bz + oz, typeId: BlockType.OBSIDIAN });
            }
        }
    }

    // 2. Clear interior (4x5 area) - larger clearing to prevent suffocation
    for (let ox = -2; ox <= 3; ox++) {
        for (let dy = 0; dy <= 4; dy++) {
            for (let oz = -2; oz <= 2; oz++) {
                blocks.push({ x: bx + ox, y: by + dy, z: bz + oz, typeId: BlockType.AIR });
            }
        }
    }

    // 3. Build typical 4x5 Frame
    // Bottom
    blocks.push({ x: bx, y: by, z: bz, typeId: BlockType.OBSIDIAN });
    blocks.push({ x: bx + 1, y: by, z: bz, typeId: BlockType.OBSIDIAN });
    // Top
    blocks.push({ x: bx, y: by + 4, z: bz, typeId: BlockType.OBSIDIAN });
    blocks.push({ x: bx + 1, y: by + 4, z: bz, typeId: BlockType.OBSIDIAN });
    // Left pillar
    for (let h = 0; h <= 4; h++) blocks.push({ x: bx - 1, y: by + h, z: bz, typeId: BlockType.OBSIDIAN });
    // Right pillar
    for (let h = 0; h <= 4; h++) blocks.push({ x: bx + 2, y: by + h, z: bz, typeId: BlockType.OBSIDIAN });

    // 4. Fill with portal blocks
    for (let h = 1; h <= 3; h++) {
        blocks.push({ x: bx, y: by + h, z: bz, typeId: BlockType.NETHER_PORTAL_BLOCK });
        blocks.push({ x: bx + 1, y: by + h, z: bz, typeId: BlockType.NETHER_PORTAL_BLOCK });
    }

    // Place all blocks at once!
    s.addBlocks(blocks);
}
