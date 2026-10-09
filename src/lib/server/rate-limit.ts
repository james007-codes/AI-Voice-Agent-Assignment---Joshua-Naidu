import "server-only";

/**
 * Fixed-window rate limiter.
 *
 * In-memory is per serverless instance, so this is a best-effort brake on
 * someone scripting /api/session to burn the Gemini quota, not a hard
 * guarantee. The interface is deliberately tiny so it can be swapped for a
 * shared store (Upstash Redis / Vercel KV) when running at scale.
 */

export interface RateLimiter {
  check(key: string): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
}

export class MemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  async check(key: string) {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      if (this.hits.size > 10_000) this.sweep(now);
      return { allowed: true, retryAfterSeconds: 0 };
    }
    entry.count += 1;
    return {
      allowed: entry.count <= this.limit,
      retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  private sweep(now: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
