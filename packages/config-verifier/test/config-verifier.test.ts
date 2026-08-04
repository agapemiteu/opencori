import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { canonicalize, signPayload, verifySignedPayload } from "../src/index.js";

function keys() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    signing: {
      keyId: "test-key-01",
      privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    },
    verification: {
      keyId: "test-key-01",
      publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    },
  };
}

describe("configuration signatures", () => {
  it("canonicalizes object keys while preserving array order", () => {
    expect(canonicalize({ z: [2, 1], a: { d: true, c: null } })).toBe(
      '{"a":{"c":null,"d":true},"z":[2,1]}',
    );
    expect(canonicalize({ ä: 1, z: 2, A: 3 })).toBe('{"A":3,"z":2,"ä":1}');
  });

  it("signs and verifies a payload", () => {
    const keyPair = keys();
    const signed = signPayload({ tenantId: "wema", version: "1" }, keyPair.signing);

    expect(signed.signature).toMatch(/^[A-Za-z0-9_-]{86}$/);
    expect(verifySignedPayload(signed, keyPair.verification)).toBe(true);
  });

  it("rejects a modified payload, mismatched key, and malformed signature", () => {
    const keyPair = keys();
    const signed = signPayload({ version: "1" }, keyPair.signing);

    expect(
      verifySignedPayload({ ...signed, payload: { version: "2" } }, keyPair.verification),
    ).toBe(false);
    expect(verifySignedPayload(signed, { ...keyPair.verification, keyId: "different-key" })).toBe(
      false,
    );
    expect(verifySignedPayload({ ...signed, signature: "invalid" }, keyPair.verification)).toBe(
      false,
    );
  });

  it("rejects values outside canonical JSON", () => {
    expect(() => canonicalize({ value: Number.NaN })).toThrow("non-finite");
    expect(() => canonicalize({ value: undefined })).toThrow("undefined");
    expect(() => canonicalize(new Date("2026-08-03T00:00:00.000Z"))).toThrow("plain objects");
    expect(() => canonicalize(Symbol("not-json"))).toThrow("symbol");
  });
});
