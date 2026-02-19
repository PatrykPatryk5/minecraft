import React, { useEffect, useState } from 'react';
import useGameStore from '../store/gameStore';

const CreditsScreen: React.FC = () => {
    const setScreen = useGameStore(s => s.setScreen);
    const [offset, setOffset] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setOffset(prev => prev + 1);
        }, 30);
        return () => clearInterval(interval);
    }, []);

    const handleExit = () => {
        setScreen('mainMenu');
        useGameStore.getState().setDragonDefeated(false); // Reset/Respawn? Or just keep defeated
    };

    return (
        <div className="credits-screen" onClick={handleExit} style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            background: 'black', color: '#55ffff', overflow: 'hidden',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            fontFamily: 'Minecraft, monospace', zIndex: 9999
        }}>
            <div style={{
                transform: `translateY(${1000 - offset}px)`,
                textAlign: 'center'
            }}>
                <h1 style={{ fontSize: '4rem', color: '#ff55ff', marginBottom: '2rem' }}>MINECRAFT CLONE</h1>
                <h2 style={{ fontSize: '2rem', marginBottom: '4rem' }}>A React Three Fiber Experience</h2>

                <p style={{ margin: '1rem' }}>Created by</p>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '3rem', color: 'white' }}>Patryk_Patryk_5</h3>

                <p style={{ margin: '1rem' }}>Original Game by</p>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '3rem', color: 'white' }}>Mojang Studios</h3>

                <p style={{ margin: '1rem' }}>Special Thanks</p>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '3rem', color: 'white' }}>Contributors</h3>

                <div style={{ marginTop: '200px', fontSize: '1.2rem', color: '#aaaaaa' }}>
                    Click anywhere to return to Main Menu
                </div>
            </div>
        </div>
    );
};

export default CreditsScreen;
