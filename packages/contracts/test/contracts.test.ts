import { describe, expect, it } from "vitest";

import {
  branchSchema,
  deliveryReceiptSchema,
  fallbackCommandReceiptSchema,
  deliveryEnvelopeSchema,
  geofencePolicySchema,
  normalizedFallbackCommandSchema,
  tenantIdSchema,
  timeZoneSchema,
  utcDateTimeSchema,
  visitAbortedEventSchema,
  visitCompletedEventSchema,
} from "../src/index.js";

const branch = {
  id: "wema_marina",
  tenantId: "wema",
  externalBranchId: "WEMA-001",
  name: "Contract Test Branch",
  branchType: "BRANCH",
  addressLine1: "1 Test Road",
  addressLine2: null,
  city: "Lagos",
  stateOrRegion: "Lagos",
  postalCode: null,
  countryCode: "NG",
  timeZone: "Africa/Lagos",
  latitude: 6.5,
  longitude: 3.4,
  coordinateQuality: "ESTIMATED",
  approachRadiusMeters: 250,
  visitRadiusMeters: 100,
  exitRadiusMeters: 150,
  active: true,
  source: "contract-test-fixture",
  sourceVersion: "1",
  verifiedAt: "2026-08-03T10:00:00.000Z",
  metadata: {},
  createdAt: "2026-08-03T10:00:00.000Z",
  updatedAt: "2026-08-03T10:00:00.000Z",
} as const;

describe("identifier contracts", () => {
  it("accepts stable identifiers and rejects whitespace", () => {
    expect(tenantIdSchema.parse("wema")).toBe("wema");
    expect(tenantIdSchema.safeParse("wema bank").success).toBe(false);
  });

  it("requires a real IANA time zone", () => {
    expect(timeZoneSchema.parse("Africa/Lagos")).toBe("Africa/Lagos");
    expect(timeZoneSchema.safeParse("Lagos").success).toBe(false);
  });

  it("requires UTC rather than a non-UTC offset", () => {
    expect(utcDateTimeSchema.parse("2026-08-03T10:00:00.000Z")).toBe("2026-08-03T10:00:00.000Z");
    expect(utcDateTimeSchema.safeParse("2026-08-03T11:00:00.000+01:00").success).toBe(false);
  });
});

describe("branch contract", () => {
  it("accepts a verified branch with complete coordinates", () => {
    expect(branchSchema.parse(branch).id).toBe("wema_marina");
  });

  it("rejects partial coordinates", () => {
    expect(branchSchema.safeParse({ ...branch, longitude: null }).success).toBe(false);
  });

  it("rejects coordinates marked as missing", () => {
    expect(branchSchema.safeParse({ ...branch, coordinateQuality: "MISSING" }).success).toBe(false);
  });

  it("requires coordinates when quality is not missing", () => {
    expect(
      branchSchema.safeParse({
        ...branch,
        latitude: null,
        longitude: null,
        coordinateQuality: "ESTIMATED",
      }).success,
    ).toBe(false);
  });

  it("rejects an exit radius inside the visit radius", () => {
    expect(branchSchema.safeParse({ ...branch, exitRadiusMeters: 50 }).success).toBe(false);
  });

  it("rejects an approach radius inside the exit radius", () => {
    expect(branchSchema.safeParse({ ...branch, approachRadiusMeters: 149 }).success).toBe(false);
  });

  it("rejects unknown fields and nested metadata", () => {
    expect(branchSchema.safeParse({ ...branch, customerName: "Do not accept" }).success).toBe(
      false,
    );
    expect(
      branchSchema.safeParse({ ...branch, metadata: { nested: { value: true } } }).success,
    ).toBe(false);
  });
});

describe("geofence policy contract", () => {
  const policy = {
    approachRadiusMeters: 250,
    visitRadiusMeters: 100,
    exitRadiusMeters: 150,
    exitGraceSeconds: 30,
    notNowCooldownSeconds: 300,
    notVisitingCooldownSeconds: 86_400,
    maximumVisitDurationSeconds: 3_600,
    minimumAccuracyMeters: 50,
    startPolicy: "CUSTOMER_CONFIRMED",
    endPolicy: "STABLE_GEOFENCE_EXIT",
  } as const;

  it("enforces ordered radii", () => {
    expect(geofencePolicySchema.parse(policy)).toEqual(policy);
    expect(geofencePolicySchema.safeParse({ ...policy, exitRadiusMeters: 99 }).success).toBe(false);
    expect(geofencePolicySchema.safeParse({ ...policy, approachRadiusMeters: 149 }).success).toBe(
      false,
    );
  });
});

describe("delivery envelope contract", () => {
  const envelope = {
    eventId: "evt_01",
    tenantId: "wema",
    applicationId: "alat-demo",
    anonymousInstallationId: "inst_demo_01",
    visitToken: "visit_01",
    branchId: "wema_marina",
    routeKey: "customer-care.general",
    encryptedPayload: {
      algorithm: "AES-256-GCM",
      ciphertext: "YQ==",
      iv: "AAAAAAAAAAAAAAAA",
      authTag: "AAAAAAAAAAAAAAAAAAAAAA==",
      encryptedDataKey: "YQ==",
      keyId: "wema-demo-key-01",
    },
    payloadHash: "a".repeat(64),
    payloadSizeBytes: 1,
    createdAt: "2026-08-03T10:20:00.000Z",
    expiresAt: "2026-08-04T10:20:00.000Z",
  } as const;

  it("accepts opaque ciphertext with bounded metadata", () => {
    expect(deliveryEnvelopeSchema.parse(envelope).eventId).toBe("evt_01");
  });

  it("rejects envelopes that do not expire after creation", () => {
    expect(
      deliveryEnvelopeSchema.safeParse({
        ...envelope,
        expiresAt: envelope.createdAt,
      }).success,
    ).toBe(false);
  });

  it("rejects invalid GCM field lengths and inconsistent ciphertext size", () => {
    expect(
      deliveryEnvelopeSchema.safeParse({
        ...envelope,
        encryptedPayload: { ...envelope.encryptedPayload, iv: "YQ==" },
      }).success,
    ).toBe(false);
    expect(deliveryEnvelopeSchema.safeParse({ ...envelope, payloadSizeBytes: 2 }).success).toBe(
      false,
    );
  });

  it("requires delivered receipt fields only for delivered state", () => {
    const receipt = {
      eventId: "evt_01",
      tenantId: "wema",
      destinationId: "wema_receiver",
      state: "DELIVERED",
      attemptCount: 1,
      acceptedAt: "2026-08-03T10:20:00.000Z",
      deliveredAt: "2026-08-03T10:20:01.000Z",
      receiverReference: "receiver_01",
      latencyMilliseconds: 1_000,
    } as const;

    expect(deliveryReceiptSchema.parse(receipt)).toEqual(receipt);
    expect(deliveryReceiptSchema.safeParse({ ...receipt, deliveredAt: null }).success).toBe(false);
    expect(deliveryReceiptSchema.safeParse({ ...receipt, latencyMilliseconds: null }).success).toBe(
      false,
    );
  });
});

describe("visit event contract", () => {
  const completed = {
    eventId: "evt_visit_01",
    tenantId: "wema",
    applicationId: "alat-demo",
    anonymousInstallationId: "inst_demo_01",
    branchId: "wema_marina",
    visitToken: "visit_01",
    occurredAt: "2026-08-03T10:51:17.000Z",
    configurationVersion: "1",
    demo: true,
    eventType: "VISIT_COMPLETED",
    startedAt: "2026-08-03T10:14:32.000Z",
    endedAt: "2026-08-03T10:51:17.000Z",
    durationSeconds: 2_205,
    startSource: "CUSTOMER_CONFIRMED",
    endSource: "GEOFENCE_EXIT",
    endAccuracyMeters: 12,
    measurementConfidence: "HIGH",
  } as const;

  it("requires timestamps and duration to agree", () => {
    expect(visitCompletedEventSchema.parse(completed)).toEqual(completed);
    expect(
      visitCompletedEventSchema.safeParse({ ...completed, durationSeconds: 2_204 }).success,
    ).toBe(false);
    expect(
      visitCompletedEventSchema.safeParse({
        ...completed,
        endedAt: "2026-08-03T10:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      visitCompletedEventSchema.safeParse({
        ...completed,
        occurredAt: "2026-08-03T10:51:16.000Z",
      }).success,
    ).toBe(false);
  });

  it("represents consent revocation as an explicit terminal event", () => {
    expect(
      visitAbortedEventSchema.parse({
        eventId: completed.eventId,
        tenantId: completed.tenantId,
        applicationId: completed.applicationId,
        anonymousInstallationId: completed.anonymousInstallationId,
        branchId: completed.branchId,
        visitToken: completed.visitToken,
        occurredAt: completed.occurredAt,
        configurationVersion: completed.configurationVersion,
        demo: completed.demo,
        eventType: "VISIT_ABORTED",
        startedAt: completed.startedAt,
        endedAt: completed.endedAt,
        durationSeconds: completed.durationSeconds,
        startSource: completed.startSource,
        endSource: "CONSENT_REVOKED",
        measurementConfidence: completed.measurementConfidence,
      }),
    ).toMatchObject({
      eventType: "VISIT_ABORTED",
      endSource: "CONSENT_REVOKED",
    });
  });
});

describe("SMS fallback contract", () => {
  const command = {
    commandId: "fallback_01",
    tenantId: "wema",
    applicationId: "alat-demo",
    correlationId: "correlation_01",
    channel: "SMS",
    reason: "NO_DATA_CONNECTION",
    command: "CONFIRM_VISIT",
    occurredAt: "2026-08-03T10:14:32.000Z",
    expiresAt: "2026-08-03T10:19:32.000Z",
  } as const;

  it("accepts only normalized, expiring commands", () => {
    expect(normalizedFallbackCommandSchema.parse(command)).toEqual(command);
    expect(
      normalizedFallbackCommandSchema.safeParse({ ...command, expiresAt: command.occurredAt })
        .success,
    ).toBe(false);
  });

  it("rejects phone identity and raw SMS content", () => {
    expect(
      normalizedFallbackCommandSchema.safeParse({
        ...command,
        phoneNumber: "+2348000000000",
      }).success,
    ).toBe(false);
    expect(
      normalizedFallbackCommandSchema.safeParse({
        ...command,
        rawMessage: "My account request",
      }).success,
    ).toBe(false);
  });

  it("requires receipt processing at or after receipt time", () => {
    const receipt = {
      commandId: command.commandId,
      tenantId: command.tenantId,
      correlationId: command.correlationId,
      status: "ACCEPTED",
      receivedAt: "2026-08-03T10:20:00.000Z",
      processedAt: "2026-08-03T10:20:01.000Z",
    } as const;

    expect(fallbackCommandReceiptSchema.parse(receipt)).toEqual(receipt);
    expect(
      fallbackCommandReceiptSchema.safeParse({
        ...receipt,
        processedAt: "2026-08-03T10:19:59.000Z",
      }).success,
    ).toBe(false);
  });
});
