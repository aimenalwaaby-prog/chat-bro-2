import { unzipSync } from "fflate";
import { storagePut } from "../storage";
import { normalizeModelSource, type ModelSourceKind, type NormalizedModelSource } from "../../shared/model-sources";

const MAX_INSPECT_BYTES = 64 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 2_000;
const MAX_METADATA_CHARS = 120_000;

type RepoFile = { path: string; size?: number; downloadUrl?: string; type?: string };
export type RepositoryInspection = {
  normalized: NormalizedModelSource;
  description?: string;
  defaultBranch?: string;
  files: RepoFile[];
  manifests: Array<{ path: string; kind: string; size?: number; readable: boolean }>;
  capabilities: { canSync: boolean; canInstall: boolean; canRun: boolean; installModes: string[] };
  metadata: Record<string, unknown>;
};

function trimText(value: string) { return value.replace(/\u0000/g, "").slice(0, MAX_METADATA_CHARS); }
function safePath(value: string) {
  const path = value.replace(/\\/g, "/");
  if (!path || path.startsWith("/") || path.split("/").includes("..")) throw new Error("مسار ملف غير آمن.");
  return path;
}
function authHeaders(source: ModelSourceKind): Record<string, string> {
  if (source === "github" && process.env.GITHUB_TOKEN) return { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: "application/vnd.github+json" };
  if (source === "huggingface" && process.env.HF_TOKEN) return { authorization: `Bearer ${process.env.HF_TOKEN}` };
  if (source === "replicate" && process.env.REPLICATE_API_TOKEN) return { authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` };
  return {};
}
async function fetchJson(url: string, source: ModelSourceKind) {
  const headers: Record<string, string> = { accept: "application/json", ...authHeaders(source) };
  const response = await fetch(url, { headers, redirect: "error", signal: AbortSignal.timeout(30_000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`تعذر قراءة المصدر (${response.status}): ${trimText(text)}`);
  try { return JSON.parse(text) as Record<string, unknown> | unknown[]; } catch { throw new Error("استجابة المصدر ليست JSON صالحًا."); }
}
function fileKind(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".apk")) return "apk";
  if (lower.endsWith(".gguf")) return "gguf";
  if (lower.endsWith(".safetensors")) return "safetensors";
  if (lower.endsWith(".onnx")) return "onnx";
  if (lower.endsWith(".zip") || lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) return "archive";
  if (/readme|config|tokenizer|manifest|requirements|package\.json/i.test(lower)) return "metadata";
  return "file";
}
function capabilities(source: ModelSourceKind, files: RepoFile[]) {
  const hasOllama = Boolean(process.env.OLLAMA_BASE_URL);
  const hasArchive = files.some((file) => ["apk", "archive", "gguf", "safetensors", "onnx"].includes(fileKind(file.path)));
  if (source === "ollama") return { canSync: true, canInstall: hasOllama, canRun: hasOllama, installModes: hasOllama ? ["ollama-pull"] : ["ollama-pull-unconfigured"] };
  if (["openai-compatible", "openrouter", "together", "groq"].includes(source)) return { canSync: true, canInstall: false, canRun: true, installModes: ["remote-model"] };
  if (["replicate", "civitai", "kaggle", "nvidia-ngc", "docker-hub"].includes(source)) return { canSync: true, canInstall: false, canRun: false, installModes: [] };
  if (source === "huggingface") return { canSync: true, canInstall: hasArchive, canRun: Boolean(process.env.HF_INFERENCE_TOKEN || process.env.HF_TOKEN), installModes: hasArchive ? ["download-artifacts", "inference-api"] : ["inference-api"] };
  return { canSync: true, canInstall: hasArchive, canRun: false, installModes: hasArchive ? ["download-artifacts"] : [] };
}

export async function inspectModelRepository(source: ModelSourceKind, reference: string): Promise<RepositoryInspection> {
  const normalized = normalizeModelSource(source, reference);
  let description = "";
  let defaultBranch: string | undefined;
  let files: RepoFile[] = [];
  const metadata: Record<string, unknown> = {};
  if (source === "github") {
    const repo = await fetchJson(`https://api.github.com/repos/${normalized.reference}`, source) as Record<string, unknown>;
    description = typeof repo.description === "string" ? repo.description : "";
    defaultBranch = typeof repo.default_branch === "string" ? repo.default_branch : "main";
    const tree = await fetchJson(`https://api.github.com/repos/${normalized.reference}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`, source) as { tree?: Array<{ path?: string; size?: number; type?: string; url?: string }> };
    files = (tree.tree ?? []).filter((item) => item.type === "blob" && item.path).slice(0, MAX_ARCHIVE_ENTRIES).map((item) => ({ path: safePath(item.path!), size: item.size, type: item.type, downloadUrl: `https://raw.githubusercontent.com/${normalized.reference}/${encodeURIComponent(defaultBranch!)}/${item.path!.split("/").map(encodeURIComponent).join("/")}` }));
    metadata.repository = repo;
  } else if (source === "gitlab") {
    const project = await fetchJson(`https://gitlab.com/api/v4/projects/${encodeURIComponent(normalized.reference)}`, source) as Record<string, unknown>;
    description = typeof project.description === "string" ? project.description : "";
    defaultBranch = typeof project.default_branch === "string" ? project.default_branch : "main";
    const tree = await fetchJson(`https://gitlab.com/api/v4/projects/${encodeURIComponent(normalized.reference)}/repository/tree?recursive=true&per_page=100`, source) as Array<{ path?: string; type?: string; size?: number }>;
    files = tree.filter((item) => item.type === "blob" && item.path).slice(0, MAX_ARCHIVE_ENTRIES).map((item) => ({ path: safePath(item.path!), size: item.size, downloadUrl: `https://gitlab.com/${normalized.reference}/-/raw/${encodeURIComponent(defaultBranch!)}/${item.path!.split("/").map(encodeURIComponent).join("/")}` }));
    metadata.project = project;
  } else if (source === "bitbucket") {
    const [workspace, repo] = normalized.reference.split("/");
    const info = await fetchJson(`https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(workspace!)}/${encodeURIComponent(repo!)}`, source) as Record<string, unknown>;
    description = typeof info.description === "string" ? info.description : "";
    defaultBranch = typeof (info.mainbranch as { name?: string } | undefined)?.name === "string" ? (info.mainbranch as { name: string }).name : "main";
    const tree = await fetchJson(`https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(workspace!)}/${encodeURIComponent(repo!)}/src/${encodeURIComponent(defaultBranch!)}/?pagelen=100`, source) as { values?: Array<{ path?: string; type?: string; size?: number }> };
    files = (tree.values ?? []).filter((item) => item.type === "commit_file" && item.path).slice(0, MAX_ARCHIVE_ENTRIES).map((item) => ({ path: safePath(item.path!), size: item.size, downloadUrl: `https://bitbucket.org/${normalized.reference}/raw/${defaultBranch}/${item.path!.split("/").map(encodeURIComponent).join("/")}` }));
    metadata.repository = info;
  } else if (source === "huggingface") {
    const info = await fetchJson(`https://huggingface.co/api/models/${encodeURIComponent(normalized.reference).replace("%2F", "/")}`, source) as Record<string, unknown>;
    description = typeof info.pipeline_tag === "string" ? info.pipeline_tag : "Hugging Face model";
    const siblings = Array.isArray(info.siblings) ? info.siblings as Array<{ rfilename?: string; size?: number }> : [];
    files = siblings.filter((item) => item.rfilename).slice(0, MAX_ARCHIVE_ENTRIES).map((item) => ({ path: safePath(item.rfilename!), size: item.size, downloadUrl: `https://huggingface.co/${normalized.reference}/resolve/main/${item.rfilename!.split("/").map(encodeURIComponent).join("/")}` }));
    metadata.model = info;
  } else if (source === "civitai") {
    const info = await fetchJson(`https://civitai.com/api/v1/models/${encodeURIComponent(normalized.reference)}`, source) as Record<string, unknown>;
    description = typeof info.description === "string" ? info.description.replace(/<[^>]+>/g, "") : "Civitai model";
    metadata.model = info;
    const versions = Array.isArray(info.modelVersions) ? info.modelVersions as Array<{ id?: number; files?: Array<{ name?: string; sizeKB?: number; downloadUrl?: string }> }> : [];
    files = (versions[0]?.files ?? []).filter((item) => item.name).map((item) => ({ path: safePath(item.name!), size: item.sizeKB ? item.sizeKB * 1024 : undefined, downloadUrl: item.downloadUrl }));
  } else if (source === "openrouter") {
    const info = await fetchJson(`https://openrouter.ai/api/v1/models/${encodeURIComponent(normalized.reference)}`, source) as Record<string, unknown>;
    description = typeof info.description === "string" ? info.description : "OpenRouter model";
    metadata.model = info;
    files = [{ path: `models/${normalized.reference}`, type: "remote-model" }];
  } else if (source === "together" || source === "groq") {
    const endpoint = source === "together" ? "https://api.together.xyz/v1/models" : "https://api.groq.com/openai/v1/models";
    const models = await fetchJson(endpoint, source) as Array<{ id?: string }> | { data?: Array<{ id?: string }> };
    const list = Array.isArray(models) ? models : models.data ?? [];
    const match = list.find((item) => item.id === normalized.reference) ?? { id: normalized.reference };
    description = `${source === "together" ? "Together AI" : "Groq"} hosted model`;
    metadata.model = match;
    files = [{ path: `models/${match.id ?? normalized.reference}`, type: "remote-model" }];
  } else if (source === "docker-hub") {
    const [namespace, name] = normalized.reference.split("/");
    const info = await fetchJson(`https://hub.docker.com/v2/repositories/${encodeURIComponent(namespace!)}/${encodeURIComponent(name!)}`, source) as Record<string, unknown>;
    description = typeof info.description === "string" ? info.description : "Docker image";
    metadata.repository = info;
    files = [{ path: `docker/${normalized.reference}`, type: "container-image" }];
  } else if (source === "kaggle") {
    description = "Kaggle model registry entry";
    metadata.model = await fetchJson(`https://www.kaggle.com/api/v1/models/${encodeURIComponent(normalized.reference)}`, source).catch(() => ({}));
    files = [{ path: `kaggle/${normalized.reference}`, type: "remote-model" }];
  } else if (source === "nvidia-ngc") {
    description = "NVIDIA NGC model catalog entry";
    metadata.catalogUrl = normalized.url;
    files = [{ path: `ngc/${normalized.reference}`, type: "remote-model" }];
  } else if (source === "replicate") {
    const info = await fetchJson(`https://api.replicate.com/v1/models/${normalized.reference}`, source) as Record<string, unknown>;
    description = typeof info.description === "string" ? info.description : "Replicate model";
    metadata.model = info;
    files = [];
  } else if (source === "openai-compatible") {
    const base = normalized.reference.replace(/\/$/, "");
    const models = await fetchJson(`${base}/models`, source) as { data?: Array<{ id?: string }> };
    files = (models.data ?? []).filter((item) => item.id).map((item) => ({ path: `models/${item.id}`, type: "remote-model" }));
    metadata.models = models.data ?? [];
  } else if (source === "ollama") {
    const base = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
    const tags = await fetchJson(`${base}/api/tags`, source) as { models?: Array<{ name?: string; size?: number; digest?: string }> };
    files = (tags.models ?? []).filter((item) => item.name).map((item) => ({ path: `ollama/${item.name}`, size: item.size, type: "installed-model" }));
    metadata.models = tags.models ?? [];
  } else {
    const info = await fetchJson(`https://modelscope.cn/api/v1/models/${normalized.reference}`, source).catch(() => ({}));
    metadata.model = info;
    files = [];
  }
  const manifests = files.filter((file) => ["metadata", "apk", "archive", "gguf", "safetensors", "onnx"].includes(fileKind(file.path))).map((file) => ({ path: file.path, kind: fileKind(file.path), size: file.size, readable: ["metadata", "apk", "archive"].includes(fileKind(file.path)) }));
  return { normalized, description, defaultBranch, files, manifests, capabilities: capabilities(source, files), metadata };
}

async function fetchLimited(url: string, source: ModelSourceKind) {
  const response = await fetch(url, { headers: authHeaders(source), redirect: "error", signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`تعذر تنزيل الملف (${response.status}).`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_INSPECT_BYTES) throw new Error("الملف أكبر من حد القراءة الآمنة (64MB).");
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > MAX_INSPECT_BYTES) throw new Error("الملف أكبر من حد القراءة الآمنة (64MB).");
  return { data, mimeType: response.headers.get("content-type") ?? "application/octet-stream" };
}

export async function readRepositoryFile(inspection: RepositoryInspection, path: string) {
  const file = inspection.files.find((item) => item.path === path);
  if (!file?.downloadUrl) throw new Error("الملف غير موجود أو لا يملك المصدر رابط تنزيل.");
  const { data, mimeType } = await fetchLimited(file.downloadUrl, inspection.normalized.source);
  const kind = fileKind(path);
  if (kind === "apk" || kind === "archive") {
    let entries: string[] = [];
    try { entries = Object.keys(unzipSync(new Uint8Array(data))).slice(0, MAX_ARCHIVE_ENTRIES).map(safePath); } catch { throw new Error("تعذر قراءة الأرشيف أو APK؛ قد يكون تالفًا أو غير ZIP."); }
    return { path, kind, mimeType, size: data.length, text: `أرشيف ${kind} يحتوي على ${entries.length} ملفًا.`, entries, installable: kind === "apk" };
  }
  if (kind === "metadata" || /\.(json|md|txt|ya?ml|toml|xml)$/i.test(path)) return { path, kind, mimeType, size: data.length, text: trimText(data.toString("utf8")), installable: false };
  return { path, kind, mimeType, size: data.length, text: `ملف ثنائي ${kind} بحجم ${data.length} بايت.`, installable: true };
}

export async function syncRepository(inspection: RepositoryInspection) {
  const selected = inspection.files.filter((file) => fileKind(file.path) === "metadata" && file.downloadUrl).slice(0, 12);
  const readable: Array<{ path: string; text: string }> = [];
  for (const file of selected) {
    try { const result = await readRepositoryFile(inspection, file.path); if (result.text) readable.push({ path: file.path, text: result.text }); } catch { /* one bad optional manifest must not abort sync */ }
  }
  return { syncedAt: new Date().toISOString(), fileCount: inspection.files.length, manifests: inspection.manifests, readable, metadata: inspection.metadata };
}

export async function installRepository(inspection: RepositoryInspection, mode: string) {
  if (inspection.normalized.source === "ollama" && mode === "ollama-pull") {
    const base = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
    const response = await fetch(`${base}/api/pull`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: inspection.normalized.modelId, stream: false }), signal: AbortSignal.timeout(30 * 60_000) });
    if (!response.ok) throw new Error(`فشل تثبيت نموذج Ollama (${response.status}).`);
    return { mode, installed: true, runtime: "ollama", model: inspection.normalized.modelId, result: await response.json() };
  }
  if (["openai-compatible", "openrouter", "together", "groq"].includes(inspection.normalized.source) && mode === "remote-model") return { mode, installed: true, runtime: inspection.normalized.source, endpoint: inspection.normalized.url, model: inspection.normalized.modelId, models: inspection.files.map((file) => file.path.replace(/^models\//, "")) };
  if (mode === "inference-api" && inspection.normalized.source === "huggingface") return { mode, installed: true, runtime: "huggingface-inference", model: inspection.normalized.modelId };
  if (mode === "download-artifacts") {
    const candidates = inspection.files.filter((file) => file.downloadUrl && ["metadata", "gguf", "safetensors", "onnx", "archive", "apk"].includes(fileKind(file.path))).slice(0, 5);
    const downloaded: Array<{ path: string; url: string; size: number }> = [];
    for (const file of candidates) {
      const { data, mimeType } = await fetchLimited(file.downloadUrl!, inspection.normalized.source);
      const stored = await storagePut(`repositories/${Date.now()}-${file.path.split("/").pop()}`, data, mimeType);
      downloaded.push({ path: file.path, url: stored.url, size: data.length });
    }
    return { mode, installed: true, runtime: "artifact-storage", downloaded };
  }
  throw new Error("طريقة التثبيت غير مدعومة لهذا المصدر أو لم يتم إعداد runtime مناسب.");
}
