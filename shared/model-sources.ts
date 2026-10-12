import { z } from "zod";

export const modelSourceKinds = [
  "github", "gitlab", "bitbucket", "huggingface", "modelscope", "kaggle", "ollama", "replicate", "civitai", "openrouter", "together", "groq", "nvidia-ngc", "docker-hub", "openai-compatible",
] as const;
export type ModelSourceKind = (typeof modelSourceKinds)[number];

export const modelSourceInput = z.object({ source: z.enum(modelSourceKinds), reference: z.string().trim().min(2).max(240), query: z.string().trim().max(120).optional() });
export type NormalizedModelSource = { source: ModelSourceKind; reference: string; url: string; label: string; modelId?: string; install?: string };

export type FeaturedModelRepository = {
  id: string;
  name: string;
  url: string;
  source: ModelSourceKind;
  reference?: string;
  category: "models" | "runtime" | "framework" | "speech" | "vision" | "image" | "video";
  supports: string[];
};

export const featuredModelRepositories: FeaturedModelRepository[] = [
  { id: "hf-models", name: "Hugging Face Models", url: "https://huggingface.co/models", source: "huggingface", category: "models", supports: ["model catalog", "metadata"] },
  { id: "hf-gguf", name: "Hugging Face GGUF Models", url: "https://huggingface.co/models?library=gguf", source: "huggingface", category: "models", supports: ["GGUF", "metadata", "download"] },
  { id: "ollama", name: "Ollama", url: "https://github.com/ollama/ollama", source: "github", reference: "ollama/ollama", category: "runtime", supports: ["repository", "Ollama pull", "run"] },
  { id: "llama-cpp", name: "llama.cpp", url: "https://github.com/ggml-org/llama.cpp", source: "github", reference: "ggml-org/llama.cpp", category: "runtime", supports: ["GGUF", "repository", "metadata"] },
  { id: "mlc-llm", name: "MLC LLM", url: "https://github.com/mlc-ai/mlc-llm", source: "github", reference: "mlc-ai/mlc-llm", category: "runtime", supports: ["repository", "mobile runtime"] },
  { id: "onnx-models", name: "ONNX Models", url: "https://github.com/onnx/models", source: "github", reference: "onnx/models", category: "models", supports: ["ONNX", "repository"] },
  { id: "transformers", name: "Hugging Face Transformers", url: "https://github.com/huggingface/transformers", source: "github", reference: "huggingface/transformers", category: "framework", supports: ["repository", "model metadata"] },
  { id: "candle", name: "Hugging Face Candle", url: "https://github.com/huggingface/candle", source: "github", reference: "huggingface/candle", category: "framework", supports: ["repository", "Rust runtime"] },
  { id: "openvino", name: "OpenVINO", url: "https://github.com/openvinotoolkit/openvino", source: "github", reference: "openvinotoolkit/openvino", category: "framework", supports: ["repository", "ONNX", "runtime"] },
  { id: "executorch", name: "ExecuTorch", url: "https://github.com/pytorch/executorch", source: "github", reference: "pytorch/executorch", category: "framework", supports: ["repository", "mobile runtime"] },
  { id: "litert", name: "LiteRT", url: "https://github.com/google-ai-edge/LiteRT", source: "github", reference: "google-ai-edge/LiteRT", category: "framework", supports: ["repository", "mobile runtime"] },
  { id: "whisper-cpp", name: "whisper.cpp", url: "https://github.com/ggml-org/whisper.cpp", source: "github", reference: "ggml-org/whisper.cpp", category: "speech", supports: ["repository", "GGUF", "speech"] },
  { id: "piper", name: "Piper", url: "https://github.com/rhasspy/piper", source: "github", reference: "rhasspy/piper", category: "speech", supports: ["repository", "TTS"] },
  { id: "rwkv", name: "RWKV", url: "https://github.com/BlinkDL/RWKV-LM", source: "github", reference: "BlinkDL/RWKV-LM", category: "models", supports: ["repository", "text generation"] },
  { id: "mamba", name: "Mamba", url: "https://github.com/state-spaces/mamba", source: "github", reference: "state-spaces/mamba", category: "models", supports: ["repository", "text generation"] },
  { id: "smollm", name: "SmolLM", url: "https://github.com/huggingface/smollm", source: "github", reference: "huggingface/smollm", category: "models", supports: ["repository", "text generation"] },
  { id: "corenet", name: "OpenELM / CoreNet", url: "https://github.com/apple/corenet", source: "github", reference: "apple/corenet", category: "models", supports: ["repository", "text generation"] },
  { id: "minicpm", name: "MiniCPM", url: "https://github.com/OpenBMB/MiniCPM", source: "github", reference: "OpenBMB/MiniCPM", category: "vision", supports: ["repository", "vision"] },
  { id: "llava", name: "LLaVA", url: "https://github.com/haotian-liu/LLaVA", source: "github", reference: "haotian-liu/LLaVA", category: "vision", supports: ["repository", "vision"] },
  { id: "openclip", name: "OpenCLIP", url: "https://github.com/mlfoundations/open_clip", source: "github", reference: "mlfoundations/open_clip", category: "vision", supports: ["repository", "vision"] },
  { id: "fish-speech", name: "Fish Speech", url: "https://github.com/fishaudio/fish-speech", source: "github", reference: "fishaudio/fish-speech", category: "speech", supports: ["repository", "TTS"] },
  { id: "chattts", name: "ChatTTS", url: "https://github.com/2noise/ChatTTS", source: "github", reference: "2noise/ChatTTS", category: "speech", supports: ["repository", "TTS"] },
  { id: "funasr", name: "FunASR", url: "https://github.com/modelscope/FunASR", source: "github", reference: "modelscope/FunASR", category: "speech", supports: ["repository", "ASR"] },
  { id: "open-sora", name: "Open-Sora", url: "https://github.com/hpcaitech/Open-Sora", source: "github", reference: "hpcaitech/Open-Sora", category: "video", supports: ["repository", "video"] },
  { id: "cogvideo", name: "CogVideo", url: "https://github.com/THUDM/CogVideo", source: "github", reference: "THUDM/CogVideo", category: "video", supports: ["repository", "video"] },
  { id: "kandinsky", name: "Kandinsky", url: "https://github.com/ai-forever/Kandinsky-3", source: "github", reference: "ai-forever/Kandinsky-3", category: "image", supports: ["repository", "image"] },
  { id: "sd-webui", name: "Stable Diffusion WebUI", url: "https://github.com/AUTOMATIC1111/stable-diffusion-webui", source: "github", reference: "AUTOMATIC1111/stable-diffusion-webui", category: "image", supports: ["repository", "image runtime"] },
  { id: "comfyui", name: "ComfyUI", url: "https://github.com/comfyanonymous/ComfyUI", source: "github", reference: "comfyanonymous/ComfyUI", category: "image", supports: ["repository", "workflow", "image runtime"] },
  { id: "gpt4all", name: "GPT4All", url: "https://github.com/nomic-ai/gpt4all", source: "github", reference: "nomic-ai/gpt4all", category: "runtime", supports: ["repository", "local models"] },
  { id: "localai", name: "LocalAI", url: "https://github.com/mudler/LocalAI", source: "github", reference: "mudler/LocalAI", category: "runtime", supports: ["repository", "OpenAI-compatible", "run"] },
];

const ownerModel = (source: ModelSourceKind, value: string, host: string, label: string): NormalizedModelSource => {
  if (!/^[^/]+\/[^/#?]+$/.test(value)) throw new Error(`صيغة ${label} يجب أن تكون owner/model`);
  return { source, reference: value, url: `https://${host}/${value}`, label: `${label} · ${value}`, modelId: value };
};

export function normalizeModelSource(source: ModelSourceKind, reference: string): NormalizedModelSource {
  const value = reference.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  if (source === "github") {
    const match = value.match(/^github\.com\/([^/]+)\/([^/#?]+)$/i) ?? value.match(/^([^/]+)\/([^/#?]+)$/);
    if (!match) throw new Error("صيغة GitHub يجب أن تكون owner/repository");
    const repo = `${match[1]}/${match[2]}`; return { source, reference: repo, url: `https://github.com/${repo}`, label: `GitHub · ${repo}` };
  }
  if (source === "gitlab") return ownerModel(source, value.replace(/^gitlab\.com\//i, ""), "gitlab.com", "GitLab");
  if (source === "bitbucket") return ownerModel(source, value.replace(/^bitbucket\.org\//i, ""), "bitbucket.org", "Bitbucket");
  if (source === "huggingface") return ownerModel(source, value.replace(/^huggingface\.co\//i, ""), "huggingface.co", "Hugging Face");
  if (source === "modelscope") return ownerModel(source, value.replace(/^modelscope\.cn\/models\//i, ""), "modelscope.cn/models", "ModelScope");
  if (source === "kaggle") return ownerModel(source, value.replace(/^kaggle\.com\/models\//i, ""), "kaggle.com/models", "Kaggle");
  if (source === "replicate") return ownerModel(source, value, "replicate.com", "Replicate");
  if (source === "civitai") {
    const modelId = value.replace(/^civitai\.com\/models\//i, "");
    if (!/^\d+$/.test(modelId)) throw new Error("صيغة Civitai يجب أن تكون رقم model");
    return { source, reference: modelId, modelId, url: `https://civitai.com/models/${modelId}`, label: `Civitai · ${modelId}` };
  }
  if (source === "ollama") { const modelId = value.replace(/^ollama\.com\/library\//i, "").replace(/^library\//i, ""); if (!/^[a-z0-9][a-z0-9._:-]{1,120}$/i.test(modelId)) throw new Error("صيغة Ollama يجب أن تكون اسم نموذج مثل qwen2.5:7b"); return { source, reference: modelId, url: `https://ollama.com/library/${encodeURIComponent(modelId)}`, label: `Ollama · ${modelId}`, modelId, install: `ollama pull ${modelId}` }; }
  if (source === "openrouter") return { source, reference: value, url: `https://openrouter.ai/${value}`, label: `OpenRouter · ${value}`, modelId: value };
  if (source === "together") return { source, reference: value, url: `https://api.together.xyz/models/${value}`, label: `Together AI · ${value}`, modelId: value };
  if (source === "groq") return { source, reference: value, url: `https://console.groq.com/docs/models`, label: `Groq · ${value}`, modelId: value };
  if (source === "nvidia-ngc") return { source, reference: value, url: `https://catalog.ngc.nvidia.com/orgs/nvidia/teams/${value}`, label: `NVIDIA NGC · ${value}`, modelId: value };
  if (source === "docker-hub") return ownerModel(source, value.replace(/^hub\.docker\.com\/r\//i, ""), "hub.docker.com/r", "Docker Hub");
  const url = reference.startsWith("http") ? reference : `https://${reference}`;
  const parsed = new URL(url); if (parsed.protocol !== "https:") throw new Error("مصدر OpenAI-compatible يجب أن يستخدم HTTPS");
  return { source, reference: parsed.toString().replace(/\/$/, ""), url: parsed.toString(), label: `OpenAI-compatible · ${parsed.hostname}` };
}
