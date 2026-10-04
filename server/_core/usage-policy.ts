import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";
import { consumeRateLimit, getClientKey } from "./security";

export type UsageKind = "chat" | "search" | "image" | "video" | "code" | "file" | "voice" | "model";
type WindowName = "minute" | "hour" | "day" | "month";
type LimitConfig = Partial<Record<WindowName, number>>;
type PolicyConfig = Record<UsageKind, LimitConfig> & { global: LimitConfig };

const DEFAULT_POLICY: PolicyConfig = {
  chat: { minute: 20, hour: 500, day: 5000, month: 100000 },
  search: { minute: 5, hour: 100, day: 500, month: 10000 },
  image: { minute: 3, hour: 50, day: 300, month: 5000 },
  video: { minute: 1, hour: 10, day: 50, month: 500 },
  code: { minute: 20, hour: 500, day: 5000, month: 100000 },
  file: { minute: 10, hour: 100, day: 500, month: 10000 },
  voice: { minute: 5, hour: 100, day: 500, month: 10000 },
  model: { minute: 10, hour: 200, day: 1000, month: 20000 },
  global: { minute: 40, hour: 1000, day: 10000, month: 200000 },
};

const counters = new Map<string, { count: number; resetAt: number }>();
const windowMs: Record<WindowName, number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  month: 2_592_000_000,
};

function parsePolicy(): PolicyConfig {
  try {
    const parsed = JSON.parse(process.env.USAGE_LIMITS_JSON ?? "{}");
    const output = structuredClone(DEFAULT_POLICY) as PolicyConfig;
    for (const kind of Object.keys(output) as Array<keyof PolicyConfig>) {
      if (parsed?.[kind] && typeof parsed[kind] === "object") {
        output[kind] = { ...output[kind], ...parsed[kind] } as LimitConfig;
      }
    }
    return output;
  } catch {
    return DEFAULT_POLICY;
  }
}

export function subscriptionsEnabled() {
  return /^(1|true|yes|on)$/i.test(process.env.SUBSCRIPTIONS_ENABLED ?? "false");
}

export function getSubscriptionConfig() {
  return {
    enabled: subscriptionsEnabled(),
    mode: subscriptionsEnabled() ? "LIVE" : "TRIAL_FREE_OPEN",
    currency: process.env.PLUS_CURRENCY ?? "USD",
    plusPriceCents: Number(process.env.PLUS_PRICE_CENTS ?? 500),
    plans: ["free", "plus"],
  } as const;
}

export function getUsagePolicy() {
  return parsePolicy();
}

function increment(key: string, limit: number, duration: number) {
  const now = Date.now();
  const bucketKey = `${key}:${duration}`;
  const current = counters.get(bucketKey);
  if (!current || current.resetAt <= now) {
    counters.set(bucketKey, { count: 1, resetAt: now + duration });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (current.count >= limit) return { allowed: false, retryAfterMs: current.resetAt - now };
  current.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

function assertWindowAvailable(key: string, limit: number, duration: number) {
  const current = counters.get(`${key}:${duration}`);
  if (!current || current.resetAt <= Date.now() || current.count < limit) return;
  throw new TRPCError({
    code: "TOO_MANY_REQUESTS",
    message: `انتهت حصة الاستخدام الحالية لهذه الميزة. حاول بعد ${Math.max(1, Math.ceil((current.resetAt - Date.now()) / 60_000))} دقيقة.`,
  });
}

/** Check provider-backed usage without consuming quota. */
export function assertUsageAvailable(input: { req: Request; user: User | null; kind: UsageKind }) {
  const policy = parsePolicy();
  const identity = getClientKey(input.req, input.user?.id);
  const checks: Array<[string, LimitConfig]> = [
    [`user:${identity}:${input.kind}`, policy[input.kind]],
    [`user:${identity}:global`, policy.global],
  ];
  for (const [key, limits] of checks) {
    for (const window of Object.keys(windowMs) as WindowName[]) {
      const limit = limits[window];
      if (limit && limit > 0) assertWindowAvailable(`${key}:${window}`, limit, windowMs[window]);
    }
  }
}

export function enforceUsage(input: { req: Request; user: User | null; kind: UsageKind; model?: string | null }) {
  const policy = parsePolicy();
  const identity = getClientKey(input.req, input.user?.id);
  const antiSpam = consumeRateLimit(`anti:${identity}:${input.kind}`, policy[input.kind].minute ?? 20, 60_000);
  if (!antiSpam.allowed) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "تم تجاوز معدل الطلبات مؤقتًا. حاول بعد قليل." });
  }
  const checks: Array<[string, LimitConfig]> = [
    [`user:${identity}:${input.kind}`, policy[input.kind]],
    [`user:${identity}:global`, policy.global],
  ];
  for (const [key, limits] of checks) {
    for (const window of Object.keys(windowMs) as WindowName[]) {
      const limit = limits[window];
      if (!limit || limit <= 0) continue;
      const result = increment(`${key}:${window}`, limit, windowMs[window]);
      if (!result.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `انتهت حصة الاستخدام الحالية لهذه الميزة. حاول بعد ${Math.max(1, Math.ceil(result.retryAfterMs / 60_000))} دقيقة.`,
        });
      }
    }
  }
  return { identity, plan: "free" as const, policy };
}

export function resetUsageForTests() {
  counters.clear();
}
