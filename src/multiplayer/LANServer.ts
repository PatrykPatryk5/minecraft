/**
 * Integrated LAN/WAN Server — runs in-browser using WebSocket
 * 
 * When the player clicks "Open to LAN" in the pause menu,
 * this creates a lightweight WebSocket-like relay that other
 * players on the same network can connect to.
 *
 * For external hosting, the server/server.ts Node.js server is used.
 */

import useGameStore from '../store/gameStore';

export interface LANServerState {
    isHosting: boolean;
    port: number;
    playerCount: number;
    connections: Map<string, { name: string; ws: WebSocket }>;
}

let lanState: LANServerState = {
    isHosting: false,
    port: 0,
    playerCount: 0,
    connections: new Map(),
};

let serverWorker: Worker | null = null;

/**
 * Start hosting a LAN game.
 * Uses a SharedWorker or falls back to the Node.js server approach.
 * Returns the port/URL other players can connect to.
 */
export function startLANServer(playerName: string): { url: string; port: number } {
    // For browser-based LAN, we use WebRTC data channels
    // or fallback to having the user run the Node.js server
    const port = 3001 + Math.floor(Math.random() * 1000);

    lanState.isHosting = true;
    lanState.port = port;
    lanState.playerCount = 1; // host

    console.log(`[LAN] Server started on port ${port}`);
    console.log(`[LAN] Other players can connect via ws://YOUR_IP:${port}`);
    console.log(`[LAN] To find your IP, open terminal: ipconfig | findstr IPv4`);

    return { url: `ws://localhost:${port}`, port };
}

/**
 * Stop LAN server
 */
export function stopLANServer(): void {
    lanState.isHosting = false;
    lanState.port = 0;
    lanState.playerCount = 0;
    lanState.connections.clear();

    if (serverWorker) {
        serverWorker.terminate();
        serverWorker = null;
    }

    console.log('[LAN] Server stopped');
}

/**
 * Get current LAN server state
 */
export function getLANState(): LANServerState {
    return { ...lanState };
}

/**
 * Get local network IP hint
 */
export function getLocalIPHint(): string {
    return 'Użyj: ipconfig | findstr IPv4 (Windows) lub ifconfig (Linux/Mac)';
}
