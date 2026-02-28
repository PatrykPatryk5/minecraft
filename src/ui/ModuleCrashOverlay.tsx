import React from 'react';
import useGameStore from '../store/gameStore';

const ModuleCrashOverlay: React.FC = () => {
    const activeOverlay = useGameStore(s => s.activeOverlay);
    const setOverlay = useGameStore(s => s.setOverlay);
    const crashedModules = useGameStore(s => s.crashedModules);
    const setModuleState = useGameStore(s => s.setModuleState);

    if (activeOverlay !== 'moduleCrash') return null;

    const activeCrashes = Object.entries(crashedModules).filter(([name, data]) => !data.disabled && data.timestamp > 0);

    // If no active crashes exist, auto-close the overlay (this shouldn't normally happen as gameStore handles it)
    if (activeCrashes.length === 0) {
        setTimeout(() => setOverlay('none'), 0);
        return null;
    }

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(26, 10, 10, 0.85)',
            color: '#ff5555',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '10px',
            padding: 40,
            zIndex: 10000,
        }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>⚠️</div>
            <h1 style={{ marginBottom: 10, color: '#ffaa00' }}>Częściowa awaria gry!</h1>
            <p style={{ color: '#ffcc55', marginBottom: 20, textAlign: 'center', lineHeight: 1.5 }}>
                Niektóre elementy świata uległy awarii.<br />
                Możesz spróbować je uruchomić ponownie lub zignorować (wyłączyć).<br />
                Główna gra nadal działa w tle!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', maxWidth: '600px' }}>
                {activeCrashes.map(([name, data]) => (
                    <div key={name} style={{
                        background: 'rgba(0,0,0,0.5)', border: '2px solid #ff5555', padding: '15px',
                        display: 'flex', flexDirection: 'column', gap: '10px'
                    }}>
                        <div style={{ color: '#fff', fontSize: '12px' }}>Moduł: <span style={{ color: '#ff5555' }}>{name}</span></div>
                        <div style={{
                            background: 'rgba(255,0,0,0.1)', padding: '5px', borderRadius: '2px',
                            maxHeight: '60px', overflow: 'hidden', textOverflow: 'ellipsis', color: '#ff8888',
                            fontSize: '8px'
                        }}>
                            {data.error?.message}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                            <button
                                onClick={() => setModuleState(name, false, true)} // resetCrash = true
                                style={{
                                    background: '#4a2', color: '#fff', border: '2px solid #281',
                                    padding: '8px 16px', fontFamily: 'inherit', fontSize: '10px', cursor: 'pointer', flex: 1
                                }}>
                                🔄 Uruchom ponownie
                            </button>
                            <button
                                onClick={() => setModuleState(name, true)} // disable
                                style={{
                                    background: '#a42', color: '#fff', border: '2px solid #821',
                                    padding: '8px 16px', fontFamily: 'inherit', fontSize: '10px', cursor: 'pointer', flex: 1
                                }}>
                                ❌ Wyłącz moduł
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <button
                onClick={() => setOverlay('pause')}
                style={{
                    marginTop: '30px', background: '#555', color: '#fff', border: '2px solid #333',
                    padding: '10px 24px', fontFamily: 'inherit', fontSize: '10px', cursor: 'pointer',
                }}>
                Wróć do pauzy
            </button>
        </div>
    );
};

export default ModuleCrashOverlay;
