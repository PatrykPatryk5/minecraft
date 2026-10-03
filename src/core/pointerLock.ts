/**
 * Safe Pointer Lock Utility
 *
 * Browsers throw a SecurityError when requestPointerLock() is called
 * immediately after the user (or code) has exited the lock.  This helper
 * wraps the call with a small delay and a catch so the error never
 * surfaces as an uncaught promise rejection.
 */

const POINTER_LOCK_DELAY_MS = 120;

/**
 * Request pointer lock on the first `<canvas>` element.
 * Silently catches the SecurityError that occurs when the browser hasn't
 * finished processing a previous exitPointerLock().
 */
export function safeRequestPointerLock(delayMs = POINTER_LOCK_DELAY_MS): void {
    setTimeout(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        try {
            const result = canvas.requestPointerLock();
            // requestPointerLock may return a promise in modern browsers
            if (result && typeof (result as any).catch === 'function') {
                (result as any).catch(() => {
                    // SecurityError — lock exit cooldown not yet elapsed; ignore.
                });
            }
        } catch {
            // Synchronous SecurityError in older browsers; ignore.
        }
    }, delayMs);
}
