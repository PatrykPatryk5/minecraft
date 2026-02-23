/**
 * Mobile Controls Overlay
 * 
 * Provides on-screen joystick and buttons for touch devices.
 * Uses setVirtualKey in gameStore to simulate keyboard input.
 */

import React, { useCallback, useRef } from 'react';
import useGameStore from '../store/gameStore';

const MobileControls: React.FC = () => {
    const isMobile = useGameStore((s) => s.isMobile);
    const setVirtualKey = useGameStore((s) => s.setVirtualKey);
    const setHotbarSlot = useGameStore((s) => s.setHotbarSlot);
    const hotbarSlot = useGameStore((s) => s.hotbarSlot);

    // Joystick state
    const joystickRef = useRef<HTMLDivElement>(null);
    const [activeMove, setActiveMove] = React.useState<{ x: number, y: number } | null>(null);

    const handleJoystick = useCallback((e: React.TouchEvent) => {
        if (!joystickRef.current) return;
        const rect = joystickRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const touch = e.touches[0];

        const dx = touch.clientX - centerX;
        const dy = touch.clientY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = rect.width / 2;

        // Normalize
        const nx = dx / maxDist;
        const ny = dy / maxDist;

        // Apply virtual keys
        setVirtualKey('KeyW', ny < -0.3);
        setVirtualKey('KeyS', ny > 0.3);
        setVirtualKey('KeyA', nx < -0.3);
        setVirtualKey('KeyD', nx > 0.3);

        setActiveMove({
            x: Math.max(-1, Math.min(1, nx)) * (maxDist * 0.6),
            y: Math.max(-1, Math.min(1, ny)) * (maxDist * 0.6)
        });
    }, [setVirtualKey]);

    const stopJoystick = useCallback(() => {
        setVirtualKey('KeyW', false);
        setVirtualKey('KeyS', false);
        setVirtualKey('KeyA', false);
        setVirtualKey('KeyD', false);
        setActiveMove(null);
    }, [setVirtualKey]);

    if (!isMobile) return null;

    return (
        <div className="mobile-controls-overlay">
            {/* Joystick Area */}
            <div
                ref={joystickRef}
                className="mobile-joystick-base"
                onTouchMove={handleJoystick}
                onTouchEnd={stopJoystick}
            >
                <div
                    className="mobile-joystick-knob"
                    style={{
                        transform: activeMove
                            ? `translate(${activeMove.x}px, ${activeMove.y}px)`
                            : 'translate(0, 0)'
                    }}
                />
            </div>

            {/* Action Buttons (Right Side) */}
            <div className="mobile-actions-right">
                <div
                    className="mobile-btn jump-btn"
                    onTouchStart={() => setVirtualKey('Space', true)}
                    onTouchEnd={() => setVirtualKey('Space', false)}
                >
                    <span>Jump</span>
                </div>

                <div className="mobile-actions-secondary">
                    <div
                        className="mobile-btn crouch-btn"
                        onTouchStart={() => setVirtualKey('ShiftLeft', true)}
                        onTouchEnd={() => setVirtualKey('ShiftLeft', false)}
                    >
                        <span>Crouch</span>
                    </div>
                    <div
                        className="mobile-btn sprint-btn"
                        onTouchStart={() => setVirtualKey('ControlLeft', true)}
                        onTouchEnd={() => setVirtualKey('ControlLeft', false)}
                    >
                        <span>Sprint</span>
                    </div>
                </div>
            </div>

            {/* Interaction Buttons (Middle/Bottom) */}
            <div className="mobile-interaction-btns">
                <div
                    className="mobile-btn break-btn"
                    onTouchStart={() => setVirtualKey('MouseButton0', true)} // We'll need to handle mouse buttons as virtual keys too
                    onTouchEnd={() => setVirtualKey('MouseButton0', false)}
                >
                    <span>Break</span>
                </div>
                <div
                    className="mobile-btn place-btn"
                    onTouchStart={() => setVirtualKey('MouseButton2', true)}
                    onTouchEnd={() => setVirtualKey('MouseButton2', false)}
                >
                    <span>Place</span>
                </div>
            </div>

            {/* Hotbar Quick Switch (optional enhancement) */}
            <div className="mobile-hotbar-nav">
                <button onClick={() => setHotbarSlot((hotbarSlot + 8) % 9)}>&lt;</button>
                <button onClick={() => setHotbarSlot((hotbarSlot + 1) % 9)}>&gt;</button>
            </div>
        </div>
    );
};

export default MobileControls;
