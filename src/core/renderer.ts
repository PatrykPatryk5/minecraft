/**
 * Renderer Detection & Configuration
 *
 * Auto-detects the best available rendering backend:
 *   WebGPU → WebGL2 → WebGL (fallback)
 *
 * Exposes detected capabilities for the debug screen and settings.
 */

// WebGPU type declarations (not in standard lib yet)
declare global {
    interface Navigator {
        gpu?: {
            requestAdapter(): Promise<any | null>;
        };
    }
}

export type RendererType = 'webgpu' | 'webgl2' | 'webgl';

export interface RendererCapabilities {
    type: RendererType;
    label: string;
    maxTextureSize: number;
    maxDrawBuffers: number;
    floatTextures: boolean;
    instancedArrays: boolean;
    gpuName: string;
}

/** Detect WebGPU support */
async function hasWebGPU(): Promise<boolean> {
    if (!navigator.gpu) return false;
    try {
        const adapter = await navigator.gpu.requestAdapter();
        return adapter !== null;
    } catch {
        return false;
    }
}

/** Detect WebGL2 support */
function hasWebGL2(): boolean {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2');
        return gl !== null;
    } catch {
        return false;
    }
}

/** Detect WebGL1 support */
function hasWebGL(): boolean {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        return gl !== null;
    } catch {
        return false;
    }
}

/** Get GPU info from WebGL context */
function getGPUInfo(gl: WebGLRenderingContext | WebGL2RenderingContext): { gpuName: string; maxTextureSize: number; maxDrawBuffers: number; floatTextures: boolean; instancedArrays: boolean } {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const gpuName = debugInfo
        ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        : 'Unknown GPU';

    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

    let maxDrawBuffers = 1;
    if (gl instanceof WebGL2RenderingContext) {
        maxDrawBuffers = gl.getParameter(gl.MAX_DRAW_BUFFERS);
    } else {
        const ext = gl.getExtension('WEBGL_draw_buffers');
        if (ext) maxDrawBuffers = gl.getParameter(ext.MAX_DRAW_BUFFERS_WEBGL);
    }

    const floatTextures = !!(
        gl.getExtension('OES_texture_float') ||
        gl instanceof WebGL2RenderingContext
    );

    const instancedArrays = !!(
        gl.getExtension('ANGLE_instanced_arrays') ||
        gl instanceof WebGL2RenderingContext
    );

    return { gpuName, maxTextureSize, maxDrawBuffers, floatTextures, instancedArrays };
}

/** Detect best renderer and capabilities */
export async function detectRenderer(): Promise<RendererCapabilities> {
    // Try WebGL2 first for capability detection (used even with WebGPU)
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    const gl1 = !gl2 ? (canvas.getContext('webgl') as WebGLRenderingContext | null) : null;
    const gl = gl2 || gl1;

    const gpuInfo = gl
        ? getGPUInfo(gl)
        : { gpuName: 'Unknown', maxTextureSize: 4096, maxDrawBuffers: 1, floatTextures: false, instancedArrays: false };

    // Check WebGPU
    const webgpu = await hasWebGPU();
    if (webgpu) {
        return {
            type: 'webgpu',
            label: 'WebGPU',
            ...gpuInfo,
        };
    }

    // WebGL2
    if (gl2) {
        return {
            type: 'webgl2',
            label: 'WebGL 2.0',
            ...gpuInfo,
        };
    }

    // WebGL1 fallback
    if (gl1) {
        return {
            type: 'webgl',
            label: 'WebGL 1.0',
            ...gpuInfo,
        };
    }

    // No GPU support at all
    return {
        type: 'webgl',
        label: 'WebGL (fallback)',
        gpuName: 'None detected',
        maxTextureSize: 2048,
        maxDrawBuffers: 1,
        floatTextures: false,
        instancedArrays: false,
    };
}

/** Singleton cache */
let cachedCaps: RendererCapabilities | null = null;

export async function getRendererCaps(): Promise<RendererCapabilities> {
    if (!cachedCaps) {
        cachedCaps = await detectRenderer();
    }
    return cachedCaps;
}

export function getCachedRendererCaps(): RendererCapabilities | null {
    return cachedCaps;
}
