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
const WORLD_FILE = './server/world.json';
const ONLINE_MODE = process.env.ONLINE_MODE === 'true'; // Verify UUID via index.js
const LEGACY_MODE = process.env.LEGACY_MODE === 'true'; // Host as P2P if possible

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
const worldBlocks = []; // Snapshot of placed blocks
let worldTime = 0;
let weather = 'clear';
let nextNid = 1;

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
function saveWorld() {
    try {
        fs.writeFileSync(WORLD_FILE, JSON.stringify(worldBlocks));
        console.log('[SERVER] World saved.');
    } catch (e) { console.error('[SERVER] Save failed:', e); }
}

function loadWorld() {
    try {
        if (fs.existsSync(WORLD_FILE)) {
            const data = JSON.parse(fs.readFileSync(WORLD_FILE));
            worldBlocks.push(...data);
            console.log(`[SERVER] Loaded ${worldBlocks.length} blocks.`);
        }
    } catch (e) { }
}

(async () => {
    await discoverPublicIP();
    loadWorld();
    setInterval(registerLobby, 20000);
    setInterval(reportStatus, 10000);
    setInterval(saveWorld, 60000);
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

    ws.on('message', async (data) => {
        const packet = decodePacket(data);
        if (!packet) return;

        // V7 Sequence Check
        if (packet.seq !== undefined) {
            if (packet.seq <= lastInSeq) return;
            lastInSeq = packet.seq;
        }

        if (packet.type === 'join') {
            const { name, password, version } = packet.payload;

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
                name: packet.payload.name,
                pos: packet.payload.pos || [0, 64, 0],
                rot: packet.payload.rot || [0, 0],
                dimension: packet.payload.dimension || 'overworld',
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
                    players: Array.from(players.values()).map(p => p.info),
                    time: worldTime,
                    weather
                }
            }));

            // Send World State (Blocks)
            if (worldBlocks.length > 0) {
                ws.send(encodePacket({
                    type: 'world_data',
                    payload: { blocks: worldBlocks }
                }));
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
                p.info.pos = packet.payload.pos;
                p.info.rot = packet.payload.rot;
                // p.info.health ignores client payload for security
                p.info.isUnderwater = packet.payload.isUnderwater;
                p.info.dimension = packet.payload.dimension || p.info.dimension;

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
                const bt = packet.type === 'block_place' ? packet.payload.blockType : 0;
                // Update world snapshot
                const blockIdx = worldBlocks.findIndex(b => b.x === packet.payload.x && b.y === packet.payload.y && b.z === packet.payload.z);
                if (bt === 0) {
                    if (blockIdx !== -1) worldBlocks.splice(blockIdx, 1);
                } else {
                    if (blockIdx !== -1) worldBlocks[blockIdx].type = bt;
                    else worldBlocks.push({ x: packet.payload.x, y: packet.payload.y, z: packet.payload.z, type: bt });
                }

                broadcast({
                    type: 'block_update',
                    payload: { x: packet.payload.x, y: packet.payload.y, z: packet.payload.z, blockType: bt }
                }, playerId);
                break;

            case 'chat':
                const text = packet.payload.text;
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

            case 'ping':
                ws.send(encodePacket({ type: 'pong', payload: { ts: packet.payload.ts } }));
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
    const encoded = encodePacket(packet);
    for (const [id, player] of players.entries()) {
        if (id !== excludeId && player.ws.readyState === 1) {
            player.ws.send(encoded);
        }
    }
}
