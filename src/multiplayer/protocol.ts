/**
 * Multiplayer Protocol — Packet types and helpers
 *
 * Defines the network protocol for future WebSocket multiplayer.
 * Standard 1.0 — Robust Checksumming & Binary Optimization.
 */

// ─── Constants ───────────────────────────────────────────

export const PROTOCOL_VERSION = 10; // Standard 1.0
export const TICK_RATE = 20;
export const POSITION_SYNC_INTERVAL = 50;
export const MAX_CHAT_LENGTH = 256;
export const MAX_PLAYERS = 20;
export const DEFAULT_PORT = 3001;

// Global encoders to prevent GC spikes
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

// CRC-32 Table
const CRC_TABLE = new Int32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    CRC_TABLE[i] = c;
}

function calculateCRC32(data: Uint8Array): number {
    let crc = -1;
    for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xFF];
    }
    return (crc ^ -1) >>> 0;
}

// ─── Packet Types ────────────────────────────────────────

export type ClientPacket = (
    | { type: 'join'; payload: { name: string; password?: string; version?: number; token?: string; uuid?: string; dimension?: string; pos?: [number, number, number]; rot?: [number, number]; isUnderwater?: boolean } }
    | { type: 'move'; payload: { pos: [number, number, number]; rot: [number, number]; dimension?: string; isUnderwater?: boolean; health?: number } }
    | { type: 'block_place'; payload: { x: number; y: number; z: number; blockType: number } }
    | { type: 'block_break'; payload: { x: number; y: number; z: number } }
    | { type: 'chat'; payload: { text: string } }
    | { type: 'action'; payload: { actionType: 'eat' | 'hit' | 'swing' } }
    | { type: 'ping'; payload: { ts: number } }
    | { type: 'pong'; payload: { ts: number } }
    | { type: 'ack'; payload: { seq: number } }
    | { type: 'mod_info'; payload: { mods: { id: string; version: string; required: boolean }[] } }
    | { type: 'entity_sync'; payload: { type: 'item' | 'arrow' | 'tnt'; id: string; pos: [number, number, number]; vel?: [number, number, number]; data?: any } }
    | { type: 'entity_velocity'; payload: { id: string; vel: [number, number, number] } }
    | { type: 'entity_remove'; payload: { id: string } }
    | { type: 'world_event'; payload: { event: string; x: number; y: number; z: number; data?: any } }
    | { type: 'relay_signal'; payload: { from: string; data: any } }
    | { type: 'relay_tunnel'; payload: { to: string; data: any } }
    | { type: 'handshake'; payload?: any }
    | { type: 'inventory_update'; payload: any }
) & { seq?: number; checksum?: number; ts?: number }; // ts is added automatically by sending methods

export type ServerPacket = (
    | { type: 'welcome'; payload: { playerId: string; nid?: number; worldSeed?: number; players: PlayerInfo[]; time?: number; weather?: string; weatherIntensity?: number } }
    | { type: 'player_join'; payload: PlayerInfo }
    | { type: 'player_leave'; payload: { id: string } }
    | {
        type: 'player_move'; payload: {
            id?: string; nid?: number; pos: [number, number, number]; rot?: [number, number]; dimension?: string;
            isUnderwater?: boolean;
            health?: number;
            latency?: number;
            ts?: number;
            lastAction?: { type: string, time: number };
        }
    }
    | { type: 'player_action'; payload: { id: string; actionType: string } }
    | { type: 'block_update'; payload: { x: number; y: number; z: number; blockType: number } }
    | { type: 'world_data'; payload: { blocks: { x: number; y: number; z: number; type: number }[] } }
    | { type: 'chat_broadcast'; payload: { sender: string; text: string } }
    | { type: 'chunk_data'; payload: { cx: number; cz: number; data: Record<string, number> } }
    | { type: 'world_sync'; payload: { time?: number; weather?: string; weatherIntensity?: number } }
    | { type: 'error'; payload: { message: string } }
    | { type: 'ping'; payload: { ts: number } }
    | { type: 'pong'; payload: { ts: number } }
    | { type: 'ack'; payload: { seq: number } }
    | { type: 'mod_info'; payload: { mods: { id: string; version: string; required: boolean }[] } }
    | { type: 'server_warning'; payload: { message: string; severity?: 'low' | 'medium' | 'high' | 'critical' } }
    | { type: 'entity_sync'; payload: { type: 'item' | 'arrow' | 'tnt'; id: string; pos: [number, number, number]; vel?: [number, number, number]; data?: any } }
    | { type: 'entity_velocity'; payload: { id: string; vel: [number, number, number] } }
    | { type: 'entity_remove'; payload: { id: string } }
    | { type: 'world_event'; payload: { event: string; x: number; y: number; z: number; data?: any } }
    | { type: 'relay_signal'; payload: { from: string; data: any } }
    | { type: 'peer_list'; payload: { ids: string[] } }
    | { type: 'handshake_ack'; payload?: any }
    | { type: 'inventory_update'; payload: any }
) & { seq?: number; checksum?: number; ts?: number }; // ts is added automatically by sending methods

export interface PlayerInfo {
    id: string;
    nid?: number; // Numeric ID for binary sync (uint16)
    name?: string;
    pos: [number, number, number];
    rot: [number, number];
    dimension?: string;
    health?: number;
    isUnderwater?: boolean;
    latency?: number;
    ts?: number;
    lastAction?: { type: string, time: number };
}

// ─── Serialization ───────────────────────────────────────

// ─── Binary Standard 1.0 ──────────────────────────────────
// [0] TYPE (1)
// [1-4] TS (4)
// [5-22] PAYLOAD

export function encodeMoveBinary(pos: [number, number, number], rot: [number, number], health: number): ArrayBuffer {
    const buffer = new ArrayBuffer(20);
    const view = new DataView(buffer);
    view.setUint8(0, 0x01); // Client -> Host: Move
    view.setUint32(1, Date.now() % 0xFFFFFFFF);
    view.setFloat32(5, pos[0]);
    view.setFloat32(9, pos[1]);
    view.setFloat32(13, pos[2]);
    view.setInt8(17, Math.round(rot[0] * 127 / Math.PI));
    view.setInt8(18, Math.round(rot[1] * 127 / Math.PI));
    view.setUint8(19, health || 20);
    return buffer;
}

export function encodePlayerMoveBinary(nid: number, pos: [number, number, number], rot: [number, number], health: number, latency?: number): ArrayBuffer {
    const buffer = new ArrayBuffer(23);
    const view = new DataView(buffer);
    view.setUint8(0, 0x02); // Host -> Client: PlayerMove
    view.setUint32(1, Date.now() % 0xFFFFFFFF);
    view.setUint16(5, nid || 0);
    view.setFloat32(7, pos[0]);
    view.setFloat32(11, pos[1]);
    view.setFloat32(15, pos[2]);
    view.setInt8(19, Math.round((rot ? rot[0] : 0) * 127 / Math.PI));
    view.setInt8(20, Math.round((rot ? rot[1] : 0) * 127 / Math.PI));
    view.setUint8(21, health || 20);
    view.setUint8(22, Math.min(255, latency || 0));
    return buffer;
}

export function decodePacket<T = ServerPacket>(data: string | ArrayBuffer): T | null {
    if (typeof data === 'string') {
        try {
            return JSON.parse(data) as T;
        } catch { return null; }
    } else if (Array.isArray(data)) {
        // Handle array-wrapped binary from JSON relay
        return decodePacket(new Uint8Array(data).buffer);
    } else {
        const buffer = data instanceof ArrayBuffer ? data : (data as Uint8Array).buffer;
        const view = new DataView(buffer, (data as any).byteOffset || 0, (data as any).byteLength || buffer.byteLength);
        const type = view.getUint8(0);

        // JSON Wrapper Verification (Type: 0)
        if (type === 0x00) {
            const receivedCRC = view.getUint32(1, false);
            const offset = ((data as any).byteOffset || 0) + 5;
            const length = ((data as any).byteLength || buffer.byteLength) - 5;
            const payload = new Uint8Array(buffer, offset, length);
            if (calculateCRC32(payload) !== receivedCRC) {
                console.warn('[MP] CRC-32 mismatch! Dropping corrupted packet.');
                return null;
            }
            try {
                return JSON.parse(TEXT_DECODER.decode(payload)) as T;
            } catch { return null; }
        }

        if (type === 0x01) { // Client -> Host: Move
            return {
                type: 'move',
                ts: view.getUint32(1),
                payload: {
                    pos: [view.getFloat32(5), view.getFloat32(9), view.getFloat32(13)],
                    rot: [view.getInt8(17) * Math.PI / 127, view.getInt8(18) * Math.PI / 127],
                    health: view.getUint8(19)
                }
            } as any;
        }

        if (type === 0x02) { // Host -> Client: PlayerMove
            const nid = view.getUint16(5);
            return {
                type: 'player_move',
                ts: view.getUint32(1),
                payload: {
                    nid,
                    pos: [view.getFloat32(7), view.getFloat32(11), view.getFloat32(15)],
                    rot: [view.getInt8(19) * Math.PI / 127, view.getInt8(20) * Math.PI / 127],
                    health: view.getUint8(21),
                    latency: view.getUint8(22)
                }
            } as any;
        }
        return null;
    }
}

export function encodePacket(packet: ClientPacket | ServerPacket): string | ArrayBuffer {
    if (packet.type === 'move') {
        const { pos, rot, health } = packet.payload;
        return encodeMoveBinary(pos, rot || [0, 0], health || 20);
    }
    if (packet.type === 'player_move' && packet.payload.nid !== undefined) {
        const { nid, pos, rot, health, latency } = packet.payload;
        return encodePlayerMoveBinary(nid, pos, rot || [0, 0], health || 20, latency);
    }

    // Wrapped JSON
    const json = JSON.stringify(packet);
    const jsonBytes = TEXT_ENCODER.encode(json);
    const crc = calculateCRC32(jsonBytes);

    const buffer = new ArrayBuffer(5 + jsonBytes.length);
    const view = new DataView(buffer);
    view.setUint8(0, 0x00); // Type: Wrapped JSON
    view.setUint32(1, crc, false); // Big endian CRC
    new Uint8Array(buffer, 5).set(jsonBytes);

    return buffer;
}

// ─── Constants ───────────────────────────────────────────

