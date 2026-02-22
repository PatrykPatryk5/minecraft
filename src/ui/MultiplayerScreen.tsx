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
    const [isPublic, setIsPublic] = useState(true);
    const [password, setPassword] = useState('');
    const [lobbies, setLobbies] = useState<any[]>([]);

    const fetchLobbies = async () => {
        try {
            const res = await fetch('/api/multiplayer/lobbies');
            const data = await res.json();
            setLobbies(data);
        } catch (e) {
            console.warn('[MP] Could not fetch lobbies');
        }
    };

    React.useEffect(() => {
        if (screen === 'multiplayer') {
            fetchLobbies();
            const timer = setInterval(fetchLobbies, 10000);
            return () => clearInterval(timer);
        }
    }, [screen]);

    if (screen !== 'multiplayer') return null;

    const handleHost = async () => {
        if (!playerName.trim()) return;
        setConnecting(true);
        setStatus(`Uruchamianie serwera ${isPublic ? 'WAN (Publiczny)' : 'LAN (Prywatny)'}...`);

        try {
            const conn = getConnection();
            const id = await conn.hostGame(playerName, isPublic, password);
            setStatus('Serwer uruchomiony!');
            setHostedId(id);
        } catch (e: any) {
            setStatus('Błąd serwera: ' + e.message);
        }
        setConnecting(false);
    };

    const handleJoin = async (id?: string, hasPass?: boolean) => {
        const targetId = id || hostIdInput;
        if (!playerName.trim() || !targetId.trim()) return;

        let joinPass = '';
        if (hasPass) {
            joinPass = prompt('Ten serwer jest zabezpieczony hasłem. Wpisz hasło:') || '';
            if (!joinPass) return;
        }

        setConnecting(true);
        setStatus('Łączenie z graczem...');

        try {
            const conn = getConnection();
            await conn.joinGame(targetId, playerName, joinPass);
            setStatus('Połączono!');
            useGameStore.getState().resetWorld();
            setScreen('playing');
        } catch (e: any) {
            console.error(e);
            setStatus('Nie udało się połączyć. Zły kod, hasło lub offline.');
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
                <div className="screen-title">🌐 Tryb Multiplayer</div>

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
                            <label>Dostępne Serwery Publiczne</label>
                            <div style={{
                                background: 'rgba(0,0,0,0.5)',
                                borderRadius: 8,
                                padding: 8,
                                maxHeight: '150px',
                                overflowY: 'auto',
                                marginBottom: 10
                            }}>
                                {lobbies.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: 10, color: '#888' }}>
                                        Brak aktywnych serwerów...
                                    </div>
                                ) : (
                                    lobbies.map((lobby) => (
                                        <div
                                            key={lobby.id}
                                            onClick={() => handleJoin(lobby.id, lobby.hasPassword)}
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                padding: '8px 12px',
                                                background: 'rgba(255,255,255,0.05)',
                                                marginBottom: 4,
                                                borderRadius: 4,
                                                cursor: 'pointer',
                                                border: '1px solid transparent',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#55ff55'}
                                            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                                        >
                                            <span style={{ color: '#fff' }}>
                                                {lobby.isPermanent ? '⚡ [DEDYK] ' : ''}
                                                {lobby.hasPassword ? '🔒 ' : '🏠 '}
                                                {lobby.name} (v{lobby.version || '?'})
                                            </span>
                                            {window.location.protocol === 'https:' && lobby.id && lobby.id.startsWith('ws://') && (
                                                <span style={{ color: '#ff5555', fontSize: '10px', marginLeft: '10px', animation: 'blink 1s infinite' }}>
                                                    ⚠️ NIEBEZPIECZNE (WS)
                                                </span>
                                            )}
                                            <span style={{ color: '#aaa' }}>👤 {lobby.players} graczy</span>
                                        </div>
                                    ))
                                )}
                            </div>
                            <button className="mc-btn" onClick={() => fetchLobbies()} style={{ fontSize: '0.8em', marginBottom: 10 }}>
                                🔄 Odśwież listę
                            </button>
                        </div>

                        <div className="form-group">
                            <label>DOŁĄCZ RĘCZNIE (KOD)</label>
                            <input
                                className="mc-input"
                                value={hostIdInput}
                                onChange={(e) => setHostIdInput(e.target.value)}
                                placeholder="Wpisz kod hosta (np. muzo-xzy)"
                            />
                            <button className="mc-btn primary" onClick={() => handleJoin()} disabled={connecting} style={{ marginTop: 8 }}>
                                {connecting ? '⏳ Łączenie...' : '🚀 Dołącz do znajomego'}
                            </button>
                        </div>

                        <div style={{ textAlign: 'center', margin: '20px 0', color: '#ccc' }}>--- ALBO ---</div>

                        <div className="form-group">
                            <label>STWÓRZ WŁASNĄ GRĘ</label>

                            <div className="toggle-group" style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                                <button
                                    className={`mc-btn ${isPublic ? 'primary' : ''}`}
                                    style={{ flex: 1, padding: '5px' }}
                                    onClick={() => setIsPublic(true)}
                                >
                                    🌎 WAN (Public)
                                </button>
                                <button
                                    className={`mc-btn ${!isPublic ? 'primary' : ''}`}
                                    style={{ flex: 1, padding: '5px' }}
                                    onClick={() => setIsPublic(false)}
                                >
                                    🏠 LAN (Private)
                                </button>
                            </div>

                            {isPublic && (
                                <div style={{ marginBottom: 10 }}>
                                    <label style={{ fontSize: '0.8em', color: '#aaa' }}>Opcjonalne hasło (zabezpiecz serwer):</label>
                                    <input
                                        className="mc-input"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Brak hasła"
                                        style={{ height: '30px', fontSize: '0.9em' }}
                                    />
                                </div>
                            )}

                            <button className="mc-btn" onClick={handleHost} disabled={connecting} style={{ width: '100%' }}>
                                {connecting ? '⏳ Uruchamianie...' : '🏠 Zostań Hostem'}
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
                    <strong>Standardowy Multiplayer:</strong> Gra działa bezpośrednio (P2P). Jeśli jesteście w różnych sieciach, połączenie przejdzie przez serwer pośredniczący (STUN/TURN).
                </div>
            </div>
        </div>
    );
};

export default MultiplayerScreen;
