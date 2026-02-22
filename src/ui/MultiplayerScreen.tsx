import React, { useState, useEffect } from 'react';
import useGameStore from '../store/gameStore';
import { getConnection } from '../multiplayer/ConnectionManager';
import { PROTOCOL_VERSION } from '../multiplayer/protocol';

interface RecentServer {
    id: string;
    name: string;
    lastJoined: number;
}

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
    const [recentServers, setRecentServers] = useState<RecentServer[]>([]);

    const fetchLobbies = async () => {
        try {
            const res = await fetch('/api/multiplayer/lobbies');
            const data = await res.json();
            setLobbies(data);
        } catch (e) {
            console.warn('[MP] Could not fetch lobbies');
        }
    };

    const loadRecentServers = () => {
        const stored = localStorage.getItem('mc_recent_servers');
        if (stored) {
            try {
                setRecentServers(JSON.parse(stored));
            } catch (e) {
                setRecentServers([]);
            }
        }
    };

    const saveRecentServer = (id: string, name: string) => {
        const existing = [...recentServers];
        const index = existing.findIndex(s => s.id === id);
        if (index !== -1) {
            existing[index].lastJoined = Date.now();
        } else {
            existing.unshift({ id, name, lastJoined: Date.now() });
        }
        const updated = existing.sort((a, b) => b.lastJoined - a.lastJoined).slice(0, 5);
        setRecentServers(updated);
        localStorage.setItem('mc_recent_servers', JSON.stringify(updated));
    };

    useEffect(() => {
        if (screen === 'multiplayer') {
            fetchLobbies();
            loadRecentServers();
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

    const handleJoin = async (id?: string, name?: string, hasPass?: boolean) => {
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
            saveRecentServer(targetId, name || 'Nieznany Serwer');
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
            <div className="menu-content" style={{ width: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="screen-title" style={{ fontSize: '32px', marginBottom: '20px' }}>Multiplayer</div>

                <div className="form-group" style={{ marginBottom: '25px' }}>
                    <label style={{ color: '#ccc', textShadow: '1px 1px #000' }}>Nazwa gracza</label>
                    <input
                        className="mc-input"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        maxLength={16}
                        placeholder="Steve"
                        style={{ height: '40px', fontSize: '18px' }}
                    />
                </div>

                {!hostedId ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Public Lobbies */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label style={{ color: '#aaa', fontSize: '14px' }}>Dostępne Serwery</label>
                                <button className="mc-btn" onClick={() => fetchLobbies()} style={{ padding: '4px 8px', fontSize: '12px', minWidth: 'auto' }}>
                                    Odśwież
                                </button>
                            </div>
                            <div className="mc-container" style={{ maxHeight: '180px', overflowY: 'auto', background: 'rgba(0,0,0,0.4)', padding: '5px' }}>
                                {lobbies.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '20px', color: '#666', fontSize: '14px' }}>
                                        Brak aktywnych serwerów publicznych...
                                    </div>
                                ) : (
                                    lobbies.map((lobby) => (
                                        <div
                                            key={lobby.id}
                                            className="server-entry"
                                            onClick={() => handleJoin(lobby.id, lobby.name, lobby.hasPassword)}
                                            style={{
                                                padding: '10px',
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                marginBottom: '5px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'space-between'
                                            }}
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ color: '#fff', fontSize: '16px' }}>{lobby.hasPassword ? '🔒 ' : ''}{lobby.name}</span>
                                                <span style={{ color: '#888', fontSize: '12px' }}>v{lobby.version || '1.0'} • {lobby.isPermanent ? 'Dedykowany' : 'P2P'}</span>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ color: '#55ff55' }}>👤 {lobby.players}</div>
                                                {lobby.id.startsWith('ws://') && window.location.protocol === 'https:' && (
                                                    <div style={{ color: '#ff5555', fontSize: '9px' }}>INSECURE</div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Recent Servers */}
                        {recentServers.length > 0 && (
                            <div>
                                <label style={{ color: '#aaa', fontSize: '14px', marginBottom: '8px', display: 'block' }}>Ostatnio odwiedzane</label>
                                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '5px' }}>
                                    {recentServers.map(s => (
                                        <div
                                            key={s.id}
                                            onClick={() => handleJoin(s.id, s.name)}
                                            style={{
                                                padding: '8px 12px',
                                                background: 'rgba(85, 255, 85, 0.1)',
                                                border: '1px solid rgba(85, 255, 85, 0.2)',
                                                borderRadius: '2px',
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                                fontSize: '13px',
                                                color: '#fff'
                                            }}
                                        >
                                            {s.name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div>
                                    <label style={{ color: '#aaa', fontSize: '12px', marginBottom: '5px', display: 'block' }}>Ręczne Dołączenie (KOD)</label>
                                    <input
                                        className="mc-input"
                                        value={hostIdInput}
                                        onChange={(e) => setHostIdInput(e.target.value)}
                                        placeholder="KOD-123"
                                        style={{ height: '35px' }}
                                    />
                                    <button className="mc-btn primary" onClick={() => handleJoin()} disabled={connecting} style={{ marginTop: '10px', width: '100%' }}>
                                        {connecting ? 'Łączenie...' : 'Dołącz'}
                                    </button>
                                </div>
                                <div>
                                    <label style={{ color: '#aaa', fontSize: '12px', marginBottom: '5px', display: 'block' }}>Stwórz własny serwer</label>
                                    <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                                        <button className={`mc-btn ${isPublic ? 'active' : ''}`} onClick={() => setIsPublic(true)} style={{ flex: 1, padding: '4px', minWidth: 'auto', fontSize: '11px' }}>WAN</button>
                                        <button className={`mc-btn ${!isPublic ? 'active' : ''}`} onClick={() => setIsPublic(false)} style={{ flex: 1, padding: '4px', minWidth: 'auto', fontSize: '11px' }}>LAN</button>
                                    </div>
                                    <button className="mc-btn" onClick={handleHost} disabled={connecting} style={{ width: '100%' }}>
                                        Hostuj
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="mc-container" style={{ textAlign: 'center', padding: '30px' }}>
                        <h2 style={{ color: '#55ff55', marginTop: 0 }}>Serwer Gotowy!</h2>
                        <p style={{ color: '#ccc', marginBottom: '20px' }}>Udostępnij ten kod innym:</p>
                        <div style={{ background: '#000', padding: '15px', fontSize: '24px', letterSpacing: '4px', color: '#fff', border: '2px dashed #55ff55', marginBottom: '30px' }}>
                            {hostedId}
                        </div>
                        <button className="mc-btn primary" onClick={handlePlayAsHost} style={{ width: '100%', height: '50px', fontSize: '20px' }}>
                            Rozpocznij Grę
                        </button>
                    </div>
                )}

                {status && (
                    <div style={{
                        marginTop: '20px',
                        padding: '10px',
                        textAlign: 'center',
                        color: status.includes('Błąd') ? '#ff5555' : '#55ff55',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '4px',
                        fontSize: '14px'
                    }}>
                        {status}
                    </div>
                )}

                <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'center' }}>
                    <button className="mc-btn" onClick={() => setScreen('mainMenu')} style={{ width: '200px' }}>Wstecz</button>
                </div>
            </div>

            <style>{`
                .server-entry:hover {
                    background: rgba(255,255,255,0.1) !important;
                    border-color: #55ff55 !important;
                }
                .mc-btn.active {
                    background-color: #555555;
                    border-color: #ffffff;
                }
                .mc-container {
                    background: rgba(0,0,0,0.5);
                    border: 2px solid #555;
                    padding: 10px;
                }
            `}</style>
        </div>
    );
};

export default MultiplayerScreen;
