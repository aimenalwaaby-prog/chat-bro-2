import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectModelRepository } from "../server/_core/model-repositories";

describe("GitHub repository inspection failures", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("explains GitHub API rate limits and the server token setting", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      message: "API rate limit exceeded for this address",
    }), {
      status: 403,
      headers: { "content-type": "application/json", "x-ratelimit-remaining": "0" },
    }));

    await expect(inspectModelRepository("github", "ggml-org/llama.cpp"))
      .rejects.toThrow(/GitHub API.*GITHUB_TOKEN/);
  });

  it("does not label unrelated GitHub permission errors as rate limits", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      message: "Not Found",
    }), { status: 404, headers: { "content-type": "application/json" } }));

    await expect(inspectModelRepository("github", "missing/repository"))
      .rejects.toThrow(/تعذر قراءة المصدر \(404\)/);
  });
});
