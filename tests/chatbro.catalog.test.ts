import { describe, expect, it } from "vitest";
import { chatBroModels, filterModels, getModelTypeTags, isModelAvailableToSelect } from "../shared/chatbro-catalog";

describe("Chat Bro model catalog", () => {
  it("keeps only the verified default route in the static catalog", () => {
    expect(chatBroModels.length).toBe(1);
    expect(chatBroModels.some((model) => model.tone === "full")).toBe(true);
    expect(chatBroModels.every((model) => model.status.length > 0 && model.limit.length > 0 && model.modelId !== undefined)).toBe(true);
    expect(chatBroModels.some((model) => model.modelId.startsWith("planned:"))).toBe(false);
    expect(chatBroModels.find((model) => !model.modelId)?.modelId).toBe("");
  });

  it("filters by model capability and provider/model query", () => {
    const examples = [
      { ...chatBroModels[0], name: "Qwen Coder", modelId: "builtin:qwen-coder", provider: "Built-in", providerKey: "builtIn" as const, category: "محادثة", types: ["محادثة", "برمجة"] },
      { ...chatBroModels[0], name: "Claude Vision", modelId: "anthropic:claude-vision", provider: "Anthropic", providerKey: "anthropic" as const, category: "محادثة", inputModalities: ["text", "image"], outputModalities: ["text"], supportsVision: true },
      { ...chatBroModels[0], name: "Image Creator", modelId: "openrouter:image-creator", provider: "OpenRouter", providerKey: "openrouter" as const, category: "محادثة", inputModalities: ["text"], outputModalities: ["image"] },
    ];
    expect(filterModels(examples, "برمجة", "qwen").map((model) => model.name)).toContain("Qwen Coder");
    expect(filterModels(examples, "فهم الصور", "").map((model) => model.name)).toContain("Claude Vision");
    expect(filterModels(examples, "إنشاء الصور", "").map((model) => model.name)).toContain("Image Creator");
    expect(getModelTypeTags(examples[1])).toContain("فهم الصور");
    expect(getModelTypeTags(examples[2])).toContain("إنشاء الصور");
    expect(filterModels(examples, "الكل", "anthropic").map((model) => model.name)).toContain("Claude Vision");
  });

  it("gates provider catalogs by live server capabilities and keeps local models separate", () => {
    const defaultModel = chatBroModels.find((model) => !model.modelId)!;
    const openRouterModel = { ...defaultModel, modelId: "openrouter:openai/gpt-4o-mini", providerKey: "openrouter" as const, runtime: "gateway" as const };
    const localModel = { ...defaultModel, modelId: "llama:qwen3:0.6b", localOnly: true, runtime: "llama.cpp" as const };
    const plannedModel = { ...defaultModel, modelId: "planned:future" };
    const anthropicModel = { ...openRouterModel, modelId: "anthropic:claude-opus", providerKey: "anthropic" as const };
    const builtInModel = { ...defaultModel, modelId: "builtin:actual-model", providerKey: "builtIn" as const };
    const gatewayModel = { ...defaultModel, modelId: "gateway:kilo:actual-model", providerKey: "gateway" as const, runtime: "gateway" as const };
    const onlyOpenRouter = { builtInLLM: false, openrouter: true, anthropic: false, gateway: false };

    expect(isModelAvailableToSelect(defaultModel, onlyOpenRouter)).toBe(true);
    expect(isModelAvailableToSelect(openRouterModel, onlyOpenRouter)).toBe(true);
    expect(isModelAvailableToSelect(anthropicModel, onlyOpenRouter)).toBe(false);
    expect(isModelAvailableToSelect(builtInModel, onlyOpenRouter)).toBe(false);
    expect(isModelAvailableToSelect(builtInModel, { ...onlyOpenRouter, builtInLLM: true })).toBe(true);
    expect(isModelAvailableToSelect(gatewayModel, { ...onlyOpenRouter, gateway: true })).toBe(true);
    expect(isModelAvailableToSelect(anthropicModel, { ...onlyOpenRouter, anthropic: true })).toBe(true);
    expect(isModelAvailableToSelect(localModel, { ...onlyOpenRouter, builtInLLM: true, gateway: true })).toBe(false);
    expect(isModelAvailableToSelect(plannedModel, null)).toBe(false);
  });
});
