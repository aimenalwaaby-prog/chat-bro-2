import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptProviderSecret, encryptProviderSecret } from "../server/_core/user-key-vault";

describe("provider key vault", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("encrypts and decrypts a secret without storing its plaintext", () => {
    vi.stubEnv("KEY_VAULT_SECRET", "test-only-key-vault-secret-longer-than-32-characters");
    const secret = "provider-secret-value-123456";
    const encrypted = encryptProviderSecret(secret);

    expect(encrypted).not.toContain(secret);
    expect(decryptProviderSecret(encrypted)).toBe(secret);
  });

  it("uses a fresh nonce for repeated encryption of the same value", () => {
    vi.stubEnv("KEY_VAULT_SECRET", "test-only-key-vault-secret-longer-than-32-characters");
    const secret = "provider-secret-value-123456";

    expect(encryptProviderSecret(secret)).not.toBe(encryptProviderSecret(secret));
  });

  it("rejects ciphertext whose authentication tag is modified", () => {
    vi.stubEnv("KEY_VAULT_SECRET", "test-only-key-vault-secret-longer-than-32-characters");
    const encrypted = encryptProviderSecret("provider-secret-value-123456");
    const [iv, tag, payload] = encrypted.split(".");
    const changedTag = `${tag!.slice(0, -1)}${tag!.endsWith("A") ? "B" : "A"}`;

    expect(() => decryptProviderSecret(`${iv}.${changedTag}.${payload}`)).toThrow();
  });
});
