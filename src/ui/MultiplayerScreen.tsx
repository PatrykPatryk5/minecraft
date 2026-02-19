import React, { useState } from 'react';
import useGameStore from '../store/gameStore';
import { getConnection } from '../multiplayer/ConnectionManager';

const MultiplayerScreen: React.FC = () => {
    const screen = useGameStore((s) => s.screen);
    const setScreen = useGameStore((s) => s.setScreen);
    const playerName = useGameStore((s) => s.playerName);
    const setPlayerName = useGameStore((s) => s.setPlayerName);

    const [hostIdInput, setHostIdInput] = useState('');
    const [status, setStatus] = useState<string>('');
    const [connecting, setConnecting] = useState(false);
    const [hostedId, setHostedId] = useState<string>('');

    if (screen !== 'multiplayer') return null;

    const handleHost = async () => {
        if (!playerName.trim()) return;
        setConnecting(true);
        setStatus('Uruchamianie serwera LAN...');

        try {
            const conn = getConnection();
            const id = await conn.hostGame(playerName);
            setStatus('Serwer uruchomiony!');
            setHostedId(id);
            // Optionally auto-join the game as Host immediately:
            // useGameStore.getState().resetWorld();
            // setScreen('playing');
        } catch (e: any) {
            setStatus('Błąd serwera LAN: ' + e.message);
        }
        setConnecting(false);
    };

    const handleJoin = async () => {
        if (!playerName.trim() || !hostIdInput.trim()) return;
        setConnecting(true);
        setStatus('Łączenie z graczem...');

        try {
            const conn = getConnection();
            await conn.joinGame(hostIdInput, playerName);
            setStatus('Połączono!');
            useGameStore.getState().resetWorld();
            setScreen('playing');
        } catch (e: any) {
            setStatus('Nie udało się połączyć. Zły kod?');
        }
        setConnecting(false);
    };

    const handlePlayAsHost = () => {
        useGameStore.getState().resetWorld();
        setScreen('playing');
    };

    return (
        <div className="main-menu">
            <div className="menu-bg" />
            <div className="menu-content" style={{ width: '400px' }}>
                <div className="screen-title">🌐 LAN (Bez Serwera)</div>

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

                {!hostedId ? (
                    <>
                        <div className="form-group" style={{ marginTop: '20px' }}>
                            <label>DOŁĄCZ DO GRY</label>
                            <input
                                className="mc-input"
                                value={hostIdInput}
                                onChange={(e) => setHostIdInput(e.target.value)}
                                placeholder="Wpisz kod hosta (np. muzo-xzy)"
                            />
                            <button className="mc-btn primary" onClick={handleJoin} disabled={connecting} style={{ marginTop: 8 }}>
                                {connecting ? '⏳ Łączenie...' : '🚀 Dołącz do znajomego'}
                            </button>
                        </div>

                        <div style={{ textAlign: 'center', margin: '20px 0', color: '#ccc' }}>--- ALBO ---</div>

                        <div className="form-group">
                            <label>STWÓRZ WŁASNĄ GRĘ</label>
                            <button className="mc-btn" onClick={handleHost} disabled={connecting} style={{ width: '100%' }}>
                                {connecting ? '⏳ Uruchamianie...' : '🏠 Zostań Hostem (LAN)'}
                            </button>
                        </div>
                    </>
                ) : (
                    <div style={{ background: 'rgba(0,0,0,0.5)', padding: 16, borderRadius: 8, marginTop: 20 }}>
                        <h3 style={{ margin: '0 0 10px 0', color: '#55ff55' }}>Serwer Działa!</h3>
                        <p style={{ margin: '0 0 5px 0' }}>Podaj ten kod znajomym, aby mogli dołączyć:</p>
                        <h2 style={{ background: '#000', padding: 10, userSelect: 'all', cursor: 'pointer', textAlign: 'center' }}>
                            {hostedId}
                        </h2>
                        <button className="mc-btn primary" onClick={handlePlayAsHost} style={{ marginTop: 15, width: '100%' }}>
                            ▶ Rozpocznij Grę
                        </button>
                    </div>
                )}

                {status && (
                    <div style={{ color: status.includes('Błąd') || status.includes('Nie udało') ? '#ff6666' : '#66ff66', textAlign: 'center', marginTop: '15px' }}>
                        {status}
                    </div>
                )}

                <div className="menu-buttons" style={{ marginTop: 24 }}>
                    <button className="mc-btn" onClick={() => setScreen('mainMenu')}>← Wstecz</button>
                </div>

                <div style={{ marginTop: 24, padding: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 4, fontSize: '0.8em', color: '#aaa' }}>
                    <strong>Serwer LAN (WebRTC):</strong> Gra działa bezpośrednio między graczami bez zewnętrznego serwera!
                </div>
            </div>
        </div>
    );
};

export default MultiplayerScreen;
