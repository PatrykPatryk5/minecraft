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
 */

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let ambienceGain: GainNode | null = null;

function getCtx(): AudioContext {
    if (!audioCtx) {
        audioCtx = new AudioContext();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.5;
        masterGain.connect(audioCtx.destination);
        musicGain = audioCtx.createGain();
        musicGain.gain.value = 0.15;
        musicGain.connect(audioCtx.destination);
        ambienceGain = audioCtx.createGain();
        ambienceGain.gain.value = 0.2;
        ambienceGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

// ─── Volume Control ──────────────────────────────────────
export function setSoundVolume(v: number): void {
    if (masterGain) masterGain.gain.value = v;
}
export function setMusicVolume(v: number): void {
    if (musicGain) musicGain.gain.value = v * 0.3;
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
    | 'grass_step' | 'stone_step' | 'wood_step' | 'sand_step';

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

export function startAmbience(): void {
    if (ambienceActive) return;
    ambienceActive = true;

    ambienceTimer = setInterval(() => {
        try {
            const ctx = getCtx();
            if (!ambienceGain) return;

            // Random ambient sounds
            const r = Math.random();
            if (r < 0.05) {
                // Cave drip
                const osc = createTone(ctx, 2000 + Math.random() * 2000, 0.1, 'sine');
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.03, ctx.currentTime);
                env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
                osc.connect(env).connect(ambienceGain);
                osc.start(); osc.stop(ctx.currentTime + 0.1);
            } else if (r < 0.08) {
                // Bird chirp
                const osc = createTone(ctx, 1500 + Math.random() * 1500, 0.15, 'sine');
                osc.frequency.exponentialRampToValueAtTime(2000 + Math.random() * 1000, ctx.currentTime + 0.1);
                const env = ctx.createGain();
                env.gain.setValueAtTime(0.04, ctx.currentTime);
                env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
                osc.connect(env).connect(ambienceGain);
                osc.start(); osc.stop(ctx.currentTime + 0.15);
            } else if (r < 0.1) {
                // Wind gust
                const noise = createNoise(ctx, 1.5);
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = 200 + Math.random() * 200;
                filter.Q.value = 1;
                const env = ctx.createGain();
                env.gain.setValueAtTime(0, ctx.currentTime);
                env.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.5);
                env.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.3);
                noise.connect(filter).connect(env).connect(ambienceGain);
                noise.start(); noise.stop(ctx.currentTime + 1.5);
            }
        } catch { /* ignore */ }
    }, 3000);
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
