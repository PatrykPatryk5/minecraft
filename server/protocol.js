/**
 * Shared Multiplay Protocol Logic for Dedicated Server (Vanilla JS) - Protocol 1.0
 */

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

function calculateCRC32(data) {
    let crc = -1;
    for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xFF];
    }
    return (crc ^ -1) >>> 0;
}

export function encodeMoveBinary(pos, rot, health, dimension = 'overworld', isUnderwater = false) {
    const buffer = new ArrayBuffer(21);
    const view = new DataView(buffer);
    view.setUint8(0, 0x01); // Client -> Host: Move
    view.setUint32(1, Date.now() % 0xFFFFFFFF);
    view.setFloat32(5, pos[0]);
    view.setFloat32(9, pos[1]);
    view.setFloat32(13, pos[2]);
    view.setInt8(17, Math.round(rot[0] * 127 / Math.PI));
    view.setInt8(18, Math.round(rot[1] * 127 / Math.PI));
    view.setUint8(19, health || 20);

    let dimIdx = 0;
    if (dimension === 'nether') dimIdx = 1;
    if (dimension === 'end') dimIdx = 2;
    const flags = (isUnderwater ? 1 : 0) | (dimIdx << 1);
    view.setUint8(20, flags);
    return buffer;
}

export function encodePlayerMoveBinary(nid, pos, rot, health, latency, dimension = 'overworld', isUnderwater = false) {
    const buffer = new ArrayBuffer(24);
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

    let dimIdx = 0;
    if (dimension === 'nether') dimIdx = 1;
    if (dimension === 'end') dimIdx = 2;
    const flags = (isUnderwater ? 1 : 0) | (dimIdx << 1);
    view.setUint8(23, flags);
    return buffer;
}

export function decodePacket(data) {
    try {
        if (typeof data === 'string') {
            return JSON.parse(data);
        } else if (Array.isArray(data)) {
            return decodePacket(new Uint8Array(data).buffer);
        } else {
            const buffer = data instanceof ArrayBuffer ? data : (data.buffer || data);
            const byteOffset = data.byteOffset || 0;
            const byteLength = data.byteLength || buffer.byteLength;
            const view = new DataView(buffer, byteOffset, byteLength);
            const type = view.getUint8(0);

            // JSON Wrapper (Type: 0)
            if (type === 0x00) {
                const receivedCRC = view.getUint32(1, false);
                const offset = (byteOffset || 0) + 5;
                const length = (byteLength || buffer.byteLength) - 5;
                const payload = new Uint8Array(buffer, offset, length);
                if (calculateCRC32(payload) !== receivedCRC) {
                    console.warn('[MP] CRC-32 mismatch!');
                    return null;
                }
                return JSON.parse(TEXT_DECODER.decode(payload));
            }

            if (type === 0x01) { // Client -> Host: Move
                const flags = view.getUint8(20);
                const dimIdx = (flags >> 1) & 0x03;
                const dimension = dimIdx === 1 ? 'nether' : (dimIdx === 2 ? 'end' : 'overworld');
                return {
                    type: 'move',
                    ts: view.getUint32(1),
                    payload: {
                        pos: [view.getFloat32(5), view.getFloat32(9), view.getFloat32(13)],
                        rot: [view.getInt8(17) * Math.PI / 127, view.getInt8(18) * Math.PI / 127],
                        health: view.getUint8(19),
                        dimension,
                        isUnderwater: (flags & 1) === 1
                    }
                };
            }
            if (type === 0x02) { // Host -> Client: PlayerMove
                const nid = view.getUint16(5);
                const flags = view.getUint8(23);
                const dimIdx = (flags >> 1) & 0x03;
                const dimension = dimIdx === 1 ? 'nether' : (dimIdx === 2 ? 'end' : 'overworld');
                return {
                    type: 'player_move',
                    ts: view.getUint32(1),
                    payload: {
                        nid,
                        pos: [view.getFloat32(7), view.getFloat32(11), view.getFloat32(15)],
                        rot: [view.getInt8(19) * Math.PI / 127, view.getInt8(20) * Math.PI / 127],
                        health: view.getUint8(21),
                        latency: view.getUint8(22),
                        dimension,
                        isUnderwater: (flags & 1) === 1
                    }
                };
            }
        }
        return null;
    } catch (e) {
        return null;
    }
}

export function encodePacket(packet) {
    if (packet.type === 'move') {
        const { pos, rot, health, dimension, isUnderwater } = packet.payload;
        return encodeMoveBinary(pos, rot || [0, 0], health || 20, dimension, isUnderwater);
    }
    if (packet.type === 'player_move' && packet.payload.nid !== undefined) {
        const { nid, pos, rot, health, latency, dimension, isUnderwater } = packet.payload;
        return encodePlayerMoveBinary(nid, pos, rot || [0, 0], health || 20, latency, dimension, isUnderwater);
    }

    const json = JSON.stringify(packet);
    const jsonBytes = TEXT_ENCODER.encode(json);
    const crc = calculateCRC32(jsonBytes);

    const buffer = new ArrayBuffer(5 + jsonBytes.length);
    const view = new DataView(buffer);
    view.setUint8(0, 0x00); // Wrapped JSON
    view.setUint32(1, crc, false); // CRC-32
    new Uint8Array(buffer, 5).set(jsonBytes);

    return buffer;
}

export const PROTOCOL_VERSION = 11;
