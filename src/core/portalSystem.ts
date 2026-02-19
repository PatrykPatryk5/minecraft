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

export function buildNetherPortalSafe(x: number, y: number, z: number): void {
    const s = useGameStore.getState();
    const dx = 1;
    const dz = 0;

    // Clear area & build frame
    for (let offsetX = -1; offsetX <= 2; offsetX++) {
        for (let dy = -1; dy <= 4; dy++) {
            for (let offsetZ = -1; offsetZ <= 1; offsetZ++) {
                s.addBlock(x + offsetX, y + dy, z + offsetZ, BlockType.AIR);
            }
        }
    }

    // Bottom and top
    s.addBlock(x, y - 1, z, BlockType.OBSIDIAN);
    s.addBlock(x + 1, y - 1, z, BlockType.OBSIDIAN);
    s.addBlock(x, y + 3, z, BlockType.OBSIDIAN);
    s.addBlock(x + 1, y + 3, z, BlockType.OBSIDIAN);

    // Sides
    for (let h = 0; h <= 2; h++) {
        s.addBlock(x - 1, y + h, z, BlockType.OBSIDIAN);
        s.addBlock(x + 2, y + h, z, BlockType.OBSIDIAN);
        // Interior
        s.addBlock(x, y + h, z, BlockType.NETHER_PORTAL_BLOCK);
        s.addBlock(x + 1, y + h, z, BlockType.NETHER_PORTAL_BLOCK);
    }
}
