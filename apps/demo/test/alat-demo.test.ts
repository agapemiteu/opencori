import { generateKeyPairSync } from "node:crypto";

import { signPayload, verifySignedPayload } from "@corri/config-verifier";
import {
  branchSchema,
  deliveryReceiptSchema,
  nearbyBranchesPayloadSchema,
  publicConfigurationSchema,
} from "@corri/contracts";
import { decryptRequest, encryptRequest } from "@corri/crypto-envelope";
import type { CorriTransport, VisitEvent } from "@corri/sdk";
import { describe, expect, it } from "vitest";

import { ALAT_DEMO_INTEGRATION_LABEL, createAlatDemoHost } from "../src/index.js";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const { privateKey: receiverPrivateKey, publicKey: receiverPublicKey } = generateKeyPairSync(
  "rsa",
  { modulusLength: 2_048 },
);
const receiverPrivateKeyPem = receiverPrivateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();
const signingKey = {
  keyId: "wema-test-config-key",
  privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
const configuration = publicConfigurationSchema.parse({
  tenantId: "wema",
  applicationId: "alat-demo",
  version: "test-config-1",
  publishedAt: "2026-08-03T10:00:00.000Z",
  policy: {
    approachRadiusMeters: 250,
    visitRadiusMeters: 100,
    exitRadiusMeters: 150,
    exitGraceSeconds: 30,
    notNowCooldownSeconds: 300,
    notVisitingCooldownSeconds: 86_400,
    maximumVisitDurationSeconds: 14_400,
    minimumAccuracyMeters: 50,
    startPolicy: "CUSTOMER_CONFIRMED",
    endPolicy: "STABLE_GEOFENCE_EXIT",
  },
  notification: {
    locale: "en-NG",
    title: "Wema branch nearby",
    body: "You are near Wema Marina. Are you visiting this branch today?",
    sound: true,
    vibration: true,
    version: "1",
  },
});
const marina = branchSchema.parse({
  id: "wema_marina",
  tenantId: "wema",
  externalBranchId: "WEMA-MARINA-DEMO",
  name: "Wema Marina",
  branchType: "BRANCH",
  addressLine1: "54 Marina",
  addressLine2: null,
  city: "Lagos Island",
  stateOrRegion: "Lagos",
  postalCode: null,
  countryCode: "NG",
  timeZone: "Africa/Lagos",
  latitude: 6.45,
  longitude: 3.395,
  coordinateQuality: "ESTIMATED",
  approachRadiusMeters: 250,
  visitRadiusMeters: 100,
  exitRadiusMeters: 150,
  active: true,
  source: "test-fixture",
  sourceVersion: "1",
  verifiedAt: null,
  metadata: { demoData: true, productionEligible: false },
  createdAt: "2026-08-03T00:00:00.000Z",
  updatedAt: "2026-08-03T00:00:00.000Z",
});

class DemoTransport implements CorriTransport {
  readonly events: VisitEvent[] = [];
  deliveredEnvelope: unknown;
  decryptedMessage: string | null = null;
  deliveryReceipt: unknown;

  async fetchConfiguration() {
    return signPayload(configuration, signingKey);
  }

  async fetchNearbyBranches(input: {
    tenantId: typeof configuration.tenantId;
    applicationId: typeof configuration.applicationId;
    latitude: number;
    longitude: number;
    radiusKm: number;
    limit: number;
  }) {
    return signPayload(
      nearbyBranchesPayloadSchema.parse({
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        configurationVersion: configuration.version,
        generatedAt: "2026-08-03T10:00:00.000Z",
        query: {
          latitude: input.latitude,
          longitude: input.longitude,
          radiusKm: input.radiusKm,
          limit: input.limit,
        },
        branches: [{ branch: marina, distanceMeters: 0 }],
      }),
      signingKey,
    );
  }

  async recordVisitEvent(event: VisitEvent): Promise<void> {
    this.events.push(event);
  }

  async deliverEncryptedRequest(
    envelope: Parameters<CorriTransport["deliverEncryptedRequest"]>[0],
  ) {
    this.deliveredEnvelope = envelope;
    this.decryptedMessage = decryptRequest(
      envelope.encryptedPayload,
      receiverPrivateKeyPem,
      "receiver-test-key",
    );
    this.deliveryReceipt = deliveryReceiptSchema.parse({
      eventId: envelope.eventId,
      tenantId: envelope.tenantId,
      destinationId: "wema_mock_receiver",
      state: "DELIVERED",
      attemptCount: 1,
      acceptedAt: envelope.createdAt,
      deliveredAt: envelope.createdAt,
      receiverReference: "receiver_test_01",
      latencyMilliseconds: 0,
    });
    return this.deliveryReceipt;
  }

  async getDeliveryReceipt(): Promise<unknown> {
    return this.deliveryReceipt;
  }
}

describe("ALAT Demo Corri integration", () => {
  it("runs approach, confirmation, timer, and stable exit through the SDK state machine", async () => {
    const transport = new DemoTransport();
    let now = new Date("2026-08-03T10:00:00.000Z");
    let eventSequence = 0;
    const host = createAlatDemoHost({
      transport,
      verifySignature: verifySignedPayload,
      encryptRequest,
      receiverEncryptionKeyId: "receiver-test-key",
      receiverEncryptionPublicKey: receiverPublicKey
        .export({ type: "spki", format: "pem" })
        .toString(),
      createDeliveryEventId: () => "delivery_host_01",
      now: () => now,
      createId: (kind) => (kind === "visit" ? "visit_01" : `event_${++eventSequence}`),
    });
    const approaches: string[] = [];
    const started: string[] = [];
    const completed: number[] = [];

    expect(host.label).toBe(ALAT_DEMO_INTEGRATION_LABEL);
    await expect(host.sendCustomerRequest("Too early")).rejects.toThrow("active visit");
    await host.initialize({
      tenantId: "wema",
      applicationId: "alat-demo",
      anonymousInstallationId: "inst_demo_01",
      configurationSigningKeyId: signingKey.keyId,
      configurationSigningPublicKey: publicKeyPem,
    });
    await expect(host.sendCustomerRequest("Still too early")).rejects.toThrow("active visit");
    await host.corri.syncNearbyBranches({ latitude: 6.45, longitude: 3.395 });
    host.corri.setConsent({ branchAwareness: true, notifications: true });
    host.corri.startMonitoring();
    host.corri.on("branchApproach", (event) => approaches.push(event.branchName));
    host.corri.on("visitStarted", (event) => started.push(event.visitToken));
    host.corri.on("visitCompleted", (event) => completed.push(event.durationSeconds));

    host.corri.triggerControlledApproach("wema_marina");
    const visit = await host.corri.confirmVisit();
    const customerMessage = "Please help with the transfer I made today.";
    const deliveryReceipt = await host.sendCustomerRequest(customerMessage);
    now = new Date("2026-08-03T10:01:05.000Z");

    expect(approaches).toEqual(["Wema Marina"]);
    expect(started).toEqual(["visit_01"]);
    expect(visit.startSource).toBe("CUSTOMER_CONFIRMED");
    expect(deliveryReceipt).toMatchObject({ eventId: "delivery_host_01", state: "DELIVERED" });
    expect(transport.decryptedMessage).toBe(customerMessage);
    expect(JSON.stringify(transport.deliveredEnvelope)).not.toContain(customerMessage);
    expect(host.corri.getVisitTimer()).toMatchObject({ active: true, elapsedSeconds: 65 });

    host.corri.recordControlledExit();
    now = new Date("2026-08-03T10:01:35.000Z");
    const completion = await host.corri.completeStableExit();

    expect(completion).toMatchObject({
      visitToken: "visit_01",
      durationSeconds: 95,
      endSource: "GEOFENCE_EXIT",
      measurementConfidence: "HIGH",
    });
    expect(completed).toEqual([95]);
    expect(transport.events.map((event) => event.eventType)).toEqual([
      "VISIT_STARTED",
      "VISIT_COMPLETED",
    ]);
    expect(host.corri.getVisitTimer().active).toBe(false);
    expect(host.corri.getDiagnostics()).toMatchObject({
      configurationVerified: true,
      registeredBranchCount: 1,
      state: "COMPLETED",
      pendingVisitEventCount: 0,
    });
  });
});
