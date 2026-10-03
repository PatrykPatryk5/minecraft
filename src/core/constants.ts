/**
 * Global Constants & Uniforms
 */

import { uniform } from 'three/tsl';

export const globalTerrainUniforms = {
    // Shared TSL uniform keeps animated terrain on both WebGPU and WebGL2.
    uTime: uniform(0),
};
