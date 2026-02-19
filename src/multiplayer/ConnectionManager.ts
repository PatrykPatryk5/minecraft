/**
 * Multiplayer Connection Manager
 *
 * Manages WebSocket connection to game server.
 * Handles:
 *   - Auto-reconnection with exponential backoff
 *   - Position synchronization
 *   - Block update broadcasting
 *   - Chat message routing
 *   - Player join/leave events
 *
 * Usage:
 *   const conn = new ConnectionManager('ws://localhost:3001');
 *   const conn = new ConnectionManager();
 *   // Host:
 *   conn.hostGame('PlayerName').then(id => console.log('Host ID:', id));
 *   // Client:
 *   conn.joinGame('host-id', 'PlayerName');
 *   conn.sendMove([x, y, z], [rx, ry]);
 *   conn.sendChat('Hello!');
 *   conn.disconnect();
 */

import Peer, { DataConnection } from 'peerjs';
import {
    encodePacket, decodePacket,
    type ClientPacket, type ServerPacket,
    POSITION_SYNC_INTERVAL, MAX_CHAT_LENGTH,
} from './protocol';
import useGameStore from '../store/gameStore';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type PeerRole = 'host' | 'client' | 'none';

export class ConnectionManager {
    private peer: Peer | null = null;
    private connections: Map<string, DataConnection> = new Map(); // For host
    private hostConn: DataConnection | null = null;               // For client

    private role: PeerRole = 'none';
    private status: ConnectionStatus = 'disconnected';
    private positionTimer: ReturnType<typeof setInterval> | null = null;
    private lastSentPos: [number, number, number] = [0, 0, 0];
    private _lastSentRot: number = 0;
    private _lastSentRot2: number = 0;

    constructor() {
        // No URL needed for P2P
    }

    getStatus(): ConnectionStatus {
        return this.status;
    }

    getRole(): PeerRole {
        return this.role;
    }

    /** Start as Host */
    async hostGame(playerName: string): Promise<string> {
        this.disconnect();
        this.role = 'host';
        this.status = 'connecting';
        console.log('[MP] Starting host...');

        return new Promise((resolve, reject) => {
            // Generate random readable ID
            const id = 'muzo-' + Math.random().toString(36).substring(2, 8);
            this.peer = new Peer(id, {
                debug: 2
            });

            this.peer.on('open', (peerId) => {
                this.status = 'connected';
                console.log('[MP] Hosting on ID:', peerId);

                // Add ourselves to the store
                const state = useGameStore.getState();
                state.setPlayerName(playerName);
                state.setIsMultiplayer(true);
                // The host doesn't need to add themselves to connectedPlayers, but we can set up the world

                this.startPositionSync();
                resolve(peerId);
            });

            this.peer.on('connection', (conn) => {
                console.log(`[MP] Client ${conn.peer} connecting...`);

                // Keep track of connection
                this.connections.set(conn.peer, conn);

                conn.on('open', () => {
                    console.log(`[MP] Client ${conn.peer} joined.`);
                });

                conn.on('data', (data: any) => {
                    const packet = decodePacket(data);
                    if (packet) this.handleClientPacket(conn.peer, packet as any); // Treat as ClientPacket
                });

                conn.on('close', () => {
                    console.log(`[MP] Client ${conn.peer} left.`);
                    this.connections.delete(conn.peer);
                    this.broadcast({ type: 'player_leave', payload: { id: conn.peer } }, conn.peer);
                    this.handlePacket({ type: 'player_leave', payload: { id: conn.peer } });
                });

                conn.on('error', (err) => {
                    console.error(`[MP] Connection error ${conn.peer}:`, err);
                });
            });

            this.peer.on('error', (err) => {
                this.status = 'error';
                console.error('[MP] Host Peer error:', err);
                reject(err);
            });
        });
    }

    /** Connect to a Host */
    async joinGame(hostId: string, playerName: string): Promise<void> {
        this.disconnect();
        this.role = 'client';
        this.status = 'connecting';
        console.log(`[MP] Joining ${hostId}...`);

        return new Promise((resolve, reject) => {
            this.peer = new Peer({ debug: 2 });

            this.peer.on('open', (myId) => {
                console.log('[MP] My ID is', myId);
                const conn = this.peer!.connect(hostId, { reliable: true });
                this.hostConn = conn;

                conn.on('open', () => {
                    this.status = 'connected';
                    console.log('[MP] Connected to Host!');

                    const state = useGameStore.getState();
                    state.setPlayerName(playerName);
                    state.setIsMultiplayer(true);

                    // Send Join packet
                    const dim = state.dimension;
                    const pos = state.playerPos;
                    const rot = state.playerRot;
                    this.sendToHost({ type: 'join', payload: { name: playerName, dimension: dim, pos, rot } });

                    this.startPositionSync();
                    resolve();
                });

                conn.on('data', (data: any) => {
                    const packet = decodePacket(data);
                    if (packet) this.handlePacket(packet);
                });

                conn.on('close', () => {
                    this.status = 'disconnected';
                    console.log('[MP] Disconnected from Host');
                    this.disconnect();
                });

                conn.on('error', (err) => {
                    console.error('[MP] Connection to host error:', err);
                    this.status = 'error';
                    reject(err);
                });
            });

            this.peer.on('error', (err) => {
                this.status = 'error';
                console.error('[MP] Client Peer error:', err);
                reject(err);
            });
        });
    }

    disconnect(): void {
        this.stopPositionSync();
        if (this.hostConn) {
            this.hostConn.close();
            this.hostConn = null;
        }
        for (const conn of this.connections.values()) {
            conn.close();
        }
        this.connections.clear();
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.status = 'disconnected';
        this.role = 'none';

        const state = useGameStore.getState();
        state.setIsMultiplayer(false);
        state.clearConnectedPlayers();
    }

    // ── HOST Logic: Broadcast and Relay ─────────────────────

    private broadcast(packet: ServerPacket, excludePeer?: string): void {
        const encoded = encodePacket(packet as any);
        for (const [id, conn] of this.connections) {
            if (id !== excludePeer && conn.open) {
                conn.send(encoded);
            }
        }
    }

    private handleClientPacket(peerId: string, packet: ClientPacket): void {
        const state = useGameStore.getState();
        // The host receives packets from clients, acts as the server, and relays them.

        switch (packet.type) {
            case 'join': {
                const name = packet.payload.name.substring(0, 16);
                const dim = packet.payload.dimension || 'overworld';
                const startPos: [number, number, number] = packet.payload.pos || [0, 80, 0];

                // Add to local state (Host's view of the world)
                state.addConnectedPlayer(peerId, name, startPos, [0, 0], dim);
                state.addChatMessage('System', `${name} joined the game.`, 'system');

                // Tell the new client about existing players
                // In P2P, the host IS a player, so send the host's info too!
                const playersObj: any[] = [];
                // 1. Host
                playersObj.push({
                    id: 'host',
                    name: state.playerName,
                    pos: state.playerPos,
                    rot: state.playerRot,
                    dimension: state.dimension
                });
                // 2. Other clients
                for (const [id, p] of Object.entries(state.connectedPlayers)) {
                    if (id !== peerId) {
                        playersObj.push({
                            id, name: p.name, pos: p.pos, rot: p.rot, dimension: p.dimension
                        });
                    }
                }

                // Send welcome to the new client
                const welcomePkt: ServerPacket = {
                    type: 'welcome',
                    payload: { playerId: peerId, players: playersObj, worldSeed: state.worldSeed }
                };
                this.connections.get(peerId)?.send(encodePacket(welcomePkt as any));

                // Broadcast join to others
                const joinPkt: ServerPacket = {
                    type: 'player_join',
                    payload: { id: peerId, name, pos: startPos, rot: [0, 0], dimension: dim }
                };
                this.broadcast(joinPkt, peerId);
                break;
            }

            case 'move': {
                const { pos, rot, dimension } = packet.payload;
                state.addConnectedPlayer(peerId, state.connectedPlayers[peerId]?.name || 'Unknown', pos, rot, dimension);

                // Relay
                this.broadcast({
                    type: 'player_move',
                    payload: { id: peerId, pos, rot, dimension }
                }, peerId);
                break;
            }

            case 'block_place':
            case 'block_break': {
                const { x, y, z } = packet.payload;
                const bt = packet.type === 'block_place' ? packet.payload.blockType : 0;

                // Apply locally
                if (bt === 0) state.removeBlock(x, y, z, true);
                else state.addBlock(x, y, z, bt, true);

                const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
                state.bumpVersion(cx, cz);

                // Relay
                this.broadcast({
                    type: 'block_update',
                    payload: { x, y, z, blockType: bt }
                }, peerId);
                break;
            }

            case 'chat': {
                state.addChatMessage(state.connectedPlayers[peerId]?.name || 'Unknown', packet.payload.text, 'player');
                this.broadcast({
                    type: 'chat_broadcast',
                    payload: { sender: state.connectedPlayers[peerId]?.name || 'Unknown', text: packet.payload.text }
                }, peerId);
                break;
            }
        }
    }

    // ── OUTGOING CLIENT OR HOST Logic ───────────────────────
    // Called by the local game (Player.tsx, BlockActions.tsx)

    private sendToHost(packet: ClientPacket): void {
        if (this.role === 'client' && this.hostConn?.open) {
            this.hostConn.send(encodePacket(packet as any));
        } else if (this.role === 'host') {
            // If we are the host, our local actions are instantly broadcasted as SERVER packets
            switch (packet.type) {
                case 'move':
                    this.broadcast({
                        type: 'player_move',
                        payload: { id: 'host', pos: packet.payload.pos, rot: packet.payload.rot, dimension: packet.payload.dimension }
                    });
                    break;
                case 'block_place':
                case 'block_break':
                    const bt = packet.type === 'block_place' ? packet.payload.blockType : 0;
                    this.broadcast({
                        type: 'block_update',
                        payload: { x: packet.payload.x, y: packet.payload.y, z: packet.payload.z, blockType: bt }
                    });
                    break;
                case 'chat':
                    const state = useGameStore.getState();
                    this.broadcast({
                        type: 'chat_broadcast',
                        payload: { sender: state.playerName, text: packet.payload.text }
                    });
                    break;
            }
        }
    }

    sendMove(pos: [number, number, number], rot: [number, number]): void {
        const dim = useGameStore.getState().dimension;
        this.sendToHost({ type: 'move', payload: { pos, rot, dimension: dim } });
    }

    sendBlockPlace(x: number, y: number, z: number, blockType: number): void {
        this.sendToHost({ type: 'block_place', payload: { x, y, z, blockType } });
    }

    sendBlockBreak(x: number, y: number, z: number): void {
        this.sendToHost({ type: 'block_break', payload: { x, y, z } });
    }

    sendChat(text: string): void {
        if (text.length > MAX_CHAT_LENGTH) text = text.slice(0, MAX_CHAT_LENGTH);
        this.sendToHost({ type: 'chat', payload: { text } });
    }

    sendPing(): void {
        this.sendToHost({ type: 'ping', payload: { ts: Date.now() } });
    }

    // ── CLIENT Receive Logic ────────────────────────────────

    private handlePacket(packet: ServerPacket): void {
        const store = useGameStore.getState();

        switch (packet.type) {
            case 'welcome':
                store.setPlayerName(store.playerName);
                if (packet.payload.worldSeed !== undefined) {
                    store.setWorldSeed(packet.payload.worldSeed);
                    console.log(`[MP] Sycned world seed to ${packet.payload.worldSeed}`);
                }
                console.log(`[MP] Welcome! ID: ${packet.payload.playerId}, ${packet.payload.players.length} players online`);
                for (const p of packet.payload.players) {
                    store.addConnectedPlayer(p.id, p.name, p.pos, p.rot, p.dimension);
                }
                break;

            case 'player_join':
                store.addConnectedPlayer(
                    packet.payload.id,
                    packet.payload.name,
                    packet.payload.pos,
                    packet.payload.rot,
                    packet.payload.dimension
                );
                store.addChatMessage('System', `${packet.payload.name} joined!`, 'system');
                break;

            case 'player_leave':
                store.removeConnectedPlayer(packet.payload.id);
                store.addChatMessage('System', `A player left.`, 'system');
                break;

            case 'player_move':
                const { id, pos, rot, dimension } = packet.payload;
                if (store.connectedPlayers[id]) {
                    const prev = store.connectedPlayers[id];
                    store.addConnectedPlayer(id, prev.name, pos, rot ?? prev.rot, dimension ?? prev.dimension);
                }
                break;

            case 'block_update': {
                const { x, y, z, blockType } = packet.payload;
                if (blockType === 0) store.removeBlock(x, y, z, true);
                else store.addBlock(x, y, z, blockType, true);
                const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
                store.bumpVersion(cx, cz);
                break;
            }

            case 'chat_broadcast':
                store.addChatMessage(packet.payload.sender, packet.payload.text, 'player');
                break;

            case 'pong': {
                const latency = Date.now() - packet.payload.ts;
                console.log(`[MP] Ping: ${latency}ms`);
                break;
            }
        }
    }

    // ── Position Sync ─────────────────────────────────────

    private startPositionSync(): void {
        this.positionTimer = setInterval(() => {
            const state = useGameStore.getState();
            const pos = state.playerPos;
            const rot = state.playerRot;

            if (
                Math.abs(pos[0] - this.lastSentPos[0]) > 0.01 ||
                Math.abs(pos[1] - this.lastSentPos[1]) > 0.01 ||
                Math.abs(pos[2] - this.lastSentPos[2]) > 0.01 ||
                this._lastSentRot !== rot[0] ||
                this._lastSentRot2 !== rot[1]
            ) {
                this.sendMove(pos, rot);
                this.lastSentPos = [...pos];
                this._lastSentRot = rot[0];
                this._lastSentRot2 = rot[1];
            }
        }, POSITION_SYNC_INTERVAL);
    }

    private stopPositionSync(): void {
        if (this.positionTimer) {
            clearInterval(this.positionTimer);
            this.positionTimer = null;
        }
    }
}

let connectionInstance: ConnectionManager | null = null;
export function getConnection(): ConnectionManager {
    if (!connectionInstance) connectionInstance = new ConnectionManager();
    return connectionInstance;
}
