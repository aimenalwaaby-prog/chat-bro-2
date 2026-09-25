import { beforeEach, describe, expect, it } from "vitest";
import { consumeRateLimit, resetRateLimitForTests } from "../server/_core/security";

describe("rate limiter", () => {
  beforeEach(() => resetRateLimitForTests());

  it("allows requests up to the configured limit", () => {
    expect(consumeRateLimit("user:1", 2).allowed).toBe(true);
    expect(consumeRateLimit("user:1", 2).allowed).toBe(true);
    expect(consumeRateLimit("user:1", 2).allowed).toBe(false);
  });
});
