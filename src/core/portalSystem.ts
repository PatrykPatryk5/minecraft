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
                    for (let h = 1; h <= 3; h++) {
                        s.addBlock(bx, y + h, bz, BlockType.NETHER_PORTAL_BLOCK);
                        s.addBlock(bx + dx, y + h, bz + dz, BlockType.NETHER_PORTAL_BLOCK);
                    }
                    playSound('fuse'); // we don't have portal ignite specifically yet, fuse is fine
                    // Bump version? s.addBlock does it if we update gameStore, but we should manually bump chunks if they span borders.
                    // For now, simple useGameStore will update the chunks eventually.
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
    const dx = 1;
    const dz = 0;

    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);

    // 1. Build a 4x4 platform under the portal for safety
    for (let ox = -1; ox <= 2; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
            const current = s.getBlock(bx + ox, by - 1, bz + oz);
            if (current === BlockType.AIR || current === BlockType.LAVA || current === BlockType.WATER) {
                s.addBlock(bx + ox, by - 1, bz + oz, BlockType.OBSIDIAN);
            }
        }
    }

    // 2. Clear interior (4x5 area)
    for (let ox = -1; ox <= 2; ox++) {
        for (let dy = 0; dy <= 4; dy++) {
            for (let oz = -1; oz <= 1; oz++) {
                s.addBlock(bx + ox, by + dy, bz + oz, BlockType.AIR);
            }
        }
    }

    // 3. Build typical 4x5 Frame
    // Bottom
    s.addBlock(bx, by, bz, BlockType.OBSIDIAN);
    s.addBlock(bx + 1, by, bz, BlockType.OBSIDIAN);
    // Top
    s.addBlock(bx, by + 4, bz, BlockType.OBSIDIAN);
    s.addBlock(bx + 1, by + 4, bz, BlockType.OBSIDIAN);
    // Left pillar
    for (let h = 0; h <= 4; h++) s.addBlock(bx - 1, by + h, bz, BlockType.OBSIDIAN);
    // Right pillar
    for (let h = 0; h <= 4; h++) s.addBlock(bx + 2, by + h, bz, BlockType.OBSIDIAN);

    // 4. Fill with portal blocks
    for (let h = 1; h <= 3; h++) {
        s.addBlock(bx, by + h, bz, BlockType.NETHER_PORTAL_BLOCK);
        s.addBlock(bx + 1, by + h, bz, BlockType.NETHER_PORTAL_BLOCK);
    }
}
