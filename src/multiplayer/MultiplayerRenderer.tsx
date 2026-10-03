import React from 'react';
import useGameStore from '../store/gameStore';
import { PlayerModel } from '../player/PlayerModel';
import { useShallow } from 'zustand/react/shallow';

export const MultiplayerRenderer: React.FC = () => {
    const playerIds = useGameStore(useShallow(s => Object.keys(s.connectedPlayers)));
    const isMultiplayer = useGameStore(s => s.isMultiplayer);

    if (!isMultiplayer) return null;

    return (
        <group>
            {playerIds.map(id => (
                <PlayerModel key={id} id={id} />
            ))}
        </group>
    );
};
