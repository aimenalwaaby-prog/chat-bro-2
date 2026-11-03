export type UserAttachmentRecord = {
  storageKey: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  status: string;
};

export async function getOwnedAttachmentDownload(
  userId: number,
  attachmentId: number,
  lookup: (userId: number, attachmentId: number) => Promise<UserAttachmentRecord | undefined>,
  signUrl: (storageKey: string) => Promise<string>,
) {
  const file = await lookup(userId, attachmentId);
  if (!file) throw new Error("ATTACHMENT_NOT_FOUND");
  if (file.status !== "ready") throw new Error("ATTACHMENT_NOT_READY");
  const url = await signUrl(file.storageKey);
  return { url, fileName: file.fileName, mimeType: file.mimeType, sizeBytes: file.sizeBytes };
}
