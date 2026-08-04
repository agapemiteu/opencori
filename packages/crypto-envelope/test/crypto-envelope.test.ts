import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { decryptRequest, encryptRequest } from "../src/index.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2_048 });
const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

describe("request envelope encryption", () => {
  it("encrypts with AES-256-GCM, wraps the key with RSA-OAEP, and decrypts", () => {
    const encrypted = encryptRequest(
      "I need help with a transfer made today.",
      publicKeyPem,
      "receiver-key-01",
    );

    expect(encrypted.encryptedPayload.ciphertext).not.toContain("transfer");
    expect(encrypted.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(encrypted.payloadSizeBytes).toBeGreaterThan(0);
    expect(decryptRequest(encrypted.encryptedPayload, privateKeyPem, "receiver-key-01")).toBe(
      "I need help with a transfer made today.",
    );
  });

  it("rejects empty or oversized messages and unexpected keys", () => {
    expect(() => encryptRequest("", publicKeyPem, "receiver-key-01")).toThrow(RangeError);
    expect(() => encryptRequest("x".repeat(65_537), publicKeyPem, "receiver-key-01")).toThrow(
      RangeError,
    );
    const encrypted = encryptRequest("Help", publicKeyPem, "receiver-key-01");
    expect(() =>
      decryptRequest(encrypted.encryptedPayload, privateKeyPem, "different-key"),
    ).toThrow("key ID");
  });

  it("rejects ciphertext whose authentication tag was changed", () => {
    const encrypted = encryptRequest("Help", publicKeyPem, "receiver-key-01");
    const tampered = {
      ...encrypted.encryptedPayload,
      authTag: Buffer.alloc(16, 1).toString("base64"),
    };

    expect(() => decryptRequest(tampered, privateKeyPem, "receiver-key-01")).toThrow();
  });
});
