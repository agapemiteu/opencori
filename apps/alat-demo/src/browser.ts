import { demoCatalogResponseSchema, type DemoCatalogResponse } from "@corri/contracts";
import {
  FetchCorriTransport,
  verifySignedPayloadWithWebCrypto,
  type CorriFetch,
  type CorriInitialization,
  type CorriSignatureVerifier,
  type WebCryptoSignatureProvider,
} from "@corri/sdk";

import { encryptRequestWithWebCrypto, type AlatBrowserCryptoProvider } from "./browser-crypto";
import type { AlatDemoDependencies } from "./index";

export interface AlatBrowserRuntimeCrypto
  extends AlatBrowserCryptoProvider,
    WebCryptoSignatureProvider {
  randomUUID(): string;
}

export interface LoadAlatDemoBrowserBootstrapInput {
  apiBaseUrl: string;
  anonymousInstallationId?: string;
  fetch?: CorriFetch;
  crypto?: AlatBrowserRuntimeCrypto;
  now?: () => Date;
  createDeliveryEventId?: () => string;
}

export interface AlatDemoBrowserBootstrap {
  catalog: DemoCatalogResponse;
  dependencies: AlatDemoDependencies;
  initialization: CorriInitialization;
}

export class AlatDemoBootstrapError extends Error {
  constructor(readonly status: number) {
    super("Unable to load the ALAT demo catalog");
    this.name = "AlatDemoBootstrapError";
  }
}

function browserFetch(url: string, init?: Parameters<CorriFetch>[1]) {
  const request: RequestInit = {};
  if (init?.method !== undefined) {
    request.method = init.method;
  }
  if (init?.headers !== undefined) {
    request.headers = init.headers;
  }
  if (init?.body !== undefined) {
    request.body = init.body;
  }
  return globalThis.fetch(url, request);
}

export async function loadAlatDemoBrowserBootstrap(
  input: LoadAlatDemoBrowserBootstrapInput,
): Promise<AlatDemoBrowserBootstrap> {
  const fetcher = input.fetch ?? browserFetch;
  const cryptoProvider = input.crypto ?? globalThis.crypto;
  const apiBaseUrl = input.apiBaseUrl.replace(/\/$/, "");
  const response = await fetcher(apiBaseUrl + "/v1/demo/catalog", {
    method: "GET",
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new AlatDemoBootstrapError(response.status);
  }

  const catalog = demoCatalogResponseSchema.parse(await response.json());
  if (
    catalog.tenant.id !== "wema" ||
    catalog.application.id !== "alat-demo" ||
    catalog.application.tenantId !== catalog.tenant.id ||
    !catalog.tenant.demo ||
    !catalog.application.demo ||
    !catalog.application.active
  ) {
    throw new TypeError("Expected the active Wema ALAT demo catalog");
  }

  const verifySignature: CorriSignatureVerifier = (signed, key) =>
    verifySignedPayloadWithWebCrypto(signed, key, cryptoProvider);

  return {
    catalog,
    dependencies: {
      transport: new FetchCorriTransport(
        apiBaseUrl,
        catalog.application.publicApplicationKey,
        fetcher,
      ),
      verifySignature,
      encryptRequest: (message, publicKeyPem, keyId) =>
        encryptRequestWithWebCrypto(message, publicKeyPem, keyId, cryptoProvider),
      receiverEncryptionKeyId: catalog.application.receiverEncryptionKeyId,
      receiverEncryptionPublicKey: catalog.application.receiverEncryptionPublicKey,
      createDeliveryEventId:
        input.createDeliveryEventId ?? (() => "delivery_" + cryptoProvider.randomUUID()),
      now: input.now ?? (() => new Date()),
    },
    initialization: {
      tenantId: catalog.tenant.id,
      applicationId: catalog.application.id,
      anonymousInstallationId:
        input.anonymousInstallationId ?? "inst_" + cryptoProvider.randomUUID(),
      configurationSigningKeyId: catalog.application.configurationSigningKeyId,
      configurationSigningPublicKey: catalog.application.configurationSigningPublicKey,
    },
  };
}
