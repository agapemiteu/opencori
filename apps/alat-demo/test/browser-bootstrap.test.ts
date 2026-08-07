import { generateKeyPairSync } from "node:crypto";

import { signPayload } from "@corri/config-verifier";
import { demoCatalogResponseSchema } from "@corri/contracts";
import type { CorriFetch } from "@corri/sdk";
import { describe, expect, it } from "vitest";

import { AlatDemoBootstrapError, loadAlatDemoBrowserBootstrap } from "../src/index.js";

const now = "2026-08-03T10:00:00.000Z";

describe("ALAT browser bootstrap", () => {
  it("loads public demo keys and prepares verified SDK dependencies", async () => {
    const signingPair = generateKeyPairSync("ed25519");
    const receiverPair = generateKeyPairSync("rsa", { modulusLength: 2_048 });
    const signingKey = {
      keyId: "wema-browser-config-key",
      privateKeyPem: signingPair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    };
    const catalog = demoCatalogResponseSchema.parse({
      tenant: {
        id: "wema",
        name: "Wema Bank",
        demo: true,
        createdAt: now,
        updatedAt: now,
      },
      application: {
        id: "alat-demo",
        tenantId: "wema",
        name: "ALAT Demo",
        publicApplicationKey: "corri_demo_public_application_key_not_for_production",
        configurationSigningKeyId: signingKey.keyId,
        configurationSigningPublicKey: signingPair.publicKey
          .export({ type: "spki", format: "pem" })
          .toString(),
        receiverEncryptionKeyId: "wema-browser-receiver-key",
        receiverEncryptionPublicKey: receiverPair.publicKey
          .export({ type: "spki", format: "pem" })
          .toString(),
        active: true,
        demo: true,
        createdAt: now,
        updatedAt: now,
      },
      branchCount: 10,
      sourceSummary: "Test fixture containing public demo integration values.",
    });
    const requests: string[] = [];
    const fetcher: CorriFetch = async (url) => {
      requests.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => catalog,
      };
    };

    const bootstrap = await loadAlatDemoBrowserBootstrap({
      apiBaseUrl: "http://localhost:3000/",
      anonymousInstallationId: "inst_browser_01",
      fetch: fetcher,
      createDeliveryEventId: () => "delivery_browser_01",
      now: () => new Date(now),
    });
    const signed = signPayload({ tenantId: "wema", version: 1 }, signingKey);

    expect(requests).toEqual(["http://localhost:3000/v1/demo/catalog"]);
    expect(bootstrap.initialization).toMatchObject({
      tenantId: "wema",
      applicationId: "alat-demo",
      configurationSigningKeyId: signingKey.keyId,
    });
    expect(bootstrap.initialization.anonymousInstallationId).toBe("inst_browser_01");
    expect(bootstrap.dependencies.receiverEncryptionKeyId).toBe("wema-browser-receiver-key");
    await expect(
      bootstrap.dependencies.verifySignature(signed, {
        keyId: catalog.application.configurationSigningKeyId,
        publicKeyPem: catalog.application.configurationSigningPublicKey,
      }),
    ).resolves.toBe(true);
  });

  it("returns a stable bootstrap error when the catalog is unavailable", async () => {
    const unavailable: CorriFetch = async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    await expect(
      loadAlatDemoBrowserBootstrap({
        apiBaseUrl: "http://localhost:3000",
        fetch: unavailable,
      }),
    ).rejects.toEqual(new AlatDemoBootstrapError(503));
  });
});
