/**
 * Safe Pointer Lock Utility
 *
 * Browsers throw a SecurityError when requestPointerLock() is called
 * immediately after the user (or code) has exited the lock.  This helper
 * wraps the call with a small delay and a catch so the error never
 * surfaces as an uncaught promise rejection.
 */

/**
 * Request pointer lock on the first `<canvas>` element.
 * Call synchronously from a user gesture so browsers preserve activation.
 */
export function safeRequestPointerLock(delayMs = 0): void {
    const request = () => {
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
            // Ignore lock requests rejected during browser focus transitions.
        }
    };

    if (delayMs > 0) setTimeout(request, delayMs);
    else request();
}
