import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectModelRepository, installRepository, type RepositoryInspection } from "../server/_core/model-repositories";
import { normalizeModelSource } from "../shared/model-sources";

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

describe("repository installation truthfulness", () => {
  const inspection = (
    source: "openrouter" | "github",
    reference: string,
    installModes: string[],
    files: RepositoryInspection["files"] = [],
  ): RepositoryInspection => ({
    normalized: normalizeModelSource(source, reference),
    files,
    manifests: [],
    capabilities: { canSync: true, canInstall: installModes.length > 0, canRun: false, installModes },
    metadata: {},
  });

  it("rejects an install mode absent from inspection capabilities", async () => {
    await expect(installRepository(
      inspection("github", "owner/repository", []),
      "download-artifacts",
    )).rejects.toThrow(/غير مدعومة/);
  });

  it("does not accept remote-model registration as an install action", async () => {
    await expect(installRepository(
      inspection("openrouter", "openai/gpt-4o-mini", []),
      "remote-model",
    )).rejects.toThrow(/غير مدعومة/);
  });

  it("rejects artifact download when inspection found no downloadable files", async () => {
    await expect(installRepository(
      inspection("github", "owner/repository", ["download-artifacts"]),
      "download-artifacts",
    )).rejects.toThrow(/لم يعثر الفحص على ملفات قابلة للتنزيل/);
  });
});
