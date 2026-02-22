import React, { useState, useEffect } from 'react';
import useGameStore from '../store/gameStore';

const TabList: React.FC = () => {
    const [visible, setVisible] = useState(false);
    const connectedPlayers = useGameStore(s => s.connectedPlayers);
    const playerName = useGameStore(s => s.playerName);
    const ping = useGameStore(s => s.ping);
    const isMultiplayer = useGameStore(s => s.isMultiplayer);
    const isLocked = useGameStore(s => s.isLocked);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                setVisible(true);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                setVisible(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    if (!isMultiplayer || !visible || !isLocked) return null;

    const players = [
        { id: 'local', name: playerName, ping: ping, isHost: !Object.keys(connectedPlayers).length },
        ...Object.entries(connectedPlayers).map(([id, p]) => ({
            id,
            name: p.name,
            ping: p.latency || 0,
            isHost: id === 'host'
        }))
    ];

    const getPingColor = (p: number) => {
        if (p < 50) return '#00aa00';
        if (p < 150) return '#aaaa00';
        return '#aa0000';
    };

    return (
        <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            maxWidth: '90vw',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: '20px',
            borderRadius: '4px',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            color: 'white',
            fontFamily: '"Minecraft", "Courier New", monospace',
            zIndex: 1000,
            pointerEvents: 'none'
        }}>
            <div style={{
                textAlign: 'center',
                fontSize: '20px',
                marginBottom: '15px',
                textShadow: '2px 2px #000',
                borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                paddingBottom: '10px'
            }}>
                PLAYER LIST ({players.length})
            </div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '10px'
            }}>
                {players.map((p) => (
                    <div key={p.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '8px 12px',
                        borderRadius: '2px'
                    }}>
                        <span style={{
                            fontSize: '16px',
                            textShadow: '1px 1px #000',
                            color: p.isHost ? '#ffff55' : 'white'
                        }}>
                            {p.isHost ? '§6[H] ' : ''}{p.name}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', color: getPingColor(p.ping), textShadow: '1px 1px #000' }}>
                                {p.ping}ms
                            </span>
                            {/* Simple ping bars */}
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1px', height: '10px' }}>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} style={{
                                        width: '2px',
                                        height: `${i * 2}px`,
                                        backgroundColor: p.ping < (250 - i * 40) ? getPingColor(p.ping) : '#333'
                                    }} />
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TabList;
