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
            if (useGameStore.getState().isChatOpen) return;
            keys.current[e.code] = true;
        };
        const up = (e: KeyboardEvent) => {
            keys.current[e.code] = false;
        };
        const blur = () => {
            keys.current = {};
        };
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        window.addEventListener('blur', blur);

        // Sync virtual keys from store every frame (or subscribe)
        const unsub = useGameStore.subscribe((s) => {
            const vKeys = s.virtualKeys;
            for (const k in vKeys) {
                keys.current[k] = vKeys[k];
            }
        });

        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
            window.removeEventListener('blur', blur);
            unsub();
        };
    }, []);

    return keys;
}
