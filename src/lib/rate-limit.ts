/**
 * Simple in-memory sliding-window rate limiter.
 * Suitable for single-instance deployments (Cloud Run min-instances=1).
 */

interface Window {
    count: number;
    resetAt: number;
}

const store = new Map<string, Window>();

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
}

/**
 * @param key      Unique key per caller (e.g. IP + route)
 * @param limit    Max requests per window
 * @param windowMs Window duration in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    let window = store.get(key);

    if (!window || now >= window.resetAt) {
        window = { count: 0, resetAt: now + windowMs };
        store.set(key, window);
    }

    window.count++;

    return {
        allowed: window.count <= limit,
        remaining: Math.max(0, limit - window.count),
        resetAt: window.resetAt,
    };
}
