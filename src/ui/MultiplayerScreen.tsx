/**
 * Multiplayer Screen — Connect to servers, enter player name
 */

import React, { useState } from 'react';
import useGameStore from '../store/gameStore';
import { connectToServer } from '../multiplayer/ConnectionManager';

const MultiplayerScreen: React.FC = () => {
    const screen = useGameStore((s) => s.screen);
    const setScreen = useGameStore((s) => s.setScreen);
    const playerName = useGameStore((s) => s.playerName);
    const setPlayerName = useGameStore((s) => s.setPlayerName);

    const [serverUrl, setServerUrl] = useState('ws://localhost:3001');
    const [status, setStatus] = useState<string>('');
    const [connecting, setConnecting] = useState(false);

    if (screen !== 'multiplayer') return null;

    const handleConnect = async () => {
        if (!playerName.trim() || !serverUrl.trim()) return;
        setConnecting(true);
        setStatus('Łączenie...');

        try {
            const conn = connectToServer(serverUrl, playerName);
            // Wait a bit for connection
            await new Promise((r) => setTimeout(r, 2000));
            const st = conn.getStatus();
            if (st === 'connected') {
                setStatus('Połączono!');
                useGameStore.getState().resetWorld();
                setScreen('playing');
            } else {
                setStatus(`Błąd: ${st}`);
            }
        } catch {
            setStatus('Nie udało się połączyć');
        }
        setConnecting(false);
    };

    return (
        <div className="main-menu">
            <div className="menu-bg" />
            <div className="menu-content">
                <div className="screen-title">🌐 Multiplayer</div>

                <div className="form-group">
                    <label>Nazwa gracza</label>
                    <input
                        className="mc-input"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        maxLength={16}
                        placeholder="Steve"
                    />
                </div>

                <div className="form-group">
                    <label>Adres serwera</label>
                    <input
                        className="mc-input"
                        value={serverUrl}
                        onChange={(e) => setServerUrl(e.target.value)}
                        placeholder="ws://localhost:3001"
                    />
                </div>

                {status && (
                    <div style={{ color: status.includes('Błąd') ? '#ff6666' : '#66ff66', textAlign: 'center', margin: '10px 0' }}>
                        {status}
                    </div>
                )}

                <div className="menu-buttons" style={{ marginTop: 16 }}>
                    <button className="mc-btn primary" onClick={handleConnect} disabled={connecting}>
                        {connecting ? '⏳ Łączenie...' : '🚀 Dołącz do serwera'}
                    </button>
                    <button className="mc-btn" onClick={() => setScreen('mainMenu')}>← Wstecz</button>
                </div>

                <div style={{ marginTop: 24, padding: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 4, fontSize: '0.8em', color: '#aaa' }}>
                    <strong>Jak uruchomić serwer:</strong><br />
                    <code>cd server && npx ts-node server.ts</code><br />
                    Domyślny port: 3001
                </div>
            </div>
        </div>
    );
};

export default MultiplayerScreen;
