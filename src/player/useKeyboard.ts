/**
 * Keyboard Input Hook
 * Tracks pressed keys via a ref (no re-renders).
 * Ignores keys when chat is open to prevent movement while typing.
 */

import { useEffect, useRef } from 'react';
import useGameStore from '../store/gameStore';

export type KeyMap = Record<string, boolean>;

export default function useKeyboard(): React.RefObject<KeyMap> {
    const keys = useRef<KeyMap>({});

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            // Don't track movement keys if chat is open
            if (useGameStore.getState().isChatOpen) return;
            keys.current[e.code] = true;
        };
        const up = (e: KeyboardEvent) => {
            keys.current[e.code] = false;
        };
        const blur = () => {
            // Reset all keys when window loses focus (prevents stuck keys)
            keys.current = {};
        };
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        window.addEventListener('blur', blur);
        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
            window.removeEventListener('blur', blur);
        };
    }, []);

    return keys;
}
