import { generateKeyPairSync } from "node:crypto";

import { signPayload } from "@corri/config-verifier";
import { describe, expect, it } from "vitest";

import { verifySignedPayloadWithWebCrypto } from "../src/index.js";

describe("Web Crypto signature verification", () => {
  it("verifies canonical Ed25519 payloads and rejects tampering or the wrong key", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const signingKey = {
      keyId: "wema-browser-config-key",
      privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    };
    const verificationKey = {
      keyId: signingKey.keyId,
      publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    };
    const signed = signPayload(
      {
        tenantId: "wema",
        applicationId: "alat-demo",
        nested: { enabled: true, sequence: [3, 2, 1] },
      },
      signingKey,
    );

    await expect(verifySignedPayloadWithWebCrypto(signed, verificationKey)).resolves.toBe(true);
    await expect(
      verifySignedPayloadWithWebCrypto(
        { ...signed, payload: { ...signed.payload, tenantId: "another-tenant" } },
        verificationKey,
      ),
    ).resolves.toBe(false);
    await expect(
      verifySignedPayloadWithWebCrypto(signed, {
        ...verificationKey,
        keyId: "another-key",
      }),
    ).resolves.toBe(false);
  });

  it("fails closed for malformed public keys", async () => {
    const { privateKey } = generateKeyPairSync("ed25519");
    const signed = signPayload(
      { tenantId: "wema" },
      {
        keyId: "wema-browser-config-key",
        privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      },
    );

    await expect(
      verifySignedPayloadWithWebCrypto(signed, {
        keyId: signed.keyId,
        publicKeyPem: "not-a-public-key",
      }),
    ).resolves.toBe(false);
  });
});
