import { deliveryEnvelopeSchema, type EncryptedPayload } from "@corri/contracts";
import {
  CorriClient,
  type CorriDependencies,
  type CorriInitialization,
  type DeliveryReceipt,
} from "@corri/sdk";

export { encryptRequestWithWebCrypto, type AlatBrowserCryptoProvider } from "./browser-crypto.js";
export {
  AlatDemoBootstrapError,
  loadAlatDemoBrowserBootstrap,
  type AlatBrowserRuntimeCrypto,
  type AlatDemoBrowserBootstrap,
  type LoadAlatDemoBrowserBootstrapInput,
} from "./browser.js";

export const ALAT_DEMO_INTEGRATION_LABEL = "ALAT demonstration with Corri SDK integrated";

export interface AlatDemoHost {
  label: typeof ALAT_DEMO_INTEGRATION_LABEL;
  corri: CorriClient;
  initialize(input: CorriInitialization): Promise<void>;
  sendCustomerRequest(message: string): Promise<DeliveryReceipt>;
}

export interface AlatEncryptedRequest {
  encryptedPayload: EncryptedPayload;
  payloadHash: string;
  payloadSizeBytes: number;
}

export type AlatRequestEncryptor = (
  message: string,
  receiverPublicKeyPem: string,
  keyId: string,
) => AlatEncryptedRequest | Promise<AlatEncryptedRequest>;

export interface AlatDemoDependencies extends CorriDependencies {
  encryptRequest: AlatRequestEncryptor;
  receiverEncryptionKeyId: string;
  receiverEncryptionPublicKey: string;
  now: () => Date;
  createDeliveryEventId: () => string;
}

export function createAlatDemoHost(dependencies: AlatDemoDependencies): AlatDemoHost {
  const corri = new CorriClient(dependencies);
  let initialization: CorriInitialization | null = null;
  return {
    label: ALAT_DEMO_INTEGRATION_LABEL,
    corri,
    async initialize(input: CorriInitialization): Promise<void> {
      initialization = input;
      corri.initialize(input);
      await corri.syncConfiguration();
    },
    async sendCustomerRequest(message: string): Promise<DeliveryReceipt> {
      const activeVisit = corri.getActiveVisit();
      if (initialization === null || activeVisit === null) {
        throw new Error("A confirmed active visit is required before sending a request");
      }
      const createdAt = dependencies.now();
      const encrypted = await dependencies.encryptRequest(
        message,
        dependencies.receiverEncryptionPublicKey,
        dependencies.receiverEncryptionKeyId,
      );
      return corri.deliverEncryptedRequest(
        deliveryEnvelopeSchema.parse({
          eventId: dependencies.createDeliveryEventId(),
          tenantId: initialization.tenantId,
          applicationId: initialization.applicationId,
          anonymousInstallationId: initialization.anonymousInstallationId,
          visitToken: activeVisit.visitToken,
          branchId: activeVisit.branchId,
          routeKey: "customer-care.general",
          ...encrypted,
          createdAt: createdAt.toISOString(),
          expiresAt: new Date(createdAt.getTime() + 86_400_000).toISOString(),
        }),
      );
    },
  };
}
