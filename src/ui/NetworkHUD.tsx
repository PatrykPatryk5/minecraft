import React from 'react';
import useGameStore from '../store/gameStore';

const NetworkHUD: React.FC = () => {
    const isMultiplayer = useGameStore(s => s.isMultiplayer);
    const ping = useGameStore(s => s.ping);
    const playersCount = Object.keys(useGameStore(s => s.connectedPlayers)).length + 1;

    if (!isMultiplayer) return null;

    const getPingColor = () => {
        if (ping < 30) return '#55ff55'; // Great
        if (ping < 80) return '#aaff55'; // Good
        if (ping < 150) return '#ffff55'; // Fair
        if (ping < 300) return '#ffaa55'; // Poor
        return '#ff5555'; // Critical
    };

    return (
        <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'rgba(0,0,0,0.5)',
            padding: '8px 12px',
            borderRadius: '4px',
            color: 'white',
            fontFamily: 'monospace',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 100,
            border: `1px solid ${getPingColor()}88`
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '4px' }}>
                <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: getPingColor(),
                    display: 'inline-block',
                    boxShadow: `0 0 6px ${getPingColor()}`
                }}></span>
                <span style={{ fontWeight: 'bold' }}>MP v1.0 [STABLE]</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                <span>PING:</span>
                <span style={{ color: getPingColor() }}>{ping}ms</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                <span>PLAYERS:</span>
                <span>{playersCount}</span>
            </div>
            <div style={{ fontSize: '9px', marginTop: '6px', opacity: 0.6, textAlign: 'right' }}>
                RC-10.0.0_NET_V1
            </div>
        </div>
    );
};

export default NetworkHUD;
