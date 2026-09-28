import { unzipSync, strFromU8 } from "fflate";
import { PDFParse } from "pdf-parse";

export const FILE_LIMITS = {
  maxBytes: 16 * 1024 * 1024,
  maxZipBytes: 12 * 1024 * 1024,
  maxExtractedBytes: 32 * 1024 * 1024,
  maxFilesInZip: 80,
  maxTextChars: 120_000,
} as const;

const ALLOWED = new Set([
  "application/pdf",
  "text/plain",
  "application/json",
  "application/zip",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/webm",
]);

const TEXT_EXTENSIONS = new Set([".txt", ".json", ".md", ".csv", ".xml", ".log"]);
const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const normalizeName = (name: string) => name.replace(/\\/g, "/").split("/").pop() || "file";
const ext = (name: string) => {
  const value = name.toLowerCase();
  const index = value.lastIndexOf(".");
  return index >= 0 ? value.slice(index) : "";
};

export type ProcessedFile = {
  safeName: string;
  mimeType: string;
  buffer: Buffer;
  extractedText?: string;
  kind: "text" | "pdf" | "zip" | "image" | "audio" | "binary";
};

export function validateFile(name: string, mimeType: string, sizeBytes: number) {
  const safeName = normalizeName(name);
  const normalizedMime = mimeType.toLowerCase().split(";")[0];
  if (!safeName || safeName.length > 255) throw new Error("اسم الملف غير صالح");
  if (sizeBytes <= 0 || sizeBytes > FILE_LIMITS.maxBytes) throw new Error("حجم الملف يتجاوز الحد المسموح (16MB)");
  const extensionAllowed = TEXT_EXTENSIONS.has(ext(safeName)) || [".pdf", ".zip", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp3", ".m4a", ".wav", ".webm"].includes(ext(safeName));
  if (!ALLOWED.has(normalizedMime) && !extensionAllowed) throw new Error("نوع الملف غير مدعوم");
  return { safeName, mimeType: normalizedMime || "application/octet-stream" };
}

const limitText = (text: string) => text.replace(/\u0000/g, "").slice(0, FILE_LIMITS.maxTextChars);

async function extractPdf(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return limitText(result.text || "");
  } finally {
    await parser.destroy();
  }
}

function extractZip(buffer: Buffer) {
  if (buffer.length > FILE_LIMITS.maxZipBytes) throw new Error("ملف ZIP أكبر من الحد المسموح");
  const entries = unzipSync(new Uint8Array(buffer));
  const names = Object.keys(entries);
  if (names.length > FILE_LIMITS.maxFilesInZip) throw new Error("ملف ZIP يحتوي على ملفات كثيرة جدًا");
  let total = 0;
  const chunks: string[] = [];
  for (const name of names) {
    const normalized = name.replace(/\\/g, "/");
    if (normalized.startsWith("/") || normalized.split("/").includes("..")) throw new Error("ملف ZIP يحتوي على مسار غير آمن");
    const data = entries[name];
    total += data.length;
    if (total > FILE_LIMITS.maxExtractedBytes) throw new Error("الحجم المفكوك لملف ZIP كبير جدًا");
    if (data.length && (TEXT_EXTENSIONS.has(ext(normalized)) || normalized.toLowerCase().endsWith(".json"))) {
      chunks.push(`--- ${normalizeName(normalized)} ---\n${strFromU8(data)}`);
    }
  }
  return limitText(chunks.join("\n\n"));
}

export async function processFile(input: { name: string; mimeType: string; base64: string }): Promise<ProcessedFile> {
  const raw = Buffer.from(input.base64, "base64");
  const checked = validateFile(input.name, input.mimeType, raw.length);
  const suffix = ext(checked.safeName);
  if (checked.mimeType === "application/pdf" || suffix === ".pdf") return { ...checked, buffer: raw, kind: "pdf", extractedText: await extractPdf(raw) };
  if (checked.mimeType === "application/zip" || suffix === ".zip") return { ...checked, buffer: raw, kind: "zip", extractedText: extractZip(raw) };
  if (IMAGE_MIMES.has(checked.mimeType)) return { ...checked, buffer: raw, kind: "image" };
  if (checked.mimeType.startsWith("audio/")) return { ...checked, buffer: raw, kind: "audio" };
  if (checked.mimeType.startsWith("text/") || checked.mimeType === "application/json" || TEXT_EXTENSIONS.has(suffix)) {
    return { ...checked, buffer: raw, kind: "text", extractedText: limitText(raw.toString("utf8")) };
  }
  return { ...checked, buffer: raw, kind: "binary" };
}
