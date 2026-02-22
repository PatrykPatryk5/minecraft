import React from 'react';
import useGameStore from '../store/gameStore';

const PreJoinShield: React.FC = () => {
    const serverWarning = useGameStore(s => s.serverWarning);
    const setServerWarning = useGameStore(s => s.setServerWarning);

    if (!serverWarning) return null;

    const getSeverityColor = () => {
        switch (serverWarning.severity) {
            case 'critical': return '#ff0000';
            case 'high': return '#ff5555';
            case 'medium': return '#ffff55';
            default: return '#55ff55';
        }
    };

    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            color: 'white',
            textAlign: 'center',
            padding: '20px',
            fontFamily: 'sans-serif'
        }}>
            <div style={{
                maxWidth: '500px',
                background: '#222',
                border: `2px solid ${getSeverityColor()}`,
                padding: '30px',
                borderRadius: '8px',
                boxShadow: `0 0 20px ${getSeverityColor()}33`
            }}>
                <h1 style={{ color: getSeverityColor(), marginBottom: '10px' }}>
                    OSTRZEŻENIE SERWERA
                </h1>
                <p style={{ fontSize: '18px', lineHeight: '1.5', marginBottom: '25px' }}>
                    {serverWarning.message}
                </p>
                <button
                    onClick={() => setServerWarning(null)}
                    style={{
                        padding: '12px 24px',
                        fontSize: '16px',
                        background: getSeverityColor(),
                        color: 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    ROZUMIEM I KONTYNUUJĘ
                </button>
            </div>
        </div>
    );
};

export default PreJoinShield;
