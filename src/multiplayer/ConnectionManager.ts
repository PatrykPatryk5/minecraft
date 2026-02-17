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
 *   conn.connect('PlayerName');
 *   conn.sendMove([x, y, z], [rx, ry]);
 *   conn.sendChat('Hello!');
 *   conn.disconnect();
 */

import {
    encodePacket, decodePacket,
    type ClientPacket, type ServerPacket,
    POSITION_SYNC_INTERVAL, MAX_CHAT_LENGTH,
} from './protocol';
import useGameStore from '../store/gameStore';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export class ConnectionManager {
    private ws: WebSocket | null = null;
    private url: string;
    private status: ConnectionStatus = 'disconnected';
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private positionTimer: ReturnType<typeof setInterval> | null = null;
    private lastSentPos: [number, number, number] = [0, 0, 0];

    constructor(url: string) {
        this.url = url;
    }

    getStatus(): ConnectionStatus {
        return this.status;
    }

    connect(playerName: string): void {
        if (this.ws) this.disconnect();

        this.status = 'connecting';
        console.log(`[MP] Connecting to ${this.url}...`);

        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                this.status = 'connected';
                this.reconnectAttempts = 0;
                console.log('[MP] Connected!');

                // Send join packet
                this.send({ type: 'join', payload: { name: playerName } });

                // Start position sync
                this.startPositionSync();
            };

            this.ws.onmessage = (event) => {
                const packet = decodePacket(event.data);
                if (packet) this.handlePacket(packet);
            };

            this.ws.onclose = () => {
                this.status = 'disconnected';
                this.stopPositionSync();
                console.log('[MP] Disconnected');
                this.tryReconnect();
            };

            this.ws.onerror = (err) => {
                this.status = 'error';
                console.error('[MP] Connection error:', err);
            };
        } catch (err) {
            this.status = 'error';
            console.error('[MP] Failed to connect:', err);
        }
    }

    disconnect(): void {
        this.stopPositionSync();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.status = 'disconnected';
        this.reconnectAttempts = 0;
    }

    // ── Send Methods ──────────────────────────────────────

    private send(packet: ClientPacket): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(encodePacket(packet));
        }
    }

    sendMove(pos: [number, number, number], rot: [number, number]): void {
        this.send({ type: 'move', payload: { pos, rot } });
    }

    sendBlockPlace(x: number, y: number, z: number, blockType: number): void {
        this.send({ type: 'block_place', payload: { x, y, z, blockType } });
    }

    sendBlockBreak(x: number, y: number, z: number): void {
        this.send({ type: 'block_break', payload: { x, y, z } });
    }

    sendChat(text: string): void {
        if (text.length > MAX_CHAT_LENGTH) text = text.slice(0, MAX_CHAT_LENGTH);
        this.send({ type: 'chat', payload: { text } });
    }

    sendPing(): void {
        this.send({ type: 'ping', payload: { ts: Date.now() } });
    }

    // ── Packet Handler ────────────────────────────────────

    private handlePacket(packet: ServerPacket): void {
        const store = useGameStore.getState();

        switch (packet.type) {
            case 'welcome':
                store.setPlayerName(store.playerName);
                console.log(`[MP] Welcome! ID: ${packet.payload.playerId}, ${packet.payload.players.length} players online`);
                // Load existing players
                for (const p of packet.payload.players) {
                    store.addConnectedPlayer(p.id, p.name, p.pos);
                }
                break;

            case 'player_join':
                store.addConnectedPlayer(
                    packet.payload.id,
                    packet.payload.name,
                    packet.payload.pos
                );
                store.addChatMessage('System', `${packet.payload.name} dołączył do gry`);
                break;

            case 'player_leave':
                store.removeConnectedPlayer(packet.payload.id);
                store.addChatMessage('System', `Gracz opuścił grę`);
                break;

            case 'player_move':
                const { id, pos } = packet.payload;
                if (store.connectedPlayers[id]) {
                    store.addConnectedPlayer(id, store.connectedPlayers[id].name, pos);
                }
                break;

            case 'block_update': {
                const { x, y, z, blockType } = packet.payload;
                if (blockType === 0) {
                    store.removeBlock(x, y, z);
                } else {
                    store.addBlock(x, y, z, blockType);
                }
                const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
                store.bumpVersion(cx, cz);
                break;
            }

            case 'chat_broadcast':
                store.addChatMessage(packet.payload.sender, packet.payload.text);
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
            const pos = useGameStore.getState().playerPos;
            // Only send if position changed
            if (
                Math.abs(pos[0] - this.lastSentPos[0]) > 0.01 ||
                Math.abs(pos[1] - this.lastSentPos[1]) > 0.01 ||
                Math.abs(pos[2] - this.lastSentPos[2]) > 0.01
            ) {
                this.sendMove(pos, [0, 0]); // rotation TODO
                this.lastSentPos = [...pos];
            }
        }, POSITION_SYNC_INTERVAL);
    }

    private stopPositionSync(): void {
        if (this.positionTimer) {
            clearInterval(this.positionTimer);
            this.positionTimer = null;
        }
    }

    // ── Auto-reconnect ────────────────────────────────────

    private tryReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('[MP] Max reconnect attempts reached');
            return;
        }

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;
        console.log(`[MP] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);

        this.reconnectTimer = setTimeout(() => {
            this.connect(useGameStore.getState().playerName);
        }, delay);
    }
}

// Singleton instance
let connectionInstance: ConnectionManager | null = null;

export function getConnection(): ConnectionManager {
    if (!connectionInstance) {
        connectionInstance = new ConnectionManager('ws://localhost:3001');
    }
    return connectionInstance;
}

export function connectToServer(url: string, playerName: string): ConnectionManager {
    if (connectionInstance) connectionInstance.disconnect();
    connectionInstance = new ConnectionManager(url);
    connectionInstance.connect(playerName);
    return connectionInstance;
}
