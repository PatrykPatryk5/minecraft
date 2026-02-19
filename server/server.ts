/**
 * Minecraft Clone — Multiplayer WebSocket Server
 *
 * Run:  npx ts-node server.ts
 * Or:   node --loader ts-node/esm server.ts
 *
 * Features:
 *   - Player join/leave/move sync
 *   - Block place/break broadcasting
 *   - Chat system with /gamemode command
 *   - Ping/pong latency
 *   - Server-authoritative block updates
 */

import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT) || 3001;

// ─── Types ──────────────────────────────────────────────
interface Player {
    id: string;
    name: string;
    pos: [number, number, number];
    ws: WebSocket;
}

interface ServerState {
    players: Map<string, Player>;
    blockChanges: Map<string, number>; // "x,y,z" → blockType
}

// ─── State ──────────────────────────────────────────────
const state: ServerState = {
    players: new Map(),
    blockChanges: new Map(),
};

let nextId = 1;

// ─── Helpers ────────────────────────────────────────────
function broadcast(data: object, exclude?: string): void {
    const msg = JSON.stringify(data);
    for (const [id, p] of state.players) {
        if (id === exclude) continue;
        if (p.ws.readyState === WebSocket.OPEN) {
            p.ws.send(msg);
        }
    }
}

function sendTo(ws: WebSocket, data: object): void {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

// ─── Server ─────────────────────────────────────────────
const wss = new WebSocketServer({ port: PORT });

console.log(`\n🎮 Minecraft Server started on ws://localhost:${PORT}`);
console.log(`   Waiting for players...\n`);

wss.on('connection', (ws: WebSocket) => {
    const playerId = `player_${nextId++}`;
    let player: Player | null = null;

    ws.on('message', (raw: Buffer) => {
        try {
            const packet = JSON.parse(raw.toString());
            handlePacket(playerId, ws, packet);
        } catch (e) {
            console.warn(`[Server] Bad packet from ${playerId}:`, e);
        }
    });

    ws.on('close', () => {
        if (player) {
            state.players.delete(playerId);
            broadcast({ type: 'player_leave', payload: { id: playerId } });
            console.log(`[Server] ${player.name} left (${state.players.size} online)`);
        }
    });

    ws.on('error', (err: Error) => {
        console.warn(`[Server] WS error for ${playerId}:`, err.message);
    });

    function handlePacket(id: string, ws: WebSocket, packet: any): void {
        switch (packet.type) {
            case 'join': {
                const name = String(packet.payload?.name || 'Player').slice(0, 16);
                player = { id, name, pos: [0, 80, 0], ws };
                state.players.set(id, player);

                // Send welcome with all current players
                const otherPlayers = Array.from(state.players.values())
                    .filter(p => p.id !== id)
                    .map(p => ({ id: p.id, name: p.name, pos: p.pos }));

                sendTo(ws, {
                    type: 'welcome',
                    payload: { playerId: id, players: otherPlayers },
                });

                // Send existing block changes
                for (const [key, blockType] of state.blockChanges) {
                    const [x, y, z] = key.split(',').map(Number);
                    sendTo(ws, { type: 'block_update', payload: { x, y, z, blockType } });
                }

                // Broadcast join to others
                broadcast({ type: 'player_join', payload: { id, name, pos: player.pos } }, id);
                console.log(`[Server] ${name} joined (${state.players.size} online)`);
                break;
            }

            case 'move': {
                if (!player) return;
                const pos = packet.payload?.pos;
                if (Array.isArray(pos) && pos.length === 3) {
                    player.pos = pos as [number, number, number];
                    broadcast({ type: 'player_move', payload: { id, pos: player.pos } }, id);
                }
                break;
            }

            case 'block_place':
            case 'block_break': {
                const { x, y, z, blockType } = packet.payload || {};
                if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') return;

                const bt = packet.type === 'block_break' ? 0 : (blockType || 0);
                state.blockChanges.set(`${x},${y},${z}`, bt);

                broadcast({ type: 'block_update', payload: { x, y, z, blockType: bt } });
                break;
            }

            case 'chat': {
                if (!player) return;
                const text = String(packet.payload?.text || '').slice(0, 200);
                if (!text) return;

                // Handle commands
                if (text.startsWith('/')) {
                    handleCommand(id, ws, text, player.name);
                    return;
                }

                broadcast({ type: 'chat_broadcast', payload: { sender: player.name, text } });
                console.log(`[Chat] <${player.name}> ${text}`);
                break;
            }

            case 'ping': {
                sendTo(ws, { type: 'pong', payload: { ts: packet.payload?.ts || Date.now() } });
                break;
            }
        }
    }
});

function handleCommand(id: string, ws: WebSocket, cmd: string, playerName: string): void {
    const parts = cmd.slice(1).split(' ');
    const command = parts[0]?.toLowerCase();

    switch (command) {
        case 'gamemode': {
            const mode = parts[1];
            if (['survival', 'creative', 'spectator'].includes(mode)) {
                sendTo(ws, { type: 'chat_broadcast', payload: { sender: 'Server', text: `Zmieniono tryb na: ${mode}` } });
            } else {
                sendTo(ws, { type: 'chat_broadcast', payload: { sender: 'Server', text: 'Użycie: /gamemode survival|creative|spectator' } });
            }
            break;
        }
        case 'list': {
            const names = Array.from(state.players.values()).map(p => p.name).join(', ');
            sendTo(ws, { type: 'chat_broadcast', payload: { sender: 'Server', text: `Online (${state.players.size}): ${names}` } });
            break;
        }
        case 'help': {
            sendTo(ws, { type: 'chat_broadcast', payload: { sender: 'Server', text: 'Komendy: /gamemode, /list, /help' } });
            break;
        }
        default: {
            sendTo(ws, { type: 'chat_broadcast', payload: { sender: 'Server', text: `Nieznana komenda: /${command}. Wpisz /help` } });
        }
    }
}

// Periodic status
setInterval(() => {
    if (state.players.size > 0) {
        console.log(`[Server] ${state.players.size} players online, ${state.blockChanges.size} block changes`);
    }
}, 30000);
