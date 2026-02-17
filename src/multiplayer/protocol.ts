/**
 * Multiplayer Protocol — Packet types and helpers
 *
 * Defines the network protocol for future WebSocket multiplayer.
 * All packets are JSON-serialized.
 *
 * Architecture:
 *   Client → Server: PlayerMove, BlockPlace, BlockBreak, ChatMessage
 *   Server → Client: WorldState, PlayerJoin, PlayerLeave, BlockUpdate, ChatBroadcast
 *   Server → All: PlayerPositions (broadcast every 50ms)
 */

// ─── Packet Types ────────────────────────────────────────

export type ClientPacket =
    | { type: 'join'; payload: { name: string } }
    | { type: 'move'; payload: { pos: [number, number, number]; rot: [number, number] } }
    | { type: 'block_place'; payload: { x: number; y: number; z: number; blockType: number } }
    | { type: 'block_break'; payload: { x: number; y: number; z: number } }
    | { type: 'chat'; payload: { text: string } }
    | { type: 'ping'; payload: { ts: number } };

export type ServerPacket =
    | { type: 'welcome'; payload: { playerId: string; worldSeed: number; players: PlayerInfo[] } }
    | { type: 'player_join'; payload: PlayerInfo }
    | { type: 'player_leave'; payload: { id: string } }
    | { type: 'player_move'; payload: { id: string; pos: [number, number, number]; rot: [number, number] } }
    | { type: 'block_update'; payload: { x: number; y: number; z: number; blockType: number } }
    | { type: 'chat_broadcast'; payload: { sender: string; text: string; time: number } }
    | { type: 'chunk_data'; payload: { cx: number; cz: number; data: Record<string, number> } }
    | { type: 'pong'; payload: { ts: number; serverTime: number } };

export interface PlayerInfo {
    id: string;
    name: string;
    pos: [number, number, number];
    rot: [number, number];
    gameMode: 'survival' | 'creative' | 'spectator';
    health: number;
    skin?: string;
}

// ─── Serialization ───────────────────────────────────────

export function encodePacket(packet: ClientPacket): string {
    return JSON.stringify(packet);
}

export function decodePacket(data: string): ServerPacket | null {
    try {
        return JSON.parse(data) as ServerPacket;
    } catch {
        console.warn('[Protocol] Failed to decode packet:', data.slice(0, 100));
        return null;
    }
}

// ─── Constants ───────────────────────────────────────────

export const PROTOCOL_VERSION = 1;
export const TICK_RATE = 20; // server ticks per second
export const POSITION_SYNC_INTERVAL = 50; // ms between position broadcasts
export const MAX_CHAT_LENGTH = 256;
export const MAX_PLAYERS = 20;
export const DEFAULT_PORT = 3001;
