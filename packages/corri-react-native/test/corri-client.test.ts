import { generateKeyPairSync } from "node:crypto";

import { signPayload, verifySignedPayload } from "@corri/config-verifier";
import {
  branchSchema,
  deliveryEnvelopeSchema,
  deliveryReceiptSchema,
  nearbyBranchesPayloadSchema,
  publicConfigurationSchema,
  visitStartedEventSchema,
} from "@corri/contracts";
import { encryptRequest } from "@corri/crypto-envelope";
import { describe, expect, it } from "vitest";

import {
  CorriClient,
  CorriTransportError,
  FetchCorriTransport,
  createCorriClient,
  type CorriDiagnosticEvent,
  type CorriFetch,
  type CorriTransport,
  type VisitEvent,
} from "../src/index.js";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const signingKey = {
  keyId: "test-config-key",
  privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};
const verificationKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
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
    title: "Nearby",
    body: "Near {branchName}",
    sound: true,
    vibration: true,
    version: "1",
  },
});
const branch = branchSchema.parse({
  id: "wema_marina",
  tenantId: "wema",
  externalBranchId: "demo",
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
  source: "test",
  sourceVersion: "1",
  verifiedAt: null,
  metadata: { demoData: true },
  createdAt: "2026-08-03T00:00:00.000Z",
  updatedAt: "2026-08-03T00:00:00.000Z",
});

class TestTransport implements CorriTransport {
  readonly recorded: VisitEvent[] = [];
  failRecording = false;
  failDelivery = false;
  deliveryCalls = 0;
  receiptCalls = 0;
  deliveryResponse: unknown;
  configurationResponse: unknown = signPayload(configuration, signingKey);
  nearbyResponse: unknown = signPayload(
    nearbyBranchesPayloadSchema.parse({
      tenantId: "wema",
      applicationId: "alat-demo",
      configurationVersion: configuration.version,
      generatedAt: "2026-08-03T10:00:00.000Z",
      query: { latitude: 6.45, longitude: 3.395, radiusKm: 50, limit: 20 },
      branches: [{ branch, distanceMeters: 0 }],
    }),
    signingKey,
  );

  async fetchConfiguration(): Promise<unknown> {
    return this.configurationResponse;
  }

  async fetchNearbyBranches(): Promise<unknown> {
    return this.nearbyResponse;
  }

  async recordVisitEvent(event: VisitEvent): Promise<void> {
    if (this.failRecording) {
      throw new Error("offline");
    }
    this.recorded.push(event);
  }

  async deliverEncryptedRequest(): Promise<unknown> {
    this.deliveryCalls += 1;
    if (this.failDelivery) {
      throw new Error("destination unavailable");
    }
    return this.deliveryResponse;
  }

  async getDeliveryReceipt(): Promise<unknown> {
    this.receiptCalls += 1;
    return this.deliveryResponse;
  }
}

function initialize(client: CorriClient): void {
  client.initialize({
    tenantId: "wema",
    applicationId: "alat-demo",
    anonymousInstallationId: "inst_test_01",
    configurationSigningKeyId: signingKey.keyId,
    configurationSigningPublicKey: verificationKeyPem,
  });
}

describe("CorriClient", () => {
  it("delivers only opaque active-visit envelopes and caches the returned receipt", async () => {
    const { publicKey: receiverPublicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2_048,
    });
    const transport = new TestTransport();
    let now = new Date("2026-08-03T10:00:00.000Z");
    let eventSequence = 0;
    const client = new CorriClient({
      transport,
      verifySignature: verifySignedPayload,
      now: () => now,
      createId: (kind) => (kind === "visit" ? "visit_delivery_01" : `event_${++eventSequence}`),
    });
    initialize(client);
    await client.syncConfiguration();
    await client.syncNearbyBranches({ latitude: 6.45, longitude: 3.395 });
    client.setConsent({ branchAwareness: true, notifications: true });
    client.startMonitoring();
    client.triggerControlledApproach("wema_marina");
    await client.confirmVisit();
    const encrypted = encryptRequest(
      "Host-owned plaintext",
      receiverPublicKey.export({ type: "spki", format: "pem" }).toString(),
      "receiver-key",
    );
    const envelope = deliveryEnvelopeSchema.parse({
      eventId: "delivery_sdk_01",
      tenantId: "wema",
      applicationId: "alat-demo",
      anonymousInstallationId: "inst_test_01",
      visitToken: "visit_delivery_01",
      branchId: "wema_marina",
      routeKey: "customer-care.general",
      ...encrypted,
      createdAt: now.toISOString(),
      expiresAt: "2026-08-04T10:00:00.000Z",
    });
    transport.deliveryResponse = deliveryReceiptSchema.parse({
      eventId: envelope.eventId,
      tenantId: envelope.tenantId,
      destinationId: "wema_mock_receiver",
      state: "DELIVERED",
      attemptCount: 1,
      acceptedAt: now.toISOString(),
      deliveredAt: now.toISOString(),
      receiverReference: "receiver_sdk_01",
      latencyMilliseconds: 0,
    });
    const deliveryEvents: string[] = [];
    client.on("deliveryAccepted", () => deliveryEvents.push("accepted"));
    client.on("deliveryCompleted", () => deliveryEvents.push("completed"));
    client.on("deliveryFailed", () => deliveryEvents.push("failed"));

    expect(client.getActiveVisit()).toMatchObject({
      branchId: "wema_marina",
      visitToken: "visit_delivery_01",
    });
    const receipt = await client.deliverEncryptedRequest(envelope);
    expect(receipt.state).toBe("DELIVERED");
    expect(await client.getDeliveryReceipt(envelope.eventId)).toEqual(receipt);
    expect(transport.deliveryCalls).toBe(1);
    expect(transport.receiptCalls).toBe(0);
    expect(deliveryEvents).toEqual(["accepted", "completed"]);

    await expect(
      client.deliverEncryptedRequest({ ...envelope, visitToken: "different_visit" }),
    ).rejects.toThrow("active visit scope");
    transport.deliveryResponse = { ...receipt, eventId: "different_delivery" };
    await expect(
      client.deliverEncryptedRequest({ ...envelope, eventId: "delivery_sdk_scope" }),
    ).rejects.toThrow("receipt scope");
    transport.failDelivery = true;
    await expect(
      client.deliverEncryptedRequest({ ...envelope, eventId: "delivery_sdk_02" }),
    ).rejects.toThrow("destination unavailable");
    expect(deliveryEvents).toEqual(["accepted", "completed", "failed", "failed"]);

    const receiptClient = new CorriClient({
      transport,
      verifySignature: verifySignedPayload,
    });
    initialize(receiptClient);
    transport.failDelivery = false;
    transport.deliveryResponse = { ...receipt, tenantId: "different_tenant" };
    await expect(receiptClient.getDeliveryReceipt(envelope.eventId)).rejects.toThrow(
      "receipt scope",
    );
    transport.deliveryResponse = receipt;
    expect(await receiptClient.getDeliveryReceipt(envelope.eventId)).toEqual(receipt);
    expect(transport.receiptCalls).toBe(2);
    now = new Date("2026-08-03T10:01:00.000Z");
    await client.completeVisitManually();
    expect(client.getActiveVisit()).toBeNull();
  });

  it("uses the typed HTTP transport without logging or transforming visit content", async () => {
    const requests: {
      url: string;
      init:
        | {
            method?: "GET" | "POST";
            headers?: Readonly<Record<string, string>>;
            body?: string;
          }
        | undefined;
    }[] = [];
    const fetcher: CorriFetch = async (url, init) => {
      requests.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ accepted: true }) };
    };
    const transport = new FetchCorriTransport("https://corri.example/", "demo-public-key", fetcher);
    const publicClient = createCorriClient({
      apiBaseUrl: "https://corri.example/",
      publicApplicationKey: "demo-public-key",
      fetch: fetcher,
      verifySignature: verifySignedPayload,
      initialization: {
        tenantId: "wema",
        applicationId: "alat-demo",
        anonymousInstallationId: "inst_factory_01",
        configurationSigningKeyId: signingKey.keyId,
        configurationSigningPublicKey: verificationKeyPem,
      },
    });
    expect(publicClient.getDiagnostics().initialized).toBe(true);
    await transport.fetchConfiguration({
      tenantId: configuration.tenantId,
      applicationId: configuration.applicationId,
    });
    await transport.fetchNearbyBranches({
      tenantId: configuration.tenantId,
      applicationId: configuration.applicationId,
      latitude: 6.45,
      longitude: 3.395,
      radiusKm: 50,
      limit: 20,
    });
    const visitEvent = visitStartedEventSchema.parse({
      eventId: "event_http_01",
      tenantId: configuration.tenantId,
      applicationId: configuration.applicationId,
      anonymousInstallationId: "inst_http_01",
      branchId: branch.id,
      visitToken: "visit_http_01",
      occurredAt: "2026-08-03T10:00:00.000Z",
      configurationVersion: configuration.version,
      demo: true,
      eventType: "VISIT_STARTED",
      startedAt: "2026-08-03T10:00:00.000Z",
      startSource: "CUSTOMER_CONFIRMED",
      startAccuracyMeters: null,
      measurementConfidence: "HIGH",
    });
    await transport.recordVisitEvent(visitEvent);
    await transport.deliverEncryptedRequest({
      eventId: "delivery_transport_only",
    } as never);
    await transport.getDeliveryReceipt({
      tenantId: configuration.tenantId,
      eventId: "delivery_transport_only",
    });

    expect(requests.map(({ url }) => url)).toEqual([
      "https://corri.example/v1/sdk/configuration?tenantId=wema&applicationId=alat-demo",
      "https://corri.example/v1/sdk/branches/nearby?tenantId=wema&applicationId=alat-demo&lat=6.45&lng=3.395&radiusKm=50&limit=20",
      "https://corri.example/v1/sdk/visits/events",
      "https://corri.example/v1/sdk/deliveries",
      "https://corri.example/v1/sdk/deliveries/delivery_transport_only?tenantId=wema",
    ]);
    expect(requests[2]?.init?.headers?.["x-corri-public-application-key"]).toBe("demo-public-key");
    expect(JSON.parse(requests[2]?.init?.body ?? "{}")).toEqual(visitEvent);

    const unavailable = new FetchCorriTransport("https://corri.example", "key", async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    }));
    await expect(
      unavailable.fetchConfiguration({
        tenantId: configuration.tenantId,
        applicationId: configuration.applicationId,
      }),
    ).rejects.toEqual(new CorriTransportError(503));
  });

  it("enforces initialization, configuration, consent, and stable-exit preconditions", async () => {
    const transport = new TestTransport();
    let now = new Date("2026-08-03T10:00:00.000Z");
    const client = new CorriClient({
      transport,
      verifySignature: verifySignedPayload,
      now: () => now,
    });

    await expect(client.syncConfiguration()).rejects.toThrow("not initialized");
    initialize(client);
    expect(() => client.startMonitoring()).toThrow("Configuration is not synchronized");
    client.setConsent({ branchAwareness: true, notifications: false });
    await client.syncConfiguration();
    await client.syncNearbyBranches({ latitude: 6.45, longitude: 3.395 });
    expect(client.getRegisteredBranches().map(({ branch: item }) => item.id)).toEqual([
      "wema_marina",
    ]);
    client.startMonitoring();
    await expect(client.confirmVisit()).rejects.toThrow("confirmation was rejected");
    client.triggerControlledApproach("wema_marina");
    await client.confirmVisit();
    expect(client.getVisitTimer()).toMatchObject({ active: true, elapsedSeconds: 0 });
    client.recordControlledExit();
    await expect(client.completeStableExit()).rejects.toThrow("completion was rejected");
    now = new Date("2026-08-03T10:00:30.000Z");
    await client.completeStableExit();
    expect(client.getVisitTimer()).toEqual({
      active: false,
      visitToken: null,
      startedAt: null,
      elapsedSeconds: 0,
    });
    client.setConsent({ branchAwareness: false, notifications: false });
    expect(client.getConsent()).toEqual({ branchAwareness: false, notifications: false });
    expect(client.getDiagnostics()).toMatchObject({ state: "DISABLED", monitoring: false });
  });

  it("supports the host prompt choices through the real state machine", async () => {
    async function pendingClient(): Promise<CorriClient> {
      const client = new CorriClient({
        transport: new TestTransport(),
        verifySignature: verifySignedPayload,
      });
      initialize(client);
      await client.syncConfiguration();
      await client.syncNearbyBranches({ latitude: 6.45, longitude: 3.395 });
      client.setConsent({ branchAwareness: true, notifications: true });
      client.startMonitoring();
      client.triggerControlledApproach("wema_marina");
      return client;
    }

    const ignored = await pendingClient();
    ignored.ignoreApproach();
    expect(ignored.getDiagnostics().state).toBe("COOLDOWN");
    expect(() => ignored.ignoreApproach()).toThrow("pending branch approach");

    const snoozed = await pendingClient();
    snoozed.snoozeBranch();
    expect(snoozed.getDiagnostics().state).toBe("COOLDOWN");

    const declined = await pendingClient();
    declined.declineVisit();
    expect(declined.getDiagnostics().state).toBe("LONG_COOLDOWN");
  });

  it("rejects configuration that does not verify against the pinned key", async () => {
    const transport = new TestTransport();
    const signed = signPayload(configuration, signingKey);
    transport.configurationResponse = { ...signed, signature: "A".repeat(86) };
    const client = new CorriClient({ transport, verifySignature: verifySignedPayload });
    const diagnostics: CorriDiagnosticEvent[] = [];
    let rejected = false;
    client.on("configurationRejected", () => {
      rejected = true;
    });
    client.on("diagnostic", (event) => diagnostics.push(event));
    initialize(client);

    await expect(client.syncConfiguration()).rejects.toThrow("signature rejected");
    expect(rejected).toBe(true);
    expect(diagnostics.map((event) => event.code)).toContain("CONFIGURATION_SIGNATURE_REJECTED");
  });

  it("rejects a signed nearby response with the wrong configuration version", async () => {
    const transport = new TestTransport();
    transport.nearbyResponse = signPayload(
      nearbyBranchesPayloadSchema.parse({
        tenantId: "wema",
        applicationId: "alat-demo",
        configurationVersion: "wrong-version",
        generatedAt: "2026-08-03T10:00:00.000Z",
        query: { latitude: 6.45, longitude: 3.395, radiusKm: 50, limit: 20 },
        branches: [{ branch, distanceMeters: 0 }],
      }),
      signingKey,
    );
    const client = new CorriClient({ transport, verifySignature: verifySignedPayload });
    initialize(client);
    await client.syncConfiguration();

    await expect(client.syncNearbyBranches({ latitude: 6.45, longitude: 3.395 })).rejects.toThrow(
      "Nearby branch signature rejected",
    );
  });

  it("rejects signed nearby responses that do not echo the query or tenant scope", async () => {
    const transport = new TestTransport();
    const client = new CorriClient({ transport, verifySignature: verifySignedPayload });
    initialize(client);
    await client.syncConfiguration();

    transport.nearbyResponse = signPayload(
      nearbyBranchesPayloadSchema.parse({
        tenantId: "wema",
        applicationId: "alat-demo",
        configurationVersion: configuration.version,
        generatedAt: "2026-08-03T10:00:00.000Z",
        query: { latitude: 6.45, longitude: 3.395, radiusKm: 51, limit: 20 },
        branches: [{ branch, distanceMeters: 0 }],
      }),
      signingKey,
    );
    await expect(client.syncNearbyBranches({ latitude: 6.45, longitude: 3.395 })).rejects.toThrow(
      "Nearby branch signature rejected",
    );

    transport.nearbyResponse = signPayload(
      nearbyBranchesPayloadSchema.parse({
        tenantId: "wema",
        applicationId: "alat-demo",
        configurationVersion: configuration.version,
        generatedAt: "2026-08-03T10:00:00.000Z",
        query: { latitude: 6.45, longitude: 3.395, radiusKm: 50, limit: 20 },
        branches: [{ branch: { ...branch, tenantId: "another_tenant" }, distanceMeters: 0 }],
      }),
      signingKey,
    );
    await expect(client.syncNearbyBranches({ latitude: 6.45, longitude: 3.395 })).rejects.toThrow(
      "Nearby branch signature rejected",
    );
  });

  it("does not cache nonterminal delivery receipts", async () => {
    const transport = new TestTransport();
    transport.deliveryResponse = deliveryReceiptSchema.parse({
      eventId: "delivery_pending_01",
      tenantId: "wema",
      destinationId: "wema_mock_receiver",
      state: "QUEUED",
      attemptCount: 0,
      acceptedAt: "2026-08-03T10:00:00.000Z",
      deliveredAt: null,
      receiverReference: null,
      latencyMilliseconds: null,
    });
    const client = new CorriClient({ transport, verifySignature: verifySignedPayload });
    initialize(client);

    await client.getDeliveryReceipt("delivery_pending_01");
    await client.getDeliveryReceipt("delivery_pending_01");

    expect(transport.receiptCalls).toBe(2);
  });

  it("queues offline visit metadata, flushes it, and supports manual exit", async () => {
    const transport = new TestTransport();
    transport.failRecording = true;
    let now = new Date("2026-08-03T10:00:00.000Z");
    let eventId = 0;
    const client = new CorriClient({
      transport,
      verifySignature: verifySignedPayload,
      now: () => now,
      createId: (kind) => (kind === "visit" ? "visit_test_01" : `event_${++eventId}`),
    });
    const diagnosticCodes: string[] = [];
    const throwingListener = () => {
      throw new Error("host callback failure");
    };
    client.on("diagnostic", (event) => diagnosticCodes.push(event.code));
    client.on("visitStarted", throwingListener);
    initialize(client);
    await client.syncConfiguration();
    await client.syncNearbyBranches({ latitude: 6.45, longitude: 3.395 });
    client.setConsent({ branchAwareness: true, notifications: true });
    client.startMonitoring();

    expect(() => client.triggerControlledApproach("unknown_branch")).toThrow(
      "Branch is not registered",
    );
    client.triggerControlledApproach("wema_marina", "MEDIUM");
    await client.confirmVisit();
    expect(client.getDiagnostics().pendingVisitEventCount).toBe(1);
    await expect(client.flushPendingVisitEvents()).rejects.toThrow("offline");

    transport.failRecording = false;
    await client.flushPendingVisitEvents();
    now = new Date("2026-08-03T10:00:45.000Z");
    const completed = await client.completeVisitManually();

    expect(completed).toMatchObject({
      durationSeconds: 45,
      endSource: "MANUAL_EXIT",
      measurementConfidence: "MEDIUM",
    });
    expect(transport.recorded.map((event) => event.eventType)).toEqual([
      "VISIT_STARTED",
      "VISIT_COMPLETED",
    ]);
    expect(diagnosticCodes).toContain("BRANCH_NOT_REGISTERED");
    expect(diagnosticCodes).toContain("VISIT_EVENT_QUEUED");
    client.off("visitStarted", throwingListener);
    client.stopMonitoring();
    expect(() => client.triggerControlledApproach("wema_marina")).toThrow("SDK is not monitoring");
    client.resetDemoState();
    expect(client.getDiagnostics()).toMatchObject({
      initialized: false,
      configurationVerified: false,
      state: "DISABLED",
      registeredBranchCount: 0,
    });
  });
});
