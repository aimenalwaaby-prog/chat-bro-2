import { beforeEach, describe, expect, it } from "vitest";
import { enforceUsage, getSubscriptionConfig, resetUsageForTests } from "../server/_core/usage-policy";

describe("usage policy and subscriptions", () => {
  beforeEach(() => {
    resetUsageForTests();
    delete process.env.SUBSCRIPTIONS_ENABLED;
    delete process.env.USAGE_LIMITS_JSON;
  });

  it("keeps subscriptions disabled in the trial launch", () => {
    expect(getSubscriptionConfig().enabled).toBe(false);
    expect(getSubscriptionConfig().mode).toBe("TRIAL_FREE_OPEN");
  });

  it("enforces the central policy per client and feature", () => {
    process.env.USAGE_LIMITS_JSON = JSON.stringify({ chat: { minute: 1 }, global: { minute: 100 } });
    const req = { headers: {}, ip: "203.0.113.10" } as never;
    expect(() => enforceUsage({ req, user: null, kind: "chat" })).not.toThrow();
    expect(() => enforceUsage({ req, user: null, kind: "chat" })).toThrow(/معدل الطلبات|حصة الاستخدام/);
  });
});
