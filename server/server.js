import fs from 'fs';
import { WebSocketServer } from 'ws';
import { decodePacket, encodePacket, PROTOCOL_VERSION } from './protocol.js';

// Configuration
const PORT = process.env.PORT || 3001;
let LOBBY_ID = process.env.LOBBY_ID || `ws://localhost:${PORT}`;
const LOBBY_SERVER = process.env.LOBBY_SERVER || 'http://localhost:3000';
const SERVER_NAME = process.env.SERVER_NAME || 'Oddany Serwer Minecraft';
const PASSWORD = process.env.PASSWORD || '';
const VERSION = `4.0.0-dedicated-v${PROTOCOL_VERSION}`;
const WORLD_FILE = new URL('./world.json', import.meta.url);
const ONLINE_MODE = process.env.ONLINE_MODE === 'true'; // Verify UUID via index.js
const LEGACY_MODE = process.env.LEGACY_MODE === 'true'; // Host as P2P if possible
const MAX_PLAYERS = 20;
const MAX_CHAT_LENGTH = 256;

let outSeq = 0;

// IP Discovery
async function discoverPublicIP() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        console.log(`[SERVER] Detected Public IP: ${data.ip}`);
        LOBBY_ID = `ws://${data.ip}:${PORT}`;
    } catch (e) {
        console.warn('[SERVER] Public IP discovery failed, using fallback.');
    }
}

console.log(`[SERVER] Starting Dedicated Server on port ${PORT}...`);
console.log(`[SERVER] Protocol Version: ${PROTOCOL_VERSION}`);

const wss = new WebSocketServer({ port: PORT });

// State
const players = new Map();
const worldBlocks = new Map(); // "x,y,z" -> block for constant-time updates
let worldTime = 0;
let weather = 'clear';
let worldSeed = Math.floor(Math.random() * 1000000);
let nextNid = 1;

function isValidPosition(pos) {
    return Array.isArray(pos) && pos.length === 3 && pos.every(Number.isFinite) &&
        Math.abs(pos[0]) <= 30_000_000 && Math.abs(pos[2]) <= 30_000_000 && pos[1] >= -64 && pos[1] <= 512;
}

function isValidRotation(rot) {
    return Array.isArray(rot) && rot.length === 2 && rot.every((value) => Number.isFinite(value) && Math.abs(value) <= Math.PI * 4);
}

function blockKey(x, y, z) {
    return `${x},${y},${z}`;
}

// Lobby Registration
async function registerLobby() {
    try {
        const startTime = Date.now();
        await fetch(`${LOBBY_SERVER}/api/multiplayer/host`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: LOBBY_ID,
                name: SERVER_NAME,
                players: players.size,
                hasPassword: !!PASSWORD,
                isPermanent: true,
                version: VERSION,
                region: 'PL-WAW',
                isOnlineMode: ONLINE_MODE,
                isLegacy: LEGACY_MODE
            })
        });
    } catch (e) {
        // console.warn('[SERVER] Lobby registration failed.');
    }
}

async function reportStatus() {
    try {
        await fetch(`${LOBBY_SERVER}/api/multiplayer/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: LOBBY_ID,
                players: players.size,
                load: process.cpuUsage().user / 1000000,
                uptime: process.uptime()
            })
        });
    } catch (e) { }
}

// Persist world occasionally
let saveInProgress = false;
async function saveWorld() {
    if (saveInProgress) return;
    saveInProgress = true;
    try {
        await fs.promises.writeFile(WORLD_FILE, JSON.stringify({ worldSeed, worldBlocks: [...worldBlocks.values()] }));
        console.log('[SERVER] World saved.');
    } catch (e) { console.error('[SERVER] Save failed:', e); }
    finally { saveInProgress = false; }
}

function loadWorld() {
    try {
        if (fs.existsSync(WORLD_FILE)) {
            const data = JSON.parse(fs.readFileSync(WORLD_FILE));
            if (data.worldSeed !== undefined) worldSeed = data.worldSeed;
            const savedBlocks = Array.isArray(data.worldBlocks) ? data.worldBlocks : Array.isArray(data) ? data : [];
            for (const block of savedBlocks) {
                if (Number.isInteger(block?.x) && Number.isInteger(block?.y) && Number.isInteger(block?.z) && Number.isInteger(block?.type)) {
                    worldBlocks.set(blockKey(block.x, block.y, block.z), block);
                }
            }
            console.log(`[SERVER] Loaded world (Seed: ${worldSeed}, Blocks: ${worldBlocks.size}).`);
        }
    } catch (e) { }
}

(async () => {
    await discoverPublicIP();
    loadWorld();
    setInterval(registerLobby, 20000);
    setInterval(reportStatus, 10000);
    setInterval(saveWorld, 60000);

    // Ping Heartbeat (Every 5s)
    setInterval(() => {
        const pingPacket = encodePacket({ type: 'ping', payload: { ts: Date.now() } });
        for (const player of players.values()) {
            if (player.ws.readyState === 1) player.ws.send(pingPacket);
        }
    }, 5000);

    registerLobby();
})();

// World Cycle
setInterval(() => {
    worldTime = (worldTime + 0.1) % 24000;
}, 100);

// Client handling
wss.on('connection', (ws) => {
    let playerId = null;
    let lastInSeq = -1;
    let rateWindowStart = Date.now();
    let packetCount = 0;

    ws.on('message', async (data) => {
        const packet = decodePacket(data);
        if (!packet) return;

        const now = Date.now();
        if (now - rateWindowStart >= 1000) {
            rateWindowStart = now;
            packetCount = 0;
        }
        if (++packetCount > 120) return;

        // V7 Sequence Check
        if (packet.seq !== undefined) {
            if (packet.seq <= lastInSeq) return;
            lastInSeq = packet.seq;
        }

        if (packet.type === 'join') {
            if (playerId) return;
            if (players.size >= MAX_PLAYERS) {
                ws.send(encodePacket({ type: 'error', payload: { message: 'Serwer jest pełny.' } }));
                return ws.close();
            }
            const name = String(packet.payload?.name || 'Player').trim().slice(0, 24) || 'Player';
            const { password, version } = packet.payload || {};

            // Security: Password
            if (PASSWORD && password !== PASSWORD) {
                ws.send(encodePacket({ type: 'error', payload: { message: 'Błędne hasło serwera!' } }));
                return ws.close();
            }

            // Version check
            if (packet.payload.version !== PROTOCOL_VERSION) {
                ws.send(encodePacket({ type: 'error', payload: { message: `Nieprawidłowa wersja! Serwer używa v${PROTOCOL_VERSION}` } }));
                ws.close();
                return;
            }

            // Online Mode Auth
            if (ONLINE_MODE) {
                if (!packet.payload.token || !packet.payload.uuid) {
                    ws.send(encodePacket({ type: 'error', payload: { message: 'Serwer działa w trybie Online! Wymagany token i UUID.' } }));
                    return ws.close();
                }

                try {
                    const verifyRes = await fetch(`${LOBBY_SERVER}/api/auth/verify`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: packet.payload.token, uuid: packet.payload.uuid }),
                        signal: AbortSignal.timeout(3000) // 3s timeout
                    });

                    if (!verifyRes.ok && verifyRes.status >= 500) {
                        throw new Error('Auth server error');
                    }

                    const verifyData = await verifyRes.json();
                    if (!verifyData.success) {
                        ws.send(encodePacket({ type: 'server_warning', payload: { message: 'Błąd weryfikacji UUID! Dołączasz jako gość (Offline).', severity: 'low' } }));
                        console.log(`[SERVER] Auth verification failed for ${name}, allowing as guest.`);
                    } else {
                        console.log(`[SERVER] Verified Online ID: ${verifyData.name} (${packet.payload.uuid})`);
                        playerId = packet.payload.uuid;
                    }
                } catch (e) {
                    ws.send(encodePacket({ type: 'server_warning', payload: { message: 'Serwer autoryzacji niedostępny. Dołączasz w trybie Offline.', severity: 'medium' } }));
                    console.warn(`[SERVER] Auth server unreachable for ${name}, falling back to offline.`);
                }

                if (!playerId) playerId = `srv-${Math.random().toString(36).substr(2, 6)}`;
            } else {
                playerId = `srv-${Math.random().toString(36).substr(2, 6)}`;
            }

            console.log(`[SERVER] Player ${name} joined as ${playerId}`);

            const playerInfo = {
                id: playerId,
                nid: nextNid++,
                name,
                pos: isValidPosition(packet.payload.pos) ? packet.payload.pos : [0, 64, 0],
                rot: isValidRotation(packet.payload.rot) ? packet.payload.rot : [0, 0],
                dimension: packet.payload.dimension === 'nether' || packet.payload.dimension === 'end' ? packet.payload.dimension : 'overworld',
                isUnderwater: !!packet.payload.isUnderwater,
                health: 20,
                latency: 0
            };

            // Welcome
            ws.send(encodePacket({
                type: 'welcome',
                payload: {
                    playerId,
                    nid: playerInfo.nid,
                    worldSeed,
                    players: Array.from(players.values()).map(p => p.info),
                    time: worldTime,
                    weather
                }
            }));

            // Send World State (Blocks)
            if (worldBlocks.size > 0) {
                // Keep individual WebSocket frames small so large persistent worlds
                // do not create a single multi-megabyte allocation on the client.
                const snapshot = [...worldBlocks.values()];
                for (let i = 0; i < snapshot.length; i += 256) {
                    ws.send(encodePacket({
                        type: 'world_data',
                        payload: { blocks: snapshot.slice(i, i + 256) }
                    }));
                }
            }

            // Notify others
            broadcast({ type: 'player_join', payload: playerInfo }, playerId);

            players.set(playerId, { ws, info: playerInfo, latency: 0 });

            // Modded Server Beta: Handshake
            ws.send(encodePacket({
                type: 'mod_info',
                payload: { mods: [{ id: 'core', version: '1.0.0', required: true }] }
            }));

            ws.send(encodePacket({
                type: 'server_warning',
                payload: { message: 'To jest serwer w fazie BETA protokołu 1.0!', severity: 'medium' }
            }));

            return;
        }

        if (!playerId) return;

        // Handlers
        switch (packet.type) {
            case 'move':
                const p = players.get(playerId);
                if (!p) return;
                if (!isValidPosition(packet.payload?.pos) || !isValidRotation(packet.payload?.rot)) return;
                p.info.pos = packet.payload.pos;
                p.info.rot = packet.payload.rot;
                // p.info.health ignores client payload for security
                p.info.isUnderwater = packet.payload.isUnderwater;
                p.info.dimension = packet.payload.dimension === 'nether' || packet.payload.dimension === 'end' ? packet.payload.dimension : 'overworld';

                // Binary Broadcast with current latency and full state
                broadcast({
                    type: 'player_move',
                    payload: {
                        id: playerId,
                        nid: p.info.nid,
                        pos: p.info.pos,
                        rot: p.info.rot,
                        health: p.info.health,
                        latency: p.latency,
                        isUnderwater: p.info.isUnderwater,
                        dimension: p.info.dimension
                    }
                }, playerId);
                break;

            case 'block_place':
            case 'block_break':
                if (!players.has(playerId)) return;
                const { x, y, z } = packet.payload || {};
                if (![x, y, z].every(Number.isInteger) || Math.abs(x) > 30_000_000 || Math.abs(z) > 30_000_000 || y < 0 || y > 255) return;
                const bt = packet.type === 'block_place' ? packet.payload.blockType : 0;
                if (bt !== 0 && (!Number.isInteger(bt) || bt < 1 || bt > 4095 || bt === 9)) return;
                const actor = players.get(playerId).info.pos;
                if ((x + 0.5 - actor[0]) ** 2 + (y + 0.5 - actor[1]) ** 2 + (z + 0.5 - actor[2]) ** 2 > 64) return;
                const key = blockKey(x, y, z);
                const current = worldBlocks.get(key);

                if (current?.type === bt) return;

                // Persist air as a tombstone too: the client regenerates base terrain
                // from the seed, so deleting this entry would make broken blocks return.
                worldBlocks.set(key, { x, y, z, type: bt });

                broadcast({
                    type: 'block_update',
                    payload: { x, y, z, blockType: bt }
                }, playerId);
                break;

            case 'chat':
                if (!players.has(playerId) || typeof packet.payload?.text !== 'string') return;
                const text = packet.payload.text.slice(0, MAX_CHAT_LENGTH);
                if (text.startsWith('/')) {
                    const args = text.slice(1).split(' ');
                    const cmd = args[0].toLowerCase();

                    if (cmd === 'time' && args[1]) {
                        worldTime = parseInt(args[1]);
                        broadcast({ type: 'world_sync', payload: { time: worldTime, weather, weatherIntensity: 0.5 } });
                        return;
                    }
                    if (cmd === 'weather' && args[1]) {
                        weather = args[1];
                        broadcast({ type: 'world_sync', payload: { time: worldTime, weather, weatherIntensity: 0.5 } });
                        return;
                    }
                    if (cmd === 'broadcast') {
                        broadcast({ type: 'chat_broadcast', payload: { sender: '§l[SERWER]', text: args.slice(1).join(' ') } });
                        return;
                    }
                }

                broadcast({
                    type: 'chat_broadcast',
                    payload: { sender: players.get(playerId).info.name, text: packet.payload.text }
                });
                break;

            case 'entity_sync':
            case 'entity_velocity':
            case 'world_event':
                // Relay these events to everyone
                broadcast(packet, playerId);
                break;

            case 'entity_remove':
                broadcast(packet, playerId);
                break;

            case 'inventory_update':
                broadcast(packet, playerId);
                break;

            case 'ping':
                ws.send(encodePacket({ type: 'pong', ts: Date.now(), payload: { ts: packet.payload.ts } }));
                break;

            case 'pong':
                const rtt = Date.now() - packet.payload.ts;
                const player = players.get(playerId);
                if (player) {
                    player.latency = rtt;
                    player.info.latency = rtt;
                }
                break;
        }
    });

    ws.on('close', () => {
        if (playerId) {
            console.log(`[SERVER] Player ${playerId} left.`);
            players.delete(playerId);
            broadcast({ type: 'player_leave', payload: { id: playerId } });
        }
    });
});

function broadcast(packet, excludeId = null) {
    packet.seq = outSeq++;
    packet.ts = Date.now();
    const encoded = encodePacket(packet);
    for (const [id, player] of players.entries()) {
        if (id !== excludeId && player.ws.readyState === 1) {
            player.ws.send(encoded);
        }
    }
}
