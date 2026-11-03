import { describe, expect, it, vi } from "vitest";
import { getOwnedAttachmentDownload, type UserAttachmentRecord } from "../server/_core/attachment-access";

const readyFile: UserAttachmentRecord = {
  storageKey: "uploads/private-object-key",
  fileName: "report.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1024,
  status: "ready",
};

describe("owned attachment download", () => {
  it("returns a signed URL and safe metadata without exposing storageKey", async () => {
    const lookup = vi.fn(async (userId: number, id: number) => userId === 12 && id === 7 ? readyFile : undefined);
    const signUrl = vi.fn(async (key: string) => `https://storage.example/signed/${encodeURIComponent(key)}`);

    const result = await getOwnedAttachmentDownload(12, 7, lookup, signUrl);

    expect(lookup).toHaveBeenCalledWith(12, 7);
    expect(signUrl).toHaveBeenCalledWith(readyFile.storageKey);
    expect(result).toEqual({ url: "https://storage.example/signed/uploads%2Fprivate-object-key", fileName: "report.pdf", mimeType: "application/pdf", sizeBytes: 1024 });
    expect(result).not.toHaveProperty("storageKey");
  });

  it("does not issue a download URL for a file owned by a different user", async () => {
    const lookup = vi.fn(async () => undefined);
    const signUrl = vi.fn(async () => "https://storage.example/should-not-be-called");

    await expect(getOwnedAttachmentDownload(99, 7, lookup, signUrl)).rejects.toThrow("ATTACHMENT_NOT_FOUND");
    expect(signUrl).not.toHaveBeenCalled();
  });

  it("does not issue a download URL before processing has completed", async () => {
    const file = { ...readyFile, status: "processing" };
    const signUrl = vi.fn(async () => "https://storage.example/should-not-be-called");

    await expect(getOwnedAttachmentDownload(12, 7, async () => file, signUrl)).rejects.toThrow("ATTACHMENT_NOT_READY");
    expect(signUrl).not.toHaveBeenCalled();
  });
});
