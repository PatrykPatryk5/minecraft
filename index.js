import Fastify from 'fastify'
import { WebSocketServer } from 'ws'
import path from 'path'
import { fileURLToPath } from 'url'
import fastifyStatic from '@fastify/static'
import fastifyCompress from '@fastify/compress'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = Fastify({
    logger: true,
    bodyLimit: 52428800 // 50MB
})

const PORT = process.env.PORT || 3046
const HOST = '0.0.0.0'

// Auth System & Rate Limiting
const sessions = new Map(); // Session Token -> { uuid, name, expire }
const authRateLimit = new Map(); // IP -> { count, reset }

// Cleanup loops
setInterval(() => {
    const now = Date.now();
    for (const [token, session] of sessions.entries()) {
        if (session.expire < now) sessions.delete(token);
    }
    for (const [ip, limit] of authRateLimit.entries()) {
        if (limit.reset < now) authRateLimit.delete(ip);
    }
}, 600000); // Clean every 10 mins

app.post('/api/auth/claim', async (req, reply) => {
    const ip = req.ip;
    const now = Date.now();
    const limit = authRateLimit.get(ip) || { count: 0, reset: now + 3600000 };

    if (limit.count >= 10) { // Max 10 claims per hour per IP
        return reply.code(429).send({ error: 'Too many auth requests. Try again in an hour.' });
    }

    const { name } = req.body;
    if (!name || name.length > 16) return reply.code(400).send({ error: 'Invalid name (max 16 chars)' });

    limit.count++;
    authRateLimit.set(ip, limit);

    const uuid = `uuid-${Math.random().toString(36).substr(2, 9)}`;
    const token = `token-${Math.random().toString(36).substr(2, 16)}`;

    sessions.set(token, { uuid, name, expire: now + 86400000 }); // Valid for 24h
    return { token, uuid };
});

app.post('/api/auth/verify', async (req, reply) => {
    const { token, uuid } = req.body;
    const session = sessions.get(token);

    if (session && session.uuid === uuid && session.expire > Date.now()) {
        return { success: true, name: session.name };
    }
    return { success: false };
});

// Replicator (Relay) Logic
const relayClients = new Map() // clientId -> ws
const relayRooms = new Map() // clientId -> roomId
const roomPeers = new Map() // roomId -> Set<clientId>

app.ready(() => {
    const wss = new WebSocketServer({
        server: app.server,
        path: '/relay',
        maxPayload: 52428800 // 50MB
    });

    wss.on('connection', (ws, req) => {
        let clientId = null;
        let roomId = null;

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data);

                // Register client
                if (msg.type === 'register') {
                    clientId = msg.id;
                    roomId = msg.roomId || null;
                    relayClients.set(clientId, ws);

                    if (roomId) {
                        relayRooms.set(clientId, roomId);
                        if (!roomPeers.has(roomId)) roomPeers.set(roomId, new Set());
                        roomPeers.get(roomId).add(clientId);
                    }

                    console.log(`[RELAY] Registered: ${clientId}${roomId ? ` (Room: ${roomId})` : ''}`);
                    return;
                }

                // Tunnel message to target
                if (msg.type === 'tunnel' && msg.to && msg.payload) {
                    if (msg.to === 'room' && roomId) {
                        const peers = roomPeers.get(roomId);
                        if (peers) {
                            const tunneled = JSON.stringify({
                                type: 'tunneled',
                                from: clientId || 'anonymous',
                                payload: msg.payload
                            });
                            for (const peerId of peers) {
                                if (peerId !== clientId) {
                                    const peerWs = relayClients.get(peerId);
                                    if (peerWs?.readyState === 1) peerWs.send(tunneled);
                                }
                            }
                        }
                    } else {
                        const target = relayClients.get(msg.to);
                        if (target && target.readyState === 1) {
                            target.send(JSON.stringify({
                                type: 'tunneled',
                                from: clientId || 'anonymous',
                                payload: msg.payload
                            }));
                        }
                    }
                }

                // Specific Migration Signal
                if (msg.type === 'host_migration' && roomId) {
                    const signal = JSON.stringify({
                        type: 'host_migration',
                        payload: msg.payload
                    });
                    const peers = roomPeers.get(roomId);
                    if (peers) {
                        for (const peerId of peers) {
                            if (peerId !== clientId) {
                                const peerWs = relayClients.get(peerId);
                                if (peerWs?.readyState === 1) peerWs.send(signal);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('[RELAY] Error:', e);
            }
        });

        ws.on('close', () => {
            if (clientId) {
                relayClients.delete(clientId);
                if (roomId && roomPeers.has(roomId)) {
                    roomPeers.get(roomId).delete(clientId);
                    if (roomPeers.get(roomId).size === 0) roomPeers.delete(roomId);
                }
                relayRooms.delete(clientId);
                console.log(`[RELAY] Unregistered: ${clientId}`);
            }
        });
    });

    console.log('📡 Replicator Relay active on /relay');
});

// kompresja gzip/brotli
await app.register(fastifyCompress)

// serwowanie plików z dist
await app.register(fastifyStatic, {
    root: path.join(__dirname, 'dist'),
    prefix: '/'
})

// Konfiguracja STUN/TURN dla PeerJS
const PEER_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        { urls: 'stun:stun.nextcloud.com:443' },
        { urls: 'stun:stun.cloudflare.com:3478' }
    ]
}

app.get('/api/config', async (request, reply) => {
    return {
        peer: PEER_CONFIG,
        version: '4.0.0-multiplayer-v4'
    }
})

// Prosty system lobby w pamięci
const lobbies = new Map()

// Cleanup starych lobby (starsze niż 60s)
setInterval(() => {
    const now = Date.now()
    for (const [id, lobby] of lobbies.entries()) {
        if (now - lobby.lastSeen > 60000) {
            lobbies.delete(id)
        }
    }
}, 30000)

app.post('/api/multiplayer/host', async (request, reply) => {
    const { id, name, players, hasPassword, isPermanent, version, region, isOnlineMode, isLegacy } = request.body
    if (!id || !name) {
        return reply.code(400).send({ error: 'Missing id or name' })
    }

    const safeName = (name || 'Unknown').replace(/[^\w\s-]/gi, '').substr(0, 32);

    lobbies.set(id, {
        id,
        name: safeName,
        players: Math.min(100, players || 1),
        hasPassword: !!hasPassword,
        isPermanent: !!isPermanent,
        version: version || 'unknown',
        region: (region || 'Global').substr(0, 16),
        isOnlineMode: !!isOnlineMode,
        isLegacy: !!isLegacy,
        lastSeen: Date.now()
    })

    return { success: true }
})

app.post('/api/multiplayer/report', async (request, reply) => {
    const { id, players, load, uptime } = request.body
    if (lobbies.has(id)) {
        const lobby = lobbies.get(id)
        lobby.players = players
        lobby.load = load
        lobby.uptime = uptime
        lobby.lastSeen = Date.now()
        return { success: true }
    }
    return reply.code(404).send({ error: 'Lobby not found' })
})

app.get('/api/multiplayer/lobbies', async (request, reply) => {
    return Array.from(lobbies.values()).map(l => ({
        id: l.id,
        name: l.name,
        players: l.players,
        hasPassword: l.hasPassword,
        isPermanent: l.isPermanent,
        version: l.version,
        region: l.region,
        isOnlineMode: l.isOnlineMode,
        isLegacy: l.isLegacy
    }))
})

app.delete('/api/multiplayer/host/:id', async (request, reply) => {
    const { id } = request.params
    if (lobbies.has(id)) {
        lobbies.delete(id)
        return { success: true }
    }
    return reply.code(404).send({ error: 'Lobby not found' })
})

app.setNotFoundHandler((req, reply) => {
    // jeśli to plik statyczny → 404
    if (req.raw.url.includes('.')) {
        return reply.code(404).send('Not found')
    }

    // tylko dla SPA routes bez rozszerzenia
    reply.type('text/html').sendFile('index.html')
})

const start = async () => {
    try {
        await app.listen({ port: PORT, host: HOST })
        console.log(`🚀 Server running on http://localhost:${PORT}`)
    } catch (err) {
        app.log.error(err)
        process.exit(1)
    }
}

start()