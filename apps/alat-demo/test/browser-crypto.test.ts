import { generateKeyPairSync } from "node:crypto";

import { decryptRequest } from "@corri/crypto-envelope";
import { describe, expect, it } from "vitest";

import { encryptRequestWithWebCrypto } from "../src/index.js";

describe("ALAT browser encryption", () => {
  it("encrypts in the host with Web Crypto and remains compatible with the Wema receiver", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2_048 });
    const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const customerMessage = "Please help with the transfer I made today.";

    const encrypted = await encryptRequestWithWebCrypto(
      customerMessage,
      publicKeyPem,
      "receiver-browser-test-key",
    );

    expect(
      decryptRequest(encrypted.encryptedPayload, privateKeyPem, "receiver-browser-test-key"),
    ).toBe(customerMessage);
    expect(encrypted.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(encrypted.payloadSizeBytes).toBeGreaterThan(0);
    expect(JSON.stringify(encrypted)).not.toContain(customerMessage);
  });

  it("rejects empty and oversized messages before encryption", async () => {
    const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2_048 });
    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

    await expect(
      encryptRequestWithWebCrypto("", publicKeyPem, "receiver-browser-test-key"),
    ).rejects.toThrow(RangeError);
    await expect(
      encryptRequestWithWebCrypto("x".repeat(65_537), publicKeyPem, "receiver-browser-test-key"),
    ).rejects.toThrow(RangeError);
  });
});
