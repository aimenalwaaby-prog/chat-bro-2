import type { Request } from "express";

/** Lightweight in-process rate limiter. For multi-instance production deployments,
 * replace this with Redis/Upstash/etc. so limits are shared between instances. */
const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_ENTRIES = 10_000;

function cleanup(now: number) {
  if (buckets.size < MAX_ENTRIES) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function getClientKey(req: Request, userId?: number | string | null) {
  if (userId !== undefined && userId !== null) return `user:${userId}`;
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : req.ip;
  return `ip:${ip || "unknown"}`;
}

export function consumeRateLimit(key: string, limit: number, windowMs = WINDOW_MS) {
  const now = Date.now();
  cleanup(now);
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterMs: 0 };
  }
  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, current.resetAt - now),
    };
  }
  current.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - current.count),
    retryAfterMs: 0,
  };
}

export function resetRateLimitForTests() {
  buckets.clear();
}
