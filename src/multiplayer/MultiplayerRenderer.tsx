import React from 'react';
import useGameStore from '../store/gameStore';
import { PlayerModel } from '../player/PlayerModel';

export const MultiplayerRenderer: React.FC = () => {
    const connectedPlayers = useGameStore(s => s.connectedPlayers);
    const isMultiplayer = useGameStore(s => s.isMultiplayer);

    if (!isMultiplayer) return null;

    return (
        <group>
            {Object.keys(connectedPlayers).map(id => (
                <PlayerModel key={id} id={id} />
            ))}
        </group>
    );
};
