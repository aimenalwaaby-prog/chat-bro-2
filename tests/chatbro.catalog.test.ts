import { describe, expect, it } from "vitest";
import { chatBroModels, filterModels } from "../shared/chatbro-catalog";

describe("Chat Bro model catalog", () => {
  it("keeps a broad catalog with explicit statuses and local models", () => {
    expect(chatBroModels.length).toBeGreaterThan(30);
    expect(new Set(chatBroModels.map((model) => model.tone))).toEqual(new Set(["full", "limited", "trial", "paid"]));
    expect(chatBroModels.every((model) => model.status.length > 0 && model.limit.length > 0 && model.modelId !== undefined)).toBe(true);
    expect(chatBroModels.some((model) => model.localOnly && !model.requiresKey && model.modelId.startsWith("ollama:"))).toBe(true);
  });

  it("filters by category and provider/model query", () => {
    expect(filterModels(chatBroModels, "برمجة", "qwen").map((model) => model.name)).toContain("Qwen 3 Coder");
    expect(filterModels(chatBroModels, "الكل", "google").map((model) => model.name)).toContain("Gemini 3 Flash");
    expect(filterModels(chatBroModels, "صور", "").length).toBeGreaterThan(1);
  });
});
