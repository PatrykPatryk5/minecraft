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
    type ClientPacket, type ServerPacket, type PlayerInfo,
    PROTOCOL_VERSION, POSITION_SYNC_INTERVAL, MAX_CHAT_LENGTH,
} from './protocol';
import useGameStore, { Dimension } from '../store/gameStore';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type PeerRole = 'host' | 'client' | 'none';

export class ConnectionManager {
    private peer: Peer | null = null;
    private connections: Map<string, DataConnection> = new Map(); // For host
    private hostConn: DataConnection | null = null;               // For client
    private peerId: string | null = null;

    private role: PeerRole = 'none';
    private status: ConnectionStatus = 'disconnected';
    private ownId: string | null = null;
    private ownNid: number | null = null;
    private nidToUuid = new Map<number, string>();
    private positionTimer: ReturnType<typeof setInterval> | null = null;
    private syncTimer: ReturnType<typeof setInterval> | null = null;
    private lobbyTimer: ReturnType<typeof setInterval> | null = null;
    private lastSentPos: [number, number, number] = [0, 0, 0];
    private _lastSentRot: number = 0;
    private _lastSentRot2: number = 0;
    private currentLobbyId: string | null = null;
    private lastSentPositions: Map<string, [number, number, number]> = new Map();
    private ws: WebSocket | null = null;
    private relayWs: WebSocket | null = null;
    private relayClientIds: Set<string> = new Set();
    private isUsingRelay: boolean = false;
    private joinResolve: (() => void) | null = null;
    private joinReject: ((err: any) => void) | null = null;
    private config: any = null;
    private authSession: { token: string; uuid: string } | null = null;
    private outSeq: number = 0;
    private lastInSeq: Map<string, number> = new Map();
    private lastLatency: Map<string, number> = new Map();
    private pingInterval: any = null;
    private actionCounter: number = 0;
    private lastActionReset: number = Date.now();
    private clockOffset: number = 0;
    private ping: number = 0;

    constructor() {
        this.fetchConfig();
    }

    private async fetchConfig() {
        try {
            const res = await fetch('/api/config');
            const data = await res.json();
            this.config = data.peer;
            console.log('[MP] Fetched IceServers config.');
        } catch (e) {
            console.warn('[MP] Could not fetch config, using defaults.');
        }
    }

    async claimSession(name: string): Promise<void> {
        try {
            const res = await fetch('/api/auth/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
                signal: AbortSignal.timeout(3000)
            });
            const data = await res.json();
            this.authSession = data;
            console.log(`[MP] Online Session claimed: ${data.uuid}`);
        } catch (e) {
            console.warn('[MP] Could not claim online session, continuing in offline mode.');
            this.authSession = null;
        }
    }

    getStatus(): ConnectionStatus {
        return this.status;
    }

    getRole(): PeerRole {
        return this.role;
    }

    private serverPassword: string | null = null;

    /** Start as Host */
    async hostGame(playerName: string, isPublic: boolean = true, password: string = '', isOnline: boolean = false, isLegacy: boolean = false): Promise<string> {
        this.disconnect();
        this.role = 'host';
        this.status = 'connecting';
        this.serverPassword = password || null;
        console.log(`[MP] Starting host (WAN: ${isPublic}, Password: ${!!password})...`);

        return new Promise((resolve, reject) => {
            // Generate random readable ID
            const id = 'muzo-' + Math.random().toString(36).substring(2, 8);
            this.peer = new Peer(id, {
                debug: 1,
                config: this.config
            });

            this.peer.on('open', async (peerId) => {
                this.status = 'connected';
                this.currentLobbyId = peerId;
                console.log('[MP] Hosting on ID:', peerId);

                // Register with Relay fallback (non-blocking)
                this.connectToRelay(peerId);

                // Add ourselves to the store
                const state = useGameStore.getState();
                state.setPlayerName(playerName);
                state.setIsMultiplayer(true);
                (window as any).isMPClient = false; // We are Host

                this.startPositionSync();
                this.startWorldSync();

                if (isPublic) {
                    this.startLobbyHeartbeat(peerId, playerName, !!password, isOnline, isLegacy);
                }

                resolve(peerId);
            });

            this.peer.on('connection', (conn) => {
                console.log(`[MP] Client ${conn.peer} connecting...`);

                conn.on('data', async (data: any) => {
                    const packet = decodePacket<ClientPacket>(data);
                    if (!packet) return;

                    // Handshake logic
                    if (!this.connections.has(conn.peer)) {
                        if (packet.type !== 'join') {
                            conn.send(encodePacket({ type: 'error', payload: { message: 'Błąd protokołu: Musisz najpierw dołączyć.' } } as any));
                            return setTimeout(() => conn.close(), 100);
                        }

                        // Online Mode Check (Host side)
                        const { token, uuid, name } = packet.payload;

                        if (isOnline) {
                            try {
                                const verifyRes = await fetch('/api/auth/verify', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ token, uuid }),
                                    signal: AbortSignal.timeout(3000)
                                });
                                const verifyData = await verifyRes.json();
                                if (!verifyData.success) {
                                    conn.send(encodePacket({ type: 'server_warning', payload: { message: 'Błąd weryfikacji UUID! Dołączasz jako gość.', severity: 'low' } } as any));
                                    console.log(`[MP] P2P Auth verification failed for ${name}, allowing as guest.`);
                                } else {
                                    console.log(`[MP] Host verified Online Player: ${name} (${uuid})`);
                                }
                            } catch (e) {
                                conn.send(encodePacket({ type: 'server_warning', payload: { message: 'Serwer autoryzacji niedostępny. Dołączasz w trybie Offline.', severity: 'medium' } } as any));
                                console.warn(`[MP] Auth server unreachable for P2P client ${name}, falling back to offline.`);
                            }
                        }

                        // Validate password
                        if (this.serverPassword && packet.payload.password !== this.serverPassword) {
                            console.warn(`[MP] Client ${conn.peer} failed password check.`);
                            conn.send(encodePacket({ type: 'error', payload: { message: 'Błędne hasło!' } } as any));
                            setTimeout(() => conn.close(), 500);
                            return;
                        }
                        // Password OK or not needed
                        this.connections.set(conn.peer, conn);
                    }

                    // Handle the packet (now with senderId)
                    this.handlePacket(packet, conn.peer);
                });

                conn.on('close', () => {
                    console.log(`[MP] Client ${conn.peer} left.`);
                    this.connections.delete(conn.peer);
                    this.broadcastPacket({ type: 'player_leave', payload: { id: conn.peer } }, conn.peer);
                    this.handlePacket({ type: 'player_leave', payload: { id: conn.peer } }); // Notify host's local state
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

    private lastSyncTime: number = 0;

    /** Connect to a Host */
    async joinGame(hostId: string, playerName: string, password: string = ''): Promise<void> {
        this.disconnect();

        // WSS Enforcement & Security check
        let targetUrl = hostId;
        if (window.location.protocol === 'https:' && targetUrl.startsWith('ws://')) {
            console.warn('[MP] Unsecure WebSocket detected on HTTPS page. Upgrading to WSS...');
            targetUrl = targetUrl.replace('ws://', 'wss://');
            alert('UWAGA: Wykryto niebezpieczne połączenie (WS). Automatycznie ulepszono do WSS dla bezpieczeństwa.');
        }

        // Check if hostId is a WebSocket URL (dedicated server)
        if (targetUrl.startsWith('ws://') || targetUrl.startsWith('wss://')) {
            console.log(`[MP] Connecting to Dedicated Server: ${targetUrl}`);
            return this.joinWebSocket(targetUrl, playerName, password);
        }

        this.role = 'client';
        this.status = 'connecting';
        console.log(`[MP] Connecting to Host: ${hostId}...`);

        return new Promise(async (resolve, reject) => {
            const myId = 'muzo-cli-' + Math.random().toString(36).substring(2, 6);
            this.peer = new Peer(myId, { debug: 1, config: this.config });

            // Connect to Relay for fallback signaling/tunneling (non-blocking)
            this.connectToRelay(myId);

            // If we have an online session, use it
            if (!this.authSession) await this.claimSession(playerName);

            const connectionTimeout = setTimeout(() => {
                if (this.status === 'connecting') {
                    console.warn('[MP] P2P connection timed out (5s), switching to Replicator Relay fallback.');
                    this.isUsingRelay = true;
                    this.status = 'connected';
                    this.currentLobbyId = hostId;
                    (window as any).isMPClient = true;

                    // Clear any pending PeerJS attempts
                    if (this.hostConn) {
                        this.hostConn.close();
                        this.hostConn = null;
                    }

                    // Send join packet via Relay
                    this.sendViaRelay(hostId, {
                        type: 'join',
                        payload: {
                            name: playerName,
                            password,
                            version: PROTOCOL_VERSION,
                            token: this.authSession?.token || 'offline',
                            uuid: this.authSession?.uuid || `off-${Math.random().toString(36).substring(2, 6)}`
                        }
                    });

                    if (this.joinResolve) {
                        this.joinResolve();
                        this.joinResolve = null;
                        this.joinReject = null;
                    }
                }
            }, 5000);

            this.joinResolve = resolve;
            this.joinReject = (err) => {
                clearTimeout(connectionTimeout);
                this.disconnect();
                reject(err);
            };

            this.peer.on('open', (id) => {
                const conn = this.peer!.connect(hostId, {
                    reliable: true,
                    metadata: {
                        name: playerName,
                        password,
                        version: PROTOCOL_VERSION,
                        token: this.authSession?.token || 'offline',
                        uuid: this.authSession?.uuid || `off-${Math.random().toString(36).substring(2, 6)}`
                    }
                });
                this.hostConn = conn;

                conn.on('open', () => {
                    clearTimeout(connectionTimeout);
                    this.status = 'connected';
                    this.currentLobbyId = hostId;
                    this.isUsingRelay = false;
                    console.log('[MP] P2P channel open, waiting for welcome...');
                    // resolve/multiplayer state moved to welcome handler
                });

                conn.on('data', (data: any) => {
                    const packet = decodePacket(data);
                    if (packet) this.handlePacket(packet);
                });

                conn.on('close', () => {
                    this.status = 'disconnected';
                    console.log('[MP] Disconnected from Host');
                    this.handleHostDisconnect();
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

    private async joinWebSocket(url: string, playerName: string, password: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.ws?.readyState !== 1) {
                    this.ws?.close();
                    this.ws = null;
                    console.error('[MP] Dedicated server connection timeout (5s)');
                    reject(new Error('Połączenie przekroczyło limit czasu (5s)'));
                }
            }, 5000);

            this.ws = new WebSocket(url);
            this.ws.binaryType = 'arraybuffer';

            this.ws.onopen = async () => {
                clearTimeout(timeout);
                this.status = 'connected';
                console.log('[MP] WS connected, sending join packet...');

                if (!this.ws) return;

                // Ensure auth session for online servers
                if (!this.authSession) await this.claimSession(playerName);

                this.ws.send(encodePacket({
                    type: 'join',
                    payload: {
                        name: playerName,
                        password,
                        version: PROTOCOL_VERSION,
                        token: this.authSession?.token || 'offline',
                        uuid: this.authSession?.uuid || `off-${Math.random().toString(36).substring(2, 6)}`,
                        dimension: useGameStore.getState().dimension,
                        pos: useGameStore.getState().playerPos,
                        rot: useGameStore.getState().playerRot,
                        isUnderwater: useGameStore.getState().isUnderwater
                    }
                }));
                // resolve/multiplayer state moved to welcome handler
            };

            this.ws.onmessage = (event) => {
                const packet = decodePacket<ServerPacket>(event.data);
                if (packet) this.handlePacket(packet);
            };

            this.ws.onclose = () => {
                clearTimeout(timeout);
                console.warn('[MP] WebSocket closed');
                this.status = 'disconnected';
                if (!this.ws) return; // Already disconnected manually
                if (this.role === 'client') {
                    this.handleHostDisconnect();
                } else {
                    this.disconnect();
                }
            };

            this.ws.onerror = (err) => {
                clearTimeout(timeout);
                console.error('[MP] WebSocket error:', err);
                this.status = 'error';
                reject(new Error('Błąd połączenia z serwerem'));
            };
        });
    }

    disconnect(reason: string = 'manual'): void {
        console.log(`[MP] Disconnecting session. Reason: ${reason}`);
        const state = useGameStore.getState();
        this.status = 'disconnected';

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        if (this.relayWs) {
            this.relayWs.onclose = null; // Prevent reconnect loop
            this.relayWs.close();
            this.relayWs = null;
        }
        this.relayClientIds.clear();

        this.stopPositionSync();
        this.stopWorldSync();
        this.stopLobbyHeartbeat();
        this.stopPingHeartbeat();

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
        if (this.currentLobbyId) {
            fetch(`/api/multiplayer/host/${this.currentLobbyId}`, { method: 'DELETE' }).catch(() => { });
            this.currentLobbyId = null;
        }
        state.setServerWarning(null); // Clear warnings on manual disconnect
        state.setIsMultiplayer(false);
        state.clearConnectedPlayers();
        this.nidToUuid.clear();
        this.role = 'none';
    }

    // ── HOST Logic: Broadcast and Relay ─────────────────────

    private handleHostDisconnect(): void {
        const state = useGameStore.getState();
        if (this.role !== 'client') return;

        console.warn('[MP] Host disconnected! Starting Host Migration election...');
        state.addChatMessage('System', '§cPołączenie z hostem przerwane! Szukanie nowego hosta...', 'system');

        // Election algorithm: Sort all player IDs (including own) and pick the first one
        const playerIds = [state.playerId, ...Object.keys(state.connectedPlayers)].sort();
        const winnerId = playerIds[0];

        if (winnerId === state.playerId) {
            console.log('[MP] I am the new host! Re-hosting...');
            state.addChatMessage('System', '§aZostałeś nowym hostem! Sesja jest kontynuowana.', 'system');
            this.promoteToHost();
        } else {
            console.log(`[MP] New host elected: ${winnerId}. Waiting for signal...`);
            // Set a timeout for the migration signal
            setTimeout(() => {
                if (this.status === 'disconnected') {
                    state.addChatMessage('System', '§cMigracja nie powiodła się. Powrót do menu.', 'system');
                    this.disconnect();
                    state.setScreen('mainMenu');
                }
            }, 10000);
        }
    }

    private async promoteToHost(): Promise<void> {
        const state = useGameStore.getState();
        const oldLobbyId = this.currentLobbyId;

        console.log('[MP] Promoting to Host...');

        // Disconnect client-side networking
        this.stopPositionSync();
        this.hostConn = null;
        this.ws = null;
        this.role = 'host';

        // Start hosting
        await this.hostGame(state.playerName, true, '', false, false);

        // Inform peers via Relay room
        if (this.relayWs?.readyState === 1 && oldLobbyId) {
            console.log('[MP] Broadcasting migration signal to room...');
            this.relayWs.send(JSON.stringify({
                type: 'host_migration',
                payload: { newHostId: this.ownId }
            }));
        }
    }

    private handleMigrationSignal(newHostId: string): void {
        const state = useGameStore.getState();
        if (this.status !== 'disconnected') return;

        console.log(`[MP] Received migration signal! New host: ${newHostId}`);
        state.addChatMessage('System', '§bPodłączanie do nowego hosta...', 'system');

        this.joinGame(newHostId, state.playerName).catch(err => {
            console.error('[MP] Failed to join new host:', err);
            this.disconnect();
            state.setScreen('mainMenu');
        });
    }

    private sendToPeer(peerId: string, packet: ServerPacket): void {
        const conn = this.connections.get(peerId);
        if (conn && conn.open) {
            packet.seq = this.outSeq++;
            packet.ts = Date.now();
            conn.send(encodePacket(packet as any));
        }
    }

    private sendToPlayer(playerId: string, packet: ServerPacket): void {
        packet.seq = this.outSeq++;
        packet.ts = Date.now();
        const encoded = encodePacket(packet as any);

        // Try direct peer connection
        const conn = this.connections.get(playerId);
        if (conn && conn.open) {
            conn.send(encoded);
            return;
        }

        // Try dedicated websocket (not applicable for sending TO a client, but keeping for symmetry if needed)

        // Fallback to relay
        this.sendViaRelay(playerId, packet);
    }

    private broadcastPacket(packet: ServerPacket, excludePeer?: string): void {
        packet.seq = this.outSeq++;
        packet.ts = Date.now();
        const encoded = encodePacket(packet as any);

        // Broadcast via PeerJS
        for (const [id, conn] of this.connections) {
            if (id !== excludePeer && conn.open) {
                conn.send(encoded);
            }
        }

        // Broadcast via Relay fallback
        if (this.relayWs?.readyState === 1) {
            for (const id of this.relayClientIds) {
                // Only use relay if P2P connection to this client is not open
                const peerConn = this.connections.get(id);
                if (id !== excludePeer && (!peerConn || !peerConn.open)) {
                    this.sendViaRelay(id, packet);
                }
            }
        }
    }

    // ── OUTGOING CLIENT OR HOST Logic ───────────────────────
    // Called by the local game (Player.tsx, BlockActions.tsx)

    private sendToHost(packet: ClientPacket): void {
        packet.seq = this.outSeq++;
        packet.ts = Date.now();
        const encoded = encodePacket(packet);
        if (this.ws) {
            this.ws.send(encoded);
        } else if (this.isUsingRelay) {
            this.sendViaRelay(this.currentLobbyId!, packet);
        } else if (this.hostConn?.open) {
            this.hostConn.send(encoded);
        } else if (this.role === 'host') {
            // If we are the host, our local actions are instantly broadcasted as SERVER packets
            switch (packet.type) {
                case 'move':
                    this.broadcastPacket({
                        type: 'player_move',
                        payload: { id: 'host', nid: 0, pos: packet.payload.pos, rot: packet.payload.rot, dimension: packet.payload.dimension, isUnderwater: packet.payload.isUnderwater }
                    });
                    break;
                case 'block_place':
                case 'block_break':
                    const bt = packet.type === 'block_place' ? packet.payload.blockType : 0;
                    this.broadcastPacket({
                        type: 'block_update',
                        payload: { x: packet.payload.x, y: packet.payload.y, z: packet.payload.z, blockType: bt }
                    });
                    break;
                case 'chat': {
                    const store = useGameStore.getState();
                    this.broadcastPacket({
                        type: 'chat_broadcast',
                        payload: { sender: store.playerName, text: (packet.payload as any).text }
                    });
                    break;
                }
                case 'ping':
                    // Just echo for host testing
                    break;
            }
        }
    }

    sendMove(pos: [number, number, number], rot: [number, number]): void {
        const state = useGameStore.getState();
        const dim = state.dimension;
        const sub = state.isUnderwater;
        const health = state.health;
        this.sendToHost({ type: 'move', payload: { pos, rot, dimension: dim, isUnderwater: sub, health } as any });
    }

    sendBlockUpdate(x: number, y: number, z: number, blockType: number): void {
        const type = blockType === 0 ? 'block_break' : 'block_place';
        this.sendToHost({
            type: type as any,
            payload: { x, y, z, blockType }
        });
    }

    sendBlockBreak(x: number, y: number, z: number): void {
        this.sendBlockUpdate(x, y, z, 0);
    }

    sendChat(text: string): void {
        this.sendToHost({ type: 'chat', payload: { text } });
    }

    sendWorldEvent(event: string, x: number, y: number, z: number, data?: any): void {
        this.sendToHost({ type: 'world_event', payload: { event, x, y, z, data } });
    }

    sendAction(actionType: 'eat' | 'hit' | 'swing'): void {
        this.sendToHost({ type: 'action', payload: { actionType } as any });
    }

    sendPing(): void {
        this.sendToHost({ type: 'ping', payload: { ts: Date.now() } });
    }

    sendInventoryUpdate(payload: any): void {
        this.sendToHost({ type: 'inventory_update', payload });
    }

    sendEntitySync(type: 'item' | 'arrow' | 'tnt', id: string, pos: [number, number, number], vel?: [number, number, number], data?: any): void {
        this.sendToHost({ type: 'entity_sync', payload: { type, id, pos, vel, data } });
    }

    sendEntityRemove(type: 'item' | 'tnt' | 'arrow', id: string): void {
        this.sendToHost({ type: 'entity_remove', payload: { id } });
    }

    sendWorldSync(payload: { time?: number, weather?: string, weatherIntensity?: number }): void {
        if (this.role !== 'host') return;
        this.broadcastPacket({ type: 'world_sync', payload });
    }

    getPing(): number {
        return this.ping;
    }

    getClockOffset(): number {
        return this.clockOffset;
    }

    // ── CLIENT Receive Logic ────────────────────────────────

    private handlePacket(packet: ServerPacket | ClientPacket, senderId?: string): void {
        if (senderId) {
            if (!this.connections.has(senderId)) {
                this.relayClientIds.add(senderId);
            }

            // Sequence Check
            if (packet.seq !== undefined) {
                const last = this.lastInSeq.get(senderId) || -1;
                if (packet.seq <= last) return; // Ignore old/duplicate packet
                this.lastInSeq.set(senderId, packet.seq);
            }
        }

        const store = useGameStore.getState();

        switch (packet.type) {
            case 'welcome': {
                const { playerId, nid, players, worldSeed, time, weather, weatherIntensity } = packet.payload;
                this.ownId = playerId;
                this.ownNid = nid || 0;
                console.log(`[MP] Welcome! My ID: ${playerId} (Nid: ${nid})`);

                if (worldSeed !== undefined) {
                    console.log(`[MP] Syncing world: Resetting before seed ${worldSeed}`);
                    store.resetWorld(); // CRITICAL: Clear local chunks before setting new seed
                    store.setWorldSeed(worldSeed);
                }
                if (time !== undefined) store.setDayTime(time);
                if (weather !== undefined) store.setWeather(weather as any, weatherIntensity);

                // Add existing players
                // If this is P2P (not Dedicated), and host is not in list, add host
                if (this.role === 'client' && !this.ws && !players.find(p => p.id === 'host')) {
                    this.nidToUuid.set(0, 'host');
                    // We don't necessarily need to add 'host' to store.connectedPlayers here if it's already in the players array sent by host
                }

                for (const p of players) {
                    store.addConnectedPlayer(p.id, p.name, p.pos, p.rot, p.dimension as Dimension, p.isUnderwater, p.health, p.latency, p.ts, p.nid);
                    if (p.nid !== undefined) this.nidToUuid.set(p.nid, p.id);
                    if (p.id === 'host' && p.nid === undefined) this.nidToUuid.set(0, 'host');
                }

                // Finalize join
                store.setIsMultiplayer(true);
                (window as any).isMPClient = true;
                this.startPositionSync();
                this.startPingHeartbeat();

                if (this.joinResolve) {
                    this.joinResolve();
                    this.joinResolve = null;
                    this.joinReject = null;
                }
                break;
            }

            case 'join': {
                if (this.role === 'host' && senderId) {
                    const { name, pos, rot, dimension, isUnderwater, nid } = (packet as any).payload;
                    store.addConnectedPlayer(senderId, name, pos || [0, 64, 0], rot || [0, 0], (dimension as Dimension) || 'overworld', !!isUnderwater);
                    if (nid !== undefined) {
                        this.nidToUuid.set(nid, senderId);
                    }

                    const welcomePacket = {
                        type: 'welcome',
                        payload: {
                            playerId: senderId,
                            nid: nid,
                            worldSeed: store.worldSeed,
                            players: [
                                { id: 'host', name: store.playerName, pos: store.playerPos, rot: store.playerRot, dimension: store.dimension, isUnderwater: store.isUnderwater, health: store.health, nid: 0 },
                                ...Object.entries(store.connectedPlayers).map(([id, p]) => ({ id, ...p } as any))
                            ],
                            time: store.dayTime,
                            weather: store.weather
                        }
                    } as any;

                    this.sendToPlayer(senderId, welcomePacket);

                    this.broadcastPacket({
                        type: 'player_join',
                        payload: { id: senderId, nid: nid, name, pos: pos || [0, 64, 0], rot: rot || [0, 0], dimension: dimension || 'overworld', isUnderwater: !!isUnderwater }
                    }, senderId);
                }
                break;
            }

            case 'move': {
                if (this.role === 'host' && senderId) {
                    const { pos, rot, dimension, isUnderwater } = packet.payload;
                    const p = store.connectedPlayers[senderId];
                    if (!p) return;

                    store.addConnectedPlayer(senderId, p.name, pos, rot, dimension as Dimension, isUnderwater, p.health, this.lastLatency.get(senderId) || 0);

                    this.broadcastPacket({
                        type: 'player_move',
                        payload: { id: senderId, nid: p.nid, pos, rot, dimension, isUnderwater, health: p.health, latency: this.lastLatency.get(senderId) || 0 }
                    }, senderId);
                }
                break;
            }

            case 'block_place':
            case 'block_break': {
                if (this.role === 'host' && senderId) {
                    const { x, y, z } = packet.payload;
                    const blockType = packet.type === 'block_place' ? (packet.payload as any).blockType : 0;

                    console.log(`[MP] Client ${senderId} ${packet.type}: ${x}, ${y}, ${z} (${blockType})`);

                    if (blockType === 0) store.removeBlock(x, y, z, true);
                    else store.addBlock(x, y, z, blockType, true);

                    const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
                    store.bumpVersion(cx, cz);

                    // Broadcast to all other clients
                    this.broadcastPacket({
                        type: 'block_update',
                        payload: { x, y, z, blockType }
                    }, senderId);
                }
                break;
            }

            case 'chat': {
                if (this.role === 'host' && senderId) {
                    const { text } = packet.payload;
                    const p = store.connectedPlayers[senderId];
                    const senderName = p ? p.name : 'Unknown';

                    store.addChatMessage(senderName, text, 'player');
                    this.broadcastPacket({
                        type: 'chat_broadcast',
                        payload: { sender: senderName, text }
                    }, senderId);
                }
                break;
            }

            case 'action': {
                if (this.role === 'host' && senderId) {
                    const { actionType } = (packet.payload as any);
                    this.broadcastPacket({
                        type: 'player_action',
                        payload: { id: senderId, actionType }
                    }, senderId);
                }
                break;
            }

            case 'entity_sync': {
                if (this.role === 'host') this.broadcastPacket(packet as any, senderId);

                const { type, id, pos, vel, data } = packet.payload;
                if (type === 'item') store.addDroppedItem(data, pos, vel, id);
                if (type === 'tnt') store.spawnTNT(pos, data || 80, true);
                break;
            }

            case 'entity_remove': {
                if (this.role === 'host') this.broadcastPacket(packet as any, senderId);
                const { id } = packet.payload;
                store.removeDroppedItem(id, true);
                store.removeTNT(id, true);
                store.removeArrow(id, true);
                break;
            }

            case 'entity_velocity': {
                if (this.role === 'host') this.broadcastPacket(packet as any, senderId);
                break;
            }

            case 'relay_signal': {
                console.log(`[MP] Relay signal from ${packet.payload.from}`);
                break;
            }

            case 'player_join': {
                const { id, nid, name, pos, rot, dimension, isUnderwater } = packet.payload;
                store.addConnectedPlayer(id, name, pos, rot, dimension as Dimension, isUnderwater, 20, 0);
                if (nid !== undefined) {
                    this.nidToUuid.set(nid, id);
                    if (store.connectedPlayers[id]) {
                        store.connectedPlayers[id].nid = nid;
                    }
                }
                store.addChatMessage('System', `${name} joined!`, 'system');
                break;
            }

            case 'player_leave': {
                store.removeConnectedPlayer(packet.payload.id);
                store.addChatMessage('System', `A player left.`, 'system');
                break;
            }

            case 'ping': {
                if (senderId) {
                    this.sendToPeer(senderId, { type: 'pong', payload: { ts: packet.payload.ts } });
                } else if (this.role === 'client') {
                    // Host/Dedicated server is pinging us
                    this.sendToHost({ type: 'pong', payload: { ts: packet.payload.ts } } as any);
                }
                break;
            }

            case 'pong': {
                const rtt = Date.now() - packet.payload.ts;
                if (!senderId) {
                    // This is our main ping to host/dedicated server
                    this.ping = rtt;
                    store.setPing(rtt);

                    // Clock Offset Estimation (NTP-lite)
                    if (packet.ts) {
                        const estimatedServerTimeAtReceive = packet.ts + rtt / 2;
                        const newOffset = estimatedServerTimeAtReceive - Date.now();
                        // Average over time for stability (start with 100% on first ping)
                        if (this.clockOffset === 0) this.clockOffset = newOffset;
                        else this.clockOffset = this.clockOffset * 0.9 + newOffset * 0.1;

                        console.log(`[MP] RTT: ${rtt}ms, Clock Offset: ${Math.round(this.clockOffset)}ms`);
                    }
                } else {
                    // This is a ping from a client if we are host
                    this.lastLatency.set(senderId, rtt);
                    const existing = store.connectedPlayers[senderId];
                    if (existing) {
                        store.addConnectedPlayer(senderId, undefined, undefined, undefined, undefined, undefined, undefined, rtt);
                    }
                }
                break;
            }

            case 'server_warning': {
                store.setServerWarning({
                    message: packet.payload.message,
                    severity: packet.payload.severity || 'medium'
                });
                break;
            }

            case 'mod_info': {
                console.log('[MP] Server Mod Meta:', (packet as any).payload.mods);
                break;
            }

            case 'world_event': {
                const { event, x, y, z, data } = packet.payload;

                // If we are host, broadcast to everyone else
                if (this.role === 'host' && senderId) {
                    this.broadcastPacket(packet as any, senderId);
                }

                if (event === 'block_break') {
                    import('../audio/sounds').then(({ playSound }) => playSound('break', [x, y, z]));
                    import('../core/particles').then(({ emitBlockBreak }) => emitBlockBreak(x, y, z, data || 0));
                } else if (event === 'explosion') {
                    import('../audio/sounds').then(({ playSound }) => playSound('explode', [x, y, z]));
                    import('../core/particles').then(({ emitExplosion }) => emitExplosion(x, y, z));
                } else if (event === 'skip_night') {
                    store.skipNight(true);
                }
                break;
            }

            case 'player_move': {
                const { id, nid, pos, rot, dimension, isUnderwater, latency, ts, health } = packet.payload;
                const resolvedId = id || (nid !== undefined ? this.nidToUuid.get(nid) : null);

                if (resolvedId) {
                    const prev = store.connectedPlayers[resolvedId] || { name: 'Player', pos: [0, 64, 0], rot: [0, 0], dimension: 'overworld' };
                    store.addConnectedPlayer(resolvedId, prev.name, pos, rot || prev.rot, (dimension as Dimension) || prev.dimension, isUnderwater, health, latency, ts, nid);
                    if (nid !== undefined) this.nidToUuid.set(nid, resolvedId);
                }
                break;
            }

            case 'block_update': {
                const { x, y, z, blockType } = packet.payload;
                if (blockType === 0) store.removeBlock(x, y, z, true);
                else store.addBlock(x, y, z, blockType, true);
                const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
                store.bumpVersion(cx, cz);
                break;
            }

            case 'chat_broadcast': {
                store.addChatMessage(packet.payload.sender, packet.payload.text, 'player');
                break;
            }

            case 'player_action': {
                const { id, actionType } = packet.payload;
                if (store.connectedPlayers[id]) {
                    const s = useGameStore.getState();
                    const players = { ...s.connectedPlayers };
                    if (players[id]) {
                        players[id] = { ...players[id], lastAction: { type: actionType, time: Date.now() } };
                        useGameStore.setState({ connectedPlayers: players });
                    }
                }
                break;
            }

            case 'world_sync': {
                const { time, weather, weatherIntensity } = packet.payload;
                if (time !== undefined) store.setDayTime(time);
                if (weather) store.setWeather(weather as any, weatherIntensity);
                break;
            }

            case 'peer_list': {
                const ids: string[] = (packet.payload as any).ids;
                if (ids) {
                    ids.forEach(id => {
                        if (id !== this.ownId && !this.connections.has(id)) {
                            this.connectToPeer(id);
                        }
                    });
                }
                break;
            }

            case 'handshake': {
                if (senderId) {
                    this.sendToPeer(senderId, { type: 'handshake_ack' });
                }
                break;
            }

            case 'inventory_update': {
                if (this.role === 'host') this.broadcastPacket(packet as any, senderId);

                const { type, key, data } = packet.payload;
                if (type === 'chest') {
                    store.setChest(key, data, true);
                } else if (type === 'furnace') {
                    store.setFurnace(data, true);
                }
                break;
            }

            case 'error': {
                console.error('[MP] Server error:', packet.payload.message);
                if (this.joinReject) {
                    this.joinReject(new Error(packet.payload.message));
                    this.joinResolve = null;
                    this.joinReject = null;
                }
                break;
            }

            case 'world_data': {
                const { blocks } = packet.payload;
                if (blocks && Array.isArray(blocks)) {
                    blocks.forEach(b => {
                        if (b.type === 0) store.removeBlock(b.x, b.y, b.z, true);
                        else store.addBlock(b.x, b.y, b.z, b.type, true);
                        const cx = Math.floor(b.x / 16), cz = Math.floor(b.z / 16);
                        store.bumpVersion(cx, cz);
                    });
                }
                break;
            }

            case 'chunk_data': {
                const { cx, cz, data } = packet.payload;
                // Handle complex chunk sync if needed
                store.bumpVersion(cx, cz);
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

    // ── World Sync (Host → Clients) ───────────────────────

    private startWorldSync(): void {
        this.syncTimer = setInterval(() => {
            const state = useGameStore.getState();
            this.broadcastPacket({
                type: 'world_sync' as any,
                payload: {
                    time: state.dayTime,
                    weather: state.weather,
                    weatherIntensity: state.weatherIntensity
                }
            } as any);
        }, 5000); // Sync every 5s
    }

    private stopWorldSync(): void {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
    }


    // ── Lobby Registration (Host → index.js) ───────────────

    private async connectToRelay(myId: string): Promise<void> {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.warn('[MP] Relay connection timeout (2s). Proceeding in offline/direct mode.');
                resolve();
            }, 2000);

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            this.relayWs = new WebSocket(`${protocol}//${window.location.host}/relay`);

            this.relayWs.onopen = () => {
                clearTimeout(timeout);
                // Register with room ID (current lobby) for migration signaling
                this.relayWs?.send(JSON.stringify({
                    type: 'register',
                    id: myId,
                    roomId: this.currentLobbyId
                }));
                console.log(`[MP] Registered with Replicator Relay in room: ${this.currentLobbyId}`);
                resolve();
            };

            this.relayWs.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'tunneled' && msg.from) {
                        if (this.role === 'host') {
                            this.relayClientIds.add(msg.from);
                        }
                        const packet = decodePacket(msg.payload);
                        if (packet) this.handlePacket(packet, msg.from);
                    } else if (msg.type === 'host_migration') {
                        this.handleMigrationSignal(msg.payload.newHostId);
                    }
                } catch (e) { }
            };

            this.relayWs.onclose = () => {
                console.warn('[MP] Relay connection closed. Reconnecting in 5s...');
                setTimeout(() => {
                    if (this.peerId) this.connectToRelay(this.peerId);
                }, 5000);
            };

            this.relayWs.onerror = () => {
                clearTimeout(timeout);
                console.warn('[MP] Relay connection failed. Proceeding without Replicator Relay.');
                resolve();
            };
        });
    }

    private sendViaRelay(to: string, packet: any): void {
        if (this.relayWs?.readyState === 1) {
            let payload = encodePacket(packet);

            // Special case: ArrayBuffer cannot be stringified by JSON.stringify
            if (payload instanceof ArrayBuffer) {
                payload = Array.from(new Uint8Array(payload)) as any;
            }

            this.relayWs.send(JSON.stringify({
                type: 'tunnel',
                to,
                payload
            }));
        }
    }

    private async registerLobby(id: string, name: string, hasPassword: boolean, isOnline?: boolean, isLegacy?: boolean): Promise<void> {
        try {
            const state = useGameStore.getState();
            const players = Object.keys(state.connectedPlayers).length + 1; // +1 for host
            await fetch('/api/multiplayer/host', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, name, players, hasPassword, isOnlineMode: !!isOnline, isLegacy: !!isLegacy, version: PROTOCOL_VERSION })
            });
        } catch (e) {
            console.warn('[MP] Failed to register lobby:', e);
        }
    }

    private startLobbyHeartbeat(id: string, name: string, hasPassword: boolean, isOnline: boolean, isLegacy: boolean): void {
        this.registerLobby(id, name, hasPassword, isOnline, isLegacy);
        this.lobbyTimer = setInterval(async () => {
            this.registerLobby(id, name, hasPassword, isOnline, isLegacy);

            // Detailed health report
            const state = useGameStore.getState();
            const players = Object.keys(state.connectedPlayers).length + 1; // +1 for host
            await fetch('/api/multiplayer/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    players: players,
                    load: 0,
                    uptime: 0,
                    isOnlineMode: isOnline,
                    isLegacy: isLegacy
                })
            }).catch(() => { });
        }, 20000); // 20s heartbeat
    }

    private stopLobbyHeartbeat(): void {
        if (this.lobbyTimer) {
            clearInterval(this.lobbyTimer);
            this.lobbyTimer = null;
        }
    }

    private connectToPeer(id: string): void {
        if (this.role !== 'host') return;
        console.log(`[MP] Connecting to peer: ${id}`);
        const conn = this.peer!.connect(id);
        conn.on('open', () => {
            this.connections.set(id, conn);
            conn.send(encodePacket({ type: 'handshake' } as any));
        });
        conn.on('data', (data: any) => {
            const packet = decodePacket<ClientPacket>(data);
            if (packet) this.handlePacket(packet, id);
        });
    }

    private startPingHeartbeat(): void {
        if (this.pingInterval) return;
        this.pingInterval = setInterval(() => {
            this.sendPing();
        }, 2000);
    }

    private stopPingHeartbeat(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
}

let connectionInstance: ConnectionManager | null = null;
export function getConnection(): ConnectionManager {
    if (!connectionInstance) connectionInstance = new ConnectionManager();
    return connectionInstance;
}
