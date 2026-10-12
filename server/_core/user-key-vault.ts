import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type UserProviderKey = {
  id: number;
  userId: number;
  name: string;
  kind: "chat" | "image" | "both";
  provider: string;
  baseUrl: string;
  modelPrefix?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

function getVaultKey() {
  const secret = process.env.KEY_VAULT_SECRET ?? process.env.JWT_SECRET ?? "";
  if (secret.length < 32) throw new Error("KEY_VAULT_SECRET أو JWT_SECRET يجب أن يكون بطول 32 حرفًا على الأقل.");
  return createHash("sha256").update(secret).digest();
}

export function encryptProviderSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getVaultKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptProviderSecret(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("مفتاح مزود غير صالح.");
  const decipher = createDecipheriv("aes-256-gcm", getVaultKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

export function maskProviderSecret(value: string) {
  return value.length <= 8 ? "••••••••" : `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
