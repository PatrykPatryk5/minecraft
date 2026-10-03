/**
 * Procedural Sound System (Enhanced)
 *
 * Generates all Minecraft-style sound effects using Web Audio API.
 * No external files needed — everything is synthesized.
 *
 * Sound categories:
 *   - Block: break, place, dig (sustained), fall
 *   - Movement: step, swim, splash, land
 *   - UI: click, open, close, craft, levelup
 *   - Combat: hurt, eat, burp
 *   - Ambient: wind, cave, birds (looping)
 *   - Music: gentle procedural ambient pads
 *   - Weather: rain loop, thunder crashes
 */

import useGameStore from '../store/gameStore';

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let ambienceGain: GainNode | null = null;
let discGain: GainNode | null = null;
let outputCompressor: DynamicsCompressorNode | null = null;
const currentDiscSources = new Set<AudioBufferSourceNode>();
const currentDiscOscillators = new Set<OscillatorNode>();

// Environmental filters
let environmentalFilter: BiquadFilterNode | null = null;
let reverbNode: ConvolverNode | null = null;
let reverbGain: GainNode | null = null;
let dryGain: GainNode | null = null;

function getCtx(): AudioContext {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const settings = useGameStore.getState().settings;

        // Filter chain: ... -> environmentalFilter -> masterGain -> destination
        environmentalFilter = audioCtx.createBiquadFilter();
        environmentalFilter.type = 'lowpass';
        environmentalFilter.frequency.value = 20000; // Open by default

        masterGain = audioCtx.createGain();
        masterGain.gain.value = settings.soundVolume * 0.625;

        outputCompressor = audioCtx.createDynamicsCompressor();
        outputCompressor.threshold.value = -8;
        outputCompressor.knee.value = 8;
        outputCompressor.ratio.value = 4;
        outputCompressor.attack.value = 0.003;
        outputCompressor.release.value = 0.16;

        // Reverb setup (wet/dry)
        dryGain = audioCtx.createGain();
        dryGain.gain.value = 1.0;

        reverbGain = audioCtx.createGain();
        reverbGain.gain.value = 0.0;

        reverbNode = audioCtx.createConvolver();
        // Create a simple procedural impulse response for "cave" reverb
        const pulseLen = audioCtx.sampleRate * 2.0;
        const pulseBuf = audioCtx.createBuffer(2, pulseLen, audioCtx.sampleRate);
        for (let c = 0; c < 2; c++) {
            const data = pulseBuf.getChannelData(c);
            for (let i = 0; i < pulseLen; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / pulseLen, 2);
            }
        }
        reverbNode.buffer = pulseBuf;

        environmentalFilter.connect(dryGain).connect(masterGain);
        environmentalFilter.connect(reverbNode).connect(reverbGain).connect(masterGain);

        masterGain.connect(outputCompressor);

        musicGain = audioCtx.createGain();
        musicGain.gain.value = settings.musicVolume * 0.5;
        musicGain.connect(outputCompressor);

        ambienceGain = audioCtx.createGain();
        ambienceGain.gain.value = settings.musicVolume * (2 / 3);
        ambienceGain.connect(outputCompressor);

        discGain = audioCtx.createGain();
        discGain.gain.value = Math.min(1, settings.musicVolume * (4 / 3));
        discGain.connect(outputCompressor);
        outputCompressor.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

/** Update environmental effects based on player location */
export function updateEnvironment(underwater: boolean, inCave: boolean): void {
    if (!audioCtx || !environmentalFilter || !reverbGain) return;
    const now = audioCtx.currentTime;

    // Low pass filter if underwater (muffled sounds)
    const targetFreq = underwater ? 800 : 20000;
    environmentalFilter.frequency.setTargetAtTime(targetFreq, now, 0.1);

    // Reverb if in cave
    const targetReverb = inCave ? 0.4 : 0.0;
    reverbGain.gain.setTargetAtTime(targetReverb, now, 0.2);

    // Dry gain adjustment to keep volume consistent
    if (dryGain) dryGain.gain.setTargetAtTime(inCave ? 0.7 : 1.0, now, 0.2);
}

// ─── Volume Control ──────────────────────────────────────
export function setSoundVolume(v: number): void {
    if (audioCtx && masterGain) {
        masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.625, audioCtx.currentTime, 0.02);
    }
}
export function setMusicVolume(v: number): void {
    if (!audioCtx) return;
    const volume = Math.max(0, Math.min(1, v));
    const now = audioCtx.currentTime;
    musicGain?.gain.setTargetAtTime(volume * 0.5, now, 0.02);
    ambienceGain?.gain.setTargetAtTime(volume * (2 / 3), now, 0.02);
    discGain?.gain.setTargetAtTime(Math.min(1, volume * (4 / 3)), now, 0.02);
}

// ─── Noise Helpers ───────────────────────────────────────
function createNoise(ctx: AudioContext, duration: number): AudioBufferSourceNode {
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr * duration, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
}

function createTone(ctx: AudioContext, freq: number, duration: number, type: OscillatorType = 'sine'): OscillatorNode {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq;
    osc.type = type;
    return osc;
}

// ─── Sound Types ─────────────────────────────────────────
export type SoundType =
    | 'break' | 'place' | 'dig' | 'step' | 'click'
    | 'hurt' | 'eat' | 'burp' | 'craft'
    | 'fall' | 'swim' | 'splash' | 'land'
    | 'open' | 'close' | 'levelup'
    | 'explode' | 'bow' | 'pop' | 'fuse'
    | 'anvil' | 'xp' | 'fireball' | 'portal'
    | 'piston_out' | 'piston_in' | 'gravel' | 'roar'
    | 'grass_step' | 'stone_step' | 'wood_step' | 'sand_step' | 'slime_step';

// ─── 3D Audio Listener ───────────────────────────────────
export function updateListener(x: number, y: number, z: number, fx: number, fy: number, fz: number): void {
    if (!audioCtx) return;
    const l = audioCtx.listener;
    if (l.positionX) {
        l.positionX.value = x; l.positionY.value = y; l.positionZ.value = z;
        l.forwardX.value = fx; l.forwardY.value = fy; l.forwardZ.value = fz;
        l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else {
        // Fallback for older browsers
        l.setPosition(x, y, z);
        l.setOrientation(fx, fy, fz, 0, 1, 0);
    }
}

export function playSound(type: SoundType, pos?: [number, number, number]): void {
    try {
        const ctx = getCtx();
        if (!masterGain) return;
        const mg = masterGain;
        const now = ctx.currentTime;

        let output: AudioNode = mg;
        if (pos) {
            const panner = ctx.createPanner();
            panner.panningModel = 'HRTF';
            panner.distanceModel = 'exponential';
            panner.refDistance = 10;
            panner.maxDistance = 100;
            panner.rolloffFactor = 1;
            panner.positionX.value = pos[0];
            panner.positionY.value = pos[1];
            panner.positionZ.value = pos[2];
            panner.connect(mg);
            output = panner;
        }

        switch (type) {
            case 'break': {
                // Crunchy block break with pitch variation
                const noise = createNoise(ctx, 0.2);
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = 800 + Math.random() * 600;
                filter.Q.value = 2;
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.6, now);
                env.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
                noise.connect(filter).connect(env).connect(output);
                // Add a brief tone for "crunch"
                const osc = createTone(ctx, 200 + Math.random() * 100, 0.1, 'square');
                const tEnv = ctx.createGain();
                tEnv.gain.setValueAtTime(0.15, now);
                tEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                osc.connect(tEnv).connect(output);
                osc.start(now); osc.stop(now + 0.1);
                noise.start(now); noise.stop(now + 0.2);
                break;
            }
            case 'place': {
                // Solid "thunk" with low resonance
                const osc = createTone(ctx, 150 + Math.random() * 50, 0.15, 'triangle');
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.5, now);
                env.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
                osc.connect(env).connect(output);
                // Impact noise
                const noise = createNoise(ctx, 0.08);
                const nEnv = ctx.createGain();
                nEnv.gain.setValueAtTime(0.2, now);
                nEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
                const lp = ctx.createBiquadFilter();
                lp.type = 'lowpass';
                lp.frequency.value = 600;
                noise.connect(lp).connect(nEnv).connect(output);
                osc.start(now); osc.stop(now + 0.15);
                noise.start(now); noise.stop(now + 0.08);
                break;
            }
            case 'dig': {
                // Sustained scraping sound
                const noise = createNoise(ctx, 0.12);
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = 1200 + Math.random() * 400;
                filter.Q.value = 3;
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.25, now);
                env.gain.exponentialRampToValueAtTime(0.05, now + 0.1);
                noise.connect(filter).connect(env).connect(output);
                noise.start(now); noise.stop(now + 0.12);
                break;
            }
            case 'step':
            case 'grass_step': {
                // Soft grass footstep
                const noise = createNoise(ctx, 0.1);
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass'; filter.frequency.value = 400 + Math.random() * 300;
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.15 + Math.random() * 0.1, now);
                env.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                noise.connect(filter).connect(env).connect(output);
                noise.start(now); noise.stop(now + 0.1);
                break;
            }
            case 'stone_step': {
                // Hard crisp tap
                const osc = createTone(ctx, 300 + Math.random() * 100, 0.05, 'triangle');
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.2, now);
                env.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

                const noise = createNoise(ctx, 0.05);
                const lp = ctx.createBiquadFilter();
                lp.type = 'highpass'; lp.frequency.value = 800;
                noise.connect(lp).connect(env).connect(output);

                osc.connect(env).connect(output);
                osc.start(now); osc.stop(now + 0.05);
                noise.start(now); noise.stop(now + 0.05);
                break;
            }
            case 'wood_step': {
                // Hollow thud
                const osc = createTone(ctx, 150 + Math.random() * 50, 0.1, 'square');
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.15, now);
                env.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass'; filter.frequency.value = 400;
                osc.connect(filter).connect(env).connect(output);
                osc.start(now); osc.stop(now + 0.1);
                break;
            }
            case 'sand_step': {
                // Soft scratch
                const noise = createNoise(ctx, 0.12);
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass'; filter.frequency.value = 600 + Math.random() * 200;
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.2, now);
                env.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                noise.connect(filter).connect(env).connect(output);
                noise.start(now); noise.stop(now + 0.12);
                break;
            }
            case 'slime_step': {
                // Squishy bounce
                const osc = createTone(ctx, 400 + Math.random() * 100, 0.15, 'sine');
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.3, now);
                env.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
                osc.connect(env).connect(output);

                const noise = createNoise(ctx, 0.1);
                const lp = ctx.createBiquadFilter();
                lp.type = 'bandpass'; lp.frequency.value = 2000;
                const nEnv = ctx.createGain();
                nEnv.gain.setValueAtTime(0.1, now);
                nEnv.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
                noise.connect(lp).connect(nEnv).connect(output);

                osc.start(now); osc.stop(now + 0.15);
                noise.start(now); noise.stop(now + 0.1);
                break;
            }
            case 'click': {
                // Short UI click
                const osc = createTone(ctx, 1000, 0.04, 'sine');
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.25, now);
                env.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
                osc.connect(env).connect(output);
                osc.start(now); osc.stop(now + 0.04);
                break;
            }
            case 'hurt': {
                // Pain sound — descending tone
                const osc = createTone(ctx, 400, 0.2, 'sawtooth');
                osc.frequency.exponentialRampToValueAtTime(150, now + 0.2);
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.4, now);
                env.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass'; filter.frequency.value = 800;
                osc.connect(filter).connect(env).connect(output);
                osc.start(now); osc.stop(now + 0.22);
                break;
            }
            case 'eat': {
                // Munching sound (repeated noise bursts)
                for (let i = 0; i < 3; i++) {
                    const noise = createNoise(ctx, 0.06);
                    const filter = ctx.createBiquadFilter();
                    filter.type = 'bandpass'; filter.frequency.value = 600 + Math.random() * 400; filter.Q.value = 4;
                    const env = ctx.createGain();
                    const t = now + i * 0.1;
                    env.gain.setValueAtTime(0.2, t);
                    env.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
                    noise.connect(filter).connect(env).connect(output);
                    noise.start(t); noise.stop(t + 0.06);
                }
                break;
            }
            case 'burp': {
                // Low rumble
                const osc = createTone(ctx, 80, 0.3, 'sawtooth');
                osc.frequency.exponentialRampToValueAtTime(60, now + 0.3);
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.2, now);
                env.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
                osc.connect(env).connect(output);
                osc.start(now); osc.stop(now + 0.3);
                break;
            }
            case 'craft': {
                // Metallic ding
                const osc = createTone(ctx, 800, 0.15, 'sine');
                const osc2 = createTone(ctx, 1200, 0.15, 'sine');
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.3, now);
                env.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
                osc.connect(env).connect(output);
                osc2.connect(env);
                osc.start(now); osc.stop(now + 0.15);
                osc2.start(now); osc2.stop(now + 0.15);
                break;
            }
            case 'fall': {
                // Whooshing fall
                const noise = createNoise(ctx, 0.4);
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass'; filter.frequency.value = 300;
                filter.frequency.exponentialRampToValueAtTime(1500, now + 0.4);
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.02, now);
                env.gain.linearRampToValueAtTime(0.3, now + 0.3);
                env.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                noise.connect(filter).connect(env).connect(output);
                noise.start(now); noise.stop(now + 0.4);
                break;
            }
            case 'land': {
                // Heavy thump
                const osc = createTone(ctx, 60, 0.15, 'sine');
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.5, now);
                env.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
                osc.connect(env).connect(output);
                const noise = createNoise(ctx, 0.1);
                const lp = ctx.createBiquadFilter();
                lp.type = 'lowpass'; lp.frequency.value = 300;
                const nEnv = ctx.createGain();
                nEnv.gain.setValueAtTime(0.3, now);
                nEnv.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
                noise.connect(lp).connect(nEnv).connect(output);
                osc.start(now); osc.stop(now + 0.15);
                noise.start(now); noise.stop(now + 0.1);
                break;
            }
            case 'swim': {
                // Bubbly water sound
                const noise = createNoise(ctx, 0.15);
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass'; filter.frequency.value = 400 + Math.random() * 200; filter.Q.value = 2;
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.15, now);
                env.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
                noise.connect(filter).connect(env).connect(output);
                noise.start(now); noise.stop(now + 0.15);
                break;
            }
            case 'splash': {
                // Big water splash
                const noise = createNoise(ctx, 0.5);
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass'; filter.frequency.value = 800;
                filter.frequency.exponentialRampToValueAtTime(200, now + 0.4);
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.5, now);
                env.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
                noise.connect(filter).connect(env).connect(output);
                noise.start(now); noise.stop(now + 0.5);
                break;
            }
            case 'open': {
                // Chest open (ascending)
                const osc = createTone(ctx, 200, 0.15, 'triangle');
                osc.frequency.exponentialRampToValueAtTime(400, now + 0.12);
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.3, now);
                env.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
                osc.connect(env).connect(output);
                osc.start(now); osc.stop(now + 0.15);
                break;
            }
            case 'close': {
                // Chest close (descending)
                const osc = createTone(ctx, 350, 0.12, 'triangle');
                osc.frequency.exponentialRampToValueAtTime(180, now + 0.1);
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.3, now);
                env.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.connect(env).connect(output);
                osc.start(now); osc.stop(now + 0.12);
                break;
            }
            case 'levelup': {
                // Ascending chime
                for (let i = 0; i < 4; i++) {
                    const osc = createTone(ctx, 400 + i * 200, 0.2, 'sine');
                    const env = ctx.createGain();
                    const t = now + i * 0.08;
                    env.gain.setValueAtTime(0.2, t);
                    env.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
                    osc.connect(env).connect(output);
                    osc.start(t); osc.stop(t + 0.2);
                }
                break;
            }
            case 'xp': {
                // XP orb pickup
                const osc = createTone(ctx, 600 + Math.random() * 400, 0.1, 'sine');
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.15, now);
                env.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                osc.connect(env).connect(output);
                osc.start(now); osc.stop(now + 0.1);
                break;
            }
            case 'explode': {
                // Explosion!
                const noise = createNoise(ctx, 0.8);
                const lp = ctx.createBiquadFilter();
                lp.type = 'lowpass'; lp.frequency.value = 600;
                lp.frequency.exponentialRampToValueAtTime(100, now + 0.7);
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.7, now);
                env.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
                noise.connect(lp).connect(env).connect(output);
                // Bass thump
                const bass = createTone(ctx, 40, 0.3, 'sine');
                const bEnv = ctx.createGain();
                bEnv.gain.setValueAtTime(0.5, now);
                bEnv.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
                bass.connect(bEnv).connect(output);
                noise.start(now); noise.stop(now + 0.8);
                bass.start(now); bass.stop(now + 0.3);
                break;
            }
            case 'bow': {
                // Bow release twang
                const osc = createTone(ctx, 300, 0.2, 'sawtooth');
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.25, now);
                env.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
                const hp = ctx.createBiquadFilter();
                hp.type = 'highpass'; hp.frequency.value = 200;
                osc.connect(hp).connect(env).connect(output);
                osc.start(now); osc.stop(now + 0.2);
                break;
            }
            case 'pop': {
                // Item pop (pickup)
                const osc = createTone(ctx, 500, 0.08, 'sine');
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.06);
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.2, now);
                env.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
                osc.connect(env).connect(output);
                osc.start(now); osc.stop(now + 0.08);
                break;
            }
            case 'anvil': {
                // Heavy metallic clang
                const freq = 200;
                const osc1 = createTone(ctx, freq, 0.4, 'square');
                const osc2 = createTone(ctx, freq * 2.76, 0.3, 'sine');
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.4, now);
                env.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
                osc1.connect(env).connect(output);
                osc2.connect(env);
                osc1.start(now); osc1.stop(now + 0.4);
                osc2.start(now); osc2.stop(now + 0.3);
                break;
            }
            case 'fireball': {
                // Whoosh + high pitch crackle
                const noise = createNoise(ctx, 0.5);
                const filter = ctx.createBiquadFilter();
                filter.type = 'highpass'; filter.frequency.value = 400;
                filter.frequency.linearRampToValueAtTime(100, now + 0.4);
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.3, now);
                env.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                noise.connect(filter).connect(env).connect(output);
                noise.start(now); noise.stop(now + 0.5);
                break;
            }
            case 'portal': {
                // Mystical shimmering
                const osc = createTone(ctx, 100 + Math.random() * 50, 1.5, 'sine');
                const osc2 = createTone(ctx, 150 + Math.random() * 50, 1.5, 'sine');
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.1, now + 0.2);
                gain.gain.linearRampToValueAtTime(0, now + 1.5);
                // LFO for shimmer
                const lfo = ctx.createOscillator();
                lfo.frequency.value = 5;
                const lfoGain = ctx.createGain();
                lfoGain.gain.value = 50;
                lfo.connect(lfoGain).connect(osc.frequency);
                lfo.start(now); lfo.stop(now + 1.5);

                osc.connect(gain).connect(output);
                osc2.connect(gain);
                osc.start(now); osc.stop(now + 1.5);
                osc2.start(now); osc2.stop(now + 1.5);
                break;
            }
            case 'piston_out': {
                // Mechanical extend
                const osc = createTone(ctx, 150, 0.15, 'sawtooth');
                osc.frequency.linearRampToValueAtTime(250, now + 0.15);
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.3, now);
                env.gain.linearRampToValueAtTime(0, now + 0.15);
                osc.connect(env).connect(output);
                osc.start(now); osc.stop(now + 0.2);
                break;
            }
            case 'piston_in': {
                // Mechanical retract
                const osc = createTone(ctx, 250, 0.15, 'sawtooth');
                osc.frequency.linearRampToValueAtTime(150, now + 0.15);
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.3, now);
                env.gain.linearRampToValueAtTime(0, now + 0.15);
                osc.connect(env).connect(mg);
                osc.start(now); osc.stop(now + 0.2);
                break;
            }
            case 'gravel': {
                // Gritty noise for farming/digging
                const noise = createNoise(ctx, 0.15);
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = 400 + Math.random() * 200;
                filter.Q.value = 1;
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.4, now);
                env.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
                noise.connect(filter).connect(env).connect(output);
                noise.start(now); noise.stop(now + 0.15);
                break;
            }
            case 'roar': {
                // Dragon roar — deep saw + noise
                const osc = createTone(ctx, 100, 2.0, 'sawtooth');
                osc.frequency.exponentialRampToValueAtTime(50, now + 1.5);
                const noise = createNoise(ctx, 2.0);
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass'; filter.frequency.value = 400;
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.6, now);
                env.gain.exponentialRampToValueAtTime(0.01, now + 1.8);
                osc.connect(env).connect(output);
                noise.connect(filter).connect(env).connect(output);
                osc.start(now); osc.stop(now + 2.0);
                noise.start(now); noise.stop(now + 2.0);
                break;
            }
            case 'fuse': {
                // TNT Fuse — hissing noise
                const noise = createNoise(ctx, 4.0);
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass'; filter.frequency.value = 1000; filter.Q.value = 1;
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.2, now);
                env.gain.linearRampToValueAtTime(0.4, now + 3.5); // Rising intensity
                env.gain.linearRampToValueAtTime(0, now + 4.0);
                noise.connect(filter).connect(env).connect(output);
                noise.start(now); noise.stop(now + 4.0);
                break;
            }
        }
    } catch {
        // Audio not available
    }
}

// ─── Ambient Sound System ────────────────────────────────
let ambienceActive = false;
let ambienceTimer: ReturnType<typeof setInterval> | null = null;
let rainSource: AudioBufferSourceNode | null = null;
let rainGain: GainNode | null = null;

export function updateWeatherAudio(type: 'clear' | 'rain' | 'thunder', intensity: number): void {
    try {
        const ctx = getCtx();
        if (!ambienceGain) return;

        if (type === 'clear' || intensity <= 0) {
            if (rainGain) rainGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
            return;
        }

        if (!rainSource) {
            const sr = ctx.sampleRate;
            const buf = ctx.createBuffer(1, sr * 2, sr);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

            rainSource = ctx.createBufferSource();
            rainSource.buffer = buf;
            rainSource.loop = true;

            rainGain = ctx.createGain();
            rainGain.gain.value = 0;

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 800;

            rainSource.connect(filter).connect(rainGain).connect(ambienceGain);
            rainSource.start();
        }

        if (rainGain) {
            const targetVol = type === 'thunder' ? intensity * 0.35 : intensity * 0.2;
            rainGain.gain.setTargetAtTime(targetVol, ctx.currentTime, 0.5);
        }
    } catch { /* ignore */ }
}

let windSource: AudioBufferSourceNode | null = null;
let windGain: GainNode | null = null;

export function updateWindAudio(altitude: number, weatherIntensity: number): void {
    try {
        const ctx = getCtx();
        if (!ambienceGain) return;

        if (!windSource) {
            const sr = ctx.sampleRate;
            const buf = ctx.createBuffer(1, sr * 3, sr);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

            windSource = ctx.createBufferSource();
            windSource.buffer = buf;
            windSource.loop = true;

            windGain = ctx.createGain();
            windGain.gain.value = 0;

            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 400;
            filter.Q.value = 0.5;

            windSource.connect(filter).connect(windGain).connect(ambienceGain);
            windSource.start();
        }

        if (windGain) {
            // Wind is louder at high altitude and during storms
            const altFactor = Math.max(0, (altitude - 80) / 100);
            const targetVol = 0.02 + (altFactor * 0.08) + (weatherIntensity * 0.1);
            windGain.gain.setTargetAtTime(targetVol, ctx.currentTime, 1.0);
        }
    } catch { /* ignore */ }
}

export function startAmbience(): void {
    if (ambienceActive) return;
    ambienceActive = true;

    ambienceTimer = setInterval(() => {
        try {
            const ctx = getCtx();
            if (!ambienceGain) return;

            const s = useGameStore.getState();
            const weather = s.weather;
            const intensity = s.weatherIntensity;
            const playerPos = s.playerPos;
            const time = s.dayTime;

            updateWeatherAudio(weather, intensity);
            updateWindAudio(playerPos[1], intensity);

            const isNight = time > 0.75 || time < 0.25;
            const isUnderground = playerPos[1] < 40;

            const r = Math.random();
            if (weather === 'thunder' && Math.random() < 0.25) {
                // Thunder crash
                playSound('explode', [
                    (Math.random() - 0.5) * 400,
                    150,
                    (Math.random() - 0.5) * 400
                ]);
            } else if (isUnderground && r < 0.1) {
                // Cave eerie sound
                const freq = 100 + Math.random() * 100;
                const osc = createTone(ctx, freq, 2, 'sine');
                const env = ctx.createGain();
                env.gain.setValueAtTime(0, ctx.currentTime);
                env.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 1);
                env.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
                osc.connect(env).connect(ambienceGain);
                osc.start(); osc.stop(ctx.currentTime + 2);
            } else if (!isUnderground && !isNight && weather === 'clear' && r < 0.12) {
                // Bird chirp (Only day, clear sky, surface)
                const base = 1200 + Math.random() * 1000;
                const osc = createTone(ctx, base, 0.2, 'sine');
                osc.frequency.exponentialRampToValueAtTime(base + 500, ctx.currentTime + 0.1);
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.03, ctx.currentTime);
                env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
                osc.connect(env).connect(ambienceGain);
                osc.start(); osc.stop(ctx.currentTime + 0.2);
            } else if (isUnderground && r < 0.05) {
                // Drip
                const osc = createTone(ctx, 3000 + Math.random() * 1000, 0.05, 'sine');
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.02, ctx.currentTime);
                env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
                osc.connect(env).connect(ambienceGain);
                osc.start(); osc.stop(ctx.currentTime + 0.06);
            }
        } catch { /* ignore */ }
    }, 2000);
}

export function stopAmbience(): void {
    ambienceActive = false;
    if (ambienceTimer) { clearInterval(ambienceTimer); ambienceTimer = null; }
}

// ─── Procedural Music ────────────────────────────────────
let musicActive = false;
let musicTimer: ReturnType<typeof setInterval> | null = null;

export function startMusic(): void {
    if (musicActive) return;
    musicActive = true;

    const notes = [261, 293, 329, 349, 392, 440, 493, 523]; // C4 to C5
    const pentatonic = [261, 293, 329, 392, 440]; // C D E G A

    musicTimer = setInterval(() => {
        try {
            const ctx = getCtx();
            if (!musicGain) return;

            const freq = pentatonic[Math.floor(Math.random() * pentatonic.length)];
            const octave = Math.random() > 0.5 ? 0.5 : 1;

            const osc = createTone(ctx, freq * octave, 2, 'sine');
            const osc2 = createTone(ctx, freq * octave * 1.5, 2, 'sine'); // Fifth
            const env = ctx.createGain();
            env.gain.setValueAtTime(0, ctx.currentTime);
            env.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.5);
            env.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.8);

            const reverb = ctx.createBiquadFilter();
            reverb.type = 'lowpass'; reverb.frequency.value = 800;

            osc.connect(reverb).connect(env).connect(musicGain);
            osc2.connect(env);
            osc.start(); osc.stop(ctx.currentTime + 2);
            osc2.start(); osc2.stop(ctx.currentTime + 2);
        } catch { /* ignore */ }
    }, 2500 + Math.random() * 3000);
}

export function stopMusic(): void {
    musicActive = false;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}

// ─── Music Discs (Procedural Tracks) ─────────────────────
type MusicDiscTrack = 'muzo' | 'retro' | 'creepy' | 'chill' | 'disco' | 'ambient' | 'techno' | 'synth' | 'orbit' | 'ember' | 'rainroom' | 'glitch';

function trackDiscOscillator(osc: OscillatorNode): void {
    currentDiscOscillators.add(osc);
    osc.addEventListener('ended', () => currentDiscOscillators.delete(osc), { once: true });
}

function trackDiscSource(source: AudioBufferSourceNode): void {
    currentDiscSources.add(source);
    source.addEventListener('ended', () => currentDiscSources.delete(source), { once: true });
}

function scheduleDiscNote(
    ctx: AudioContext,
    output: AudioNode,
    frequency: number,
    time: number,
    duration: number,
    waveform: OscillatorType,
    volume: number,
): void {
    const osc = createTone(ctx, frequency, duration, waveform);
    const envelope = ctx.createGain();
    const attack = Math.min(0.08, duration * 0.25);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(volume, time + attack);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(envelope).connect(output);
    osc.start(time);
    osc.stop(time + duration);
    trackDiscOscillator(osc);
}

export function stopMusicDisc(): void {
    currentDiscSources.forEach((source) => {
        try { source.stop(); } catch { /* already ended */ }
    });
    currentDiscOscillators.forEach(osc => {
        try { osc.stop(); } catch { /* already ended */ }
    });
    currentDiscSources.clear();
    currentDiscOscillators.clear();
}

export function playMusicDisc(track: MusicDiscTrack): void {
    stopMusicDisc();
    const ctx = getCtx();
    if (!discGain) return;
    const gain = discGain; // Local variable for TS inference

    if (track === 'muzo') {
        // "Muzo" track: Happy bouncy pentatonic melody (Lengthened)
        const tempo = 0.4;
        const notes = [440, 493, 523, 587, 659, 739, 880]; // A4 B4 C5 D5 E5 F#5 A5
        for (let i = 0; i < 128; i++) {
            const time = ctx.currentTime + i * tempo;
            const freq = notes[Math.floor(Math.random() * notes.length)];
            const type = i % 8 === 0 ? 'triangle' : 'sine';
            const osc = createTone(ctx, freq, 0.4, type as OscillatorType);
            const env = ctx.createGain();
            env.gain.setValueAtTime(0, time);
            env.gain.linearRampToValueAtTime(0.08, time + 0.05);
            env.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
            osc.connect(env).connect(gain);
            osc.start(time); osc.stop(time + 0.4);
            trackDiscOscillator(osc);

            // Bass support
            if (i % 4 === 0) {
                const bassOsc = createTone(ctx, freq / 2, 0.8, 'sine');
                const bassEnv = ctx.createGain();
                bassEnv.gain.setValueAtTime(0, time);
                bassEnv.gain.linearRampToValueAtTime(0.05, time + 0.1);
                bassEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.7);
                bassOsc.connect(bassEnv).connect(gain);
                bassOsc.start(time); bassOsc.stop(time + 0.8);
                trackDiscOscillator(bassOsc);
            }
        }
    } else if (track === 'retro') {
        // "Retro" track: Deep bass + square wave lead (Lengthened)
        const tempo = 0.5;
        const bassNotes = [110, 130, 98, 87, 110, 146, 164, 123];
        for (let i = 0; i < 80; i++) {
            const time = ctx.currentTime + i * tempo;
            const freq = bassNotes[Math.floor(i / 2) % bassNotes.length];
            const osc = createTone(ctx, freq, 0.6, 'square');
            const env = ctx.createGain();
            env.gain.setValueAtTime(0, time);
            env.gain.linearRampToValueAtTime(0.07, time + 0.1);
            env.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
            osc.connect(env).connect(gain);
            osc.start(time); osc.stop(time + 0.6);
            trackDiscOscillator(osc);

            // Arpeggio lead
            const arpNotes = [freq * 2, freq * 3, freq * 4, freq * 2.5];
            const tOffset = (i % 4) * (tempo / 4);
            const leadOsc = createTone(ctx, arpNotes[i % 4], 0.2, 'sawtooth');
            const leadEnv = ctx.createGain();
            leadEnv.gain.setValueAtTime(0, time + tOffset);
            leadEnv.gain.linearRampToValueAtTime(0.02, time + tOffset + 0.05);
            leadEnv.gain.exponentialRampToValueAtTime(0.001, time + tOffset + 0.15);
            leadOsc.connect(leadEnv).connect(gain);
            leadOsc.start(time + tOffset); leadOsc.stop(time + tOffset + 0.2);
            trackDiscOscillator(leadOsc);
        }
    } else if (track === 'creepy') {
        // "Creepy" track: Dark ambient / discordant (New)
        const steps = 40;
        for (let i = 0; i < steps; i++) {
            const time = ctx.currentTime + i * 1.5;
            const baseFreq = 50 + Math.random() * 100;
            // Dissonant clusters
            [1, 1.05, 1.414, 1.5].forEach(mult => {
                const osc = createTone(ctx, baseFreq * mult, 2.5, 'sine');
                const env = ctx.createGain();
                env.gain.setValueAtTime(0, time);
                env.gain.linearRampToValueAtTime(0.03, time + 1.0);
                env.gain.exponentialRampToValueAtTime(0.001, time + 2.5);
                osc.connect(env).connect(gain);
                osc.start(time); osc.stop(time + 3.0);
                trackDiscOscillator(osc);
            });
            // High pitch whistles
            if (i % 3 === 0) {
                const highOsc = createTone(ctx, 2000 + Math.random() * 3000, 1.0, 'sine');
                const highEnv = ctx.createGain();
                highEnv.gain.setValueAtTime(0, time + 0.5);
                highEnv.gain.linearRampToValueAtTime(0.01, time + 0.8);
                highEnv.gain.exponentialRampToValueAtTime(0.001, time + 1.5);
                highOsc.connect(highEnv).connect(gain);
                highOsc.start(time + 0.5); highOsc.stop(time + 2.0);
                trackDiscOscillator(highOsc);
            }
        }
    } else if (track === 'disco') {
        // "Disco" track: Funky syncopated bass and rhythmic noise (New)
        const tempo = 0.25;
        for (let i = 0; i < 120; i++) {
            const time = ctx.currentTime + i * tempo;
            // Bass
            if (i % 2 === 0) {
                const freq = [110, 130, 146, 164][(i / 8) % 4];
                const osc = createTone(ctx, freq, 0.2, 'triangle');
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.1, time);
                env.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
                osc.connect(env).connect(gain);
                osc.start(time); osc.stop(time + 0.2);
                trackDiscOscillator(osc);
            }
            // Percussive "snare" noise
            if (i % 4 === 2) {
                const noise = createNoise(ctx, 0.1);
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass'; filter.frequency.value = 1200;
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.03, time);
                env.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
                noise.connect(filter).connect(env).connect(gain);
                noise.start(time); noise.stop(time + 0.1);
                trackDiscSource(noise);
            }
        }
    } else if (track === 'ambient') {
        // "Ambient" track: Evolving lush pads (New)
        const tempo = 4.0;
        const notes = [261.63, 329.63, 392.00, 493.88, 523.25]; // C major family
        for (let i = 0; i < 20; i++) {
            const time = ctx.currentTime + i * tempo;
            const freq = notes[Math.floor(Math.random() * notes.length)];
            const osc = createTone(ctx, freq, tempo * 1.5, 'sine');
            const env = ctx.createGain();
            env.gain.setValueAtTime(0, time);
            env.gain.linearRampToValueAtTime(0.05, time + tempo / 2);
            env.gain.linearRampToValueAtTime(0, time + tempo * 1.2);
            osc.connect(env).connect(gain);
            osc.start(time); osc.stop(time + tempo * 1.5);
            trackDiscOscillator(osc);

            // Random high twinkles
            if (i % 2 === 0) {
                const hFreq = freq * 4;
                const hOsc = createTone(ctx, hFreq, 1.0, 'sine');
                const hEnv = ctx.createGain();
                hEnv.gain.setValueAtTime(0, time + 1.0);
                hEnv.gain.linearRampToValueAtTime(0.02, time + 1.2);
                hEnv.gain.exponentialRampToValueAtTime(0.001, time + 2.0);
                hOsc.connect(hEnv).connect(gain);
                hOsc.start(time + 1.0); hOsc.stop(time + 2.5);
                trackDiscOscillator(hOsc);
            }
        }
    } else if (track === 'techno') {
        // "Techno" track: Driving square lead and fast sub (New)
        const tempo = 0.15;
        for (let i = 0; i < 200; i++) {
            const time = ctx.currentTime + i * tempo;
            // Kick-like pulse
            if (i % 4 === 0) {
                const kick = createTone(ctx, 60, 0.1, 'sine');
                kick.frequency.exponentialRampToValueAtTime(30, time + 0.1);
                const kEnv = ctx.createGain();
                kEnv.gain.setValueAtTime(0.15, time);
                kEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
                kick.connect(kEnv).connect(gain);
                kick.start(time); kick.stop(time + 0.15);
                trackDiscOscillator(kick);
            }
            // Driving lead
            const notes = [220, 261, 293, 220];
            const osc = createTone(ctx, notes[(i / 4) % 4], 0.1, 'sawtooth');
            const env = ctx.createGain();
            env.gain.setValueAtTime(0.04, time);
            env.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass'; filter.frequency.value = 800 + Math.sin(i * 0.1) * 400;
            osc.connect(filter).connect(env).connect(gain);
            osc.start(time); osc.stop(time + 0.12);
            trackDiscOscillator(osc);
        }
    } else if (track === 'synth') {
        // "Synth" track: 80s chords and resonant sweeps (New)
        const tempo = 1.0;
        const chords = [
            [440, 554, 659], // A
            [349, 440, 523], // F
            [392, 493, 587], // G
            [329, 415, 493]  // E
        ];
        for (let i = 0; i < 40; i++) {
            const time = ctx.currentTime + i * tempo;
            const chord = chords[i % chords.length];
            chord.forEach((f) => {
                const osc = createTone(ctx, f, 1.2, 'sawtooth');
                const env = ctx.createGain();
                env.gain.setValueAtTime(0, time);
                env.gain.linearRampToValueAtTime(0.03, time + 0.1);
                env.gain.exponentialRampToValueAtTime(0.001, time + 0.9);
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass'; filter.frequency.value = 1500;
                osc.connect(filter).connect(env).connect(gain);
                osc.start(time); osc.stop(time + 1.2);
                trackDiscOscillator(osc);
            });
            // Gliding lead on top
            if (i % 2 === 0) {
                const lOsc = createTone(ctx, chord[1] * 2, 0.8, 'square');
                const lEnv = ctx.createGain();
                lEnv.gain.setValueAtTime(0, time + 0.2);
                lEnv.gain.linearRampToValueAtTime(0.02, time + 0.3);
                lEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.7);
                lOsc.connect(lEnv).connect(gain);
                lOsc.start(time + 0.2); lOsc.stop(time + 0.8);
                trackDiscOscillator(lOsc);
            }
        }
    } else if (track === 'chill') {
        // "Chill" track: Smooth synth pads (New)
        const tempo = 2.0;
        const chords = [
            [261, 329, 392, 493], // Cmaj7
            [349, 440, 523, 659], // Fmaj7
            [293, 349, 440, 587], // Dmin7
            [392, 493, 587, 783]  // G7
        ];
        for (let i = 0; i < 30; i++) {
            const time = ctx.currentTime + i * tempo;
            const chord = chords[i % chords.length];
            chord.forEach(freq => {
                const osc = createTone(ctx, freq, 2.5, 'triangle');
                const env = ctx.createGain();
                env.gain.setValueAtTime(0, time);
                env.gain.linearRampToValueAtTime(0.04, time + 0.5);
                env.gain.exponentialRampToValueAtTime(0.001, time + 2.0);
                osc.connect(env).connect(gain);
                osc.start(time); osc.stop(time + 3.0);
                trackDiscOscillator(osc);
            });
            // Soft melody on top
            if (i % 2 === 0) {
                const melFreq = chord[Math.floor(Math.random() * chord.length)] * 2;
                const melOsc = createTone(ctx, melFreq, 1.5, 'sine');
                const melEnv = ctx.createGain();
                melEnv.gain.setValueAtTime(0, time + 0.5);
                melEnv.gain.linearRampToValueAtTime(0.03, time + 1.0);
                melEnv.gain.exponentialRampToValueAtTime(0.001, time + 2.0);
                melOsc.connect(melEnv).connect(gain);
                melOsc.start(time + 0.5); melOsc.stop(time + 2.5);
                trackDiscOscillator(melOsc);
            }
        }
    } else if (track === 'orbit') {
        const scale = [392, 440, 523.25, 587.33, 659.25, 783.99, 880];
        const motif = [0, 2, 4, 5, 3, 6, 4, 2, 1, 3, 5, 4, 6, 3, 2, 4];
        const tempo = 0.3;
        for (let i = 0; i < 96; i++) {
            const time = ctx.currentTime + i * tempo;
            const note = scale[motif[i % motif.length]];
            scheduleDiscNote(ctx, gain, note, time, 0.26, 'triangle', 0.035);
            if (i % 8 === 0) {
                const bass = [98, 110, 130.81, 146.83][Math.floor(i / 8) % 4];
                scheduleDiscNote(ctx, gain, bass, time, 1.8, 'sine', 0.035);
            }
            if (i % 12 === 6) scheduleDiscNote(ctx, gain, note * 2, time + 0.08, 0.18, 'sine', 0.012);
        }
    } else if (track === 'ember') {
        const chords = [
            [110, 164.81, 220, 261.63],
            [98, 146.83, 196, 246.94],
            [130.81, 164.81, 196, 261.63],
            [87.31, 130.81, 174.61, 220],
        ];
        for (let bar = 0; bar < 10; bar++) {
            const time = ctx.currentTime + bar * 2.8;
            const chord = chords[bar % chords.length];
            chord.forEach((frequency, i) => {
                scheduleDiscNote(ctx, gain, frequency, time, 2.6, i === 0 ? 'sine' : 'triangle', 0.025);
            });
            const melody = chord[(bar * 3 + 1) % chord.length] * 2;
            scheduleDiscNote(ctx, gain, melody, time + 0.65, 0.55, 'sine', 0.026);
            scheduleDiscNote(ctx, gain, melody * 1.25, time + 1.65, 0.4, 'triangle', 0.018);
        }
    } else if (track === 'rainroom') {
        const scale = [174.61, 207.65, 261.63, 311.13, 349.23, 415.3];
        const pattern = [2, 5, 3, 1, 4, 2, 0, 3, 5, 4, 1, 2];
        for (let i = 0; i < 72; i++) {
            const time = ctx.currentTime + i * 0.4;
            const note = scale[pattern[i % pattern.length]];
            scheduleDiscNote(ctx, gain, note, time, 0.36, 'sine', 0.028);
            if (i % 6 === 0) scheduleDiscNote(ctx, gain, note * 2.01, time + 0.12, 0.7, 'sine', 0.012);
            if (i % 12 === 0) scheduleDiscNote(ctx, gain, scale[(i / 12) % scale.length] / 2, time, 1.4, 'triangle', 0.022);
        }
    } else if (track === 'glitch') {
        const scale = [130.81, 155.56, 196, 233.08, 261.63, 311.13, 392, 466.16];
        const pattern = [0, 4, 2, 6, 3, 7, 2, 5, 1, 6, 4, 3, 7, 2, 5, 0];
        const rhythm = [true, false, true, true, false, true, false, false];
        for (let i = 0; i < 128; i++) {
            const time = ctx.currentTime + i * 0.18;
            if (rhythm[i % rhythm.length]) {
                const note = scale[pattern[i % pattern.length]];
                scheduleDiscNote(ctx, gain, note, time, 0.14, i % 4 === 0 ? 'square' : 'sawtooth', 0.025);
            }
            if (i % 8 === 0) {
                const bass = scale[(i / 8 * 3) % scale.length] / 2;
                scheduleDiscNote(ctx, gain, bass, time, 0.3, 'square', 0.035);
            }
        }
    }
}
