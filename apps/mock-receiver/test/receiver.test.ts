import { createPublicKey } from "node:crypto";

import { signPayload } from "@opencori/config-verifier";
import {
  deliveryEnvelopeSchema,
  receiverAcknowledgementSchema,
  signedDeliveryAttemptSchema,
} from "@opencori/contracts";
import { encryptRequest } from "@opencori/crypto-envelope";
import { Test } from "@nestjs/testing";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import {
  ConflictException,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { afterEach, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";
import { createReceiverApplication } from "../src/application.js";
import {
  CORRI_DEMO_WEBHOOK_SIGNING_KEY_ID,
  CORRI_DEMO_WEBHOOK_SIGNING_PUBLIC_KEY,
  WEMA_DEMO_ENCRYPTION_KEY_ID,
  WEMA_DEMO_ENCRYPTION_PRIVATE_KEY,
} from "../src/demo-keys.js";
import {
  RECEIVER_SETTINGS,
  ReceiverService,
  type ReceiverSettings,
} from "../src/receiver.service.js";

const webhookSigningPrivateKey = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIGaqNI+NGDglTm/aZtCJnFLi4hmYy4wdMkPiFoxSauCx
-----END PRIVATE KEY-----
`;
const encryptionPublicKey = createPublicKey(WEMA_DEMO_ENCRYPTION_PRIVATE_KEY)
  .export({ type: "spki", format: "pem" })
  .toString();
const fixedNow = new Date("2026-08-03T10:20:00.244Z");
const settings: ReceiverSettings = {
  expectedTenantId: "wema",
  expectedApplicationId: "alat-demo",
  expectedDestinationId: "wema_mock_receiver",
  webhookSigningKeyId: CORRI_DEMO_WEBHOOK_SIGNING_KEY_ID,
  webhookSigningPublicKey: CORRI_DEMO_WEBHOOK_SIGNING_PUBLIC_KEY,
  encryptionKeyId: WEMA_DEMO_ENCRYPTION_KEY_ID,
  encryptionPrivateKey: WEMA_DEMO_ENCRYPTION_PRIVATE_KEY,
  now: () => fixedNow,
};

function envelope(message = "Please help with my transfer") {
  return deliveryEnvelopeSchema.parse({
    eventId: "delivery_01",
    tenantId: "wema",
    applicationId: "alat-demo",
    anonymousInstallationId: "inst_demo_01",
    visitToken: "visit_01",
    branchId: "wema_marina",
    routeKey: "customer-care.general",
    ...encryptRequest(message, encryptionPublicKey, WEMA_DEMO_ENCRYPTION_KEY_ID),
    createdAt: "2026-08-03T10:20:00.000Z",
    expiresAt: "2026-08-04T10:20:00.000Z",
  });
}

function attempt(message?: string) {
  return signedDeliveryAttemptSchema.parse(
    signPayload(
      {
        destinationId: "wema_mock_receiver",
        attemptNumber: 1,
        sentAt: "2026-08-03T10:20:00.000Z",
        envelope: envelope(message),
      },
      {
        keyId: CORRI_DEMO_WEBHOOK_SIGNING_KEY_ID,
        privateKeyPem: webhookSigningPrivateKey,
      },
    ),
  );
}

describe("mock Wema receiver", () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("verifies the Corri signature, decrypts inside Wema, and returns an idempotent receipt", () => {
    const receiver = new ReceiverService(settings);
    const delivery = attempt();
    const first = receiver.receive(delivery);
    const duplicate = receiver.receive(delivery);

    expect(receiverAcknowledgementSchema.parse(first)).toEqual(duplicate);
    expect(first).toMatchObject({
      eventId: "delivery_01",
      destinationId: "wema_mock_receiver",
      receivedAt: fixedNow.toISOString(),
    });
    expect(receiver.listMessages()).toEqual([
      expect.objectContaining({
        eventId: "delivery_01",
        branchId: "wema_marina",
        message: "Please help with my transfer",
      }),
    ]);
  });

  it("rejects bad signatures, stale attempts, hash tampering, and conflicting replay", () => {
    const receiver = new ReceiverService(settings);
    const valid = attempt();
    expect(() => receiver.receive({ ...valid, signature: "A".repeat(86) })).toThrow();

    const stale = signPayload(
      { ...valid.payload, sentAt: "2026-08-03T10:00:00.000Z" },
      {
        keyId: CORRI_DEMO_WEBHOOK_SIGNING_KEY_ID,
        privateKeyPem: webhookSigningPrivateKey,
      },
    );
    expect(() => receiver.receive(stale)).toThrow();

    const tamperedHash = signPayload(
      {
        ...valid.payload,
        envelope: { ...valid.payload.envelope, payloadHash: "a".repeat(64) },
      },
      {
        keyId: CORRI_DEMO_WEBHOOK_SIGNING_KEY_ID,
        privateKeyPem: webhookSigningPrivateKey,
      },
    );
    expect(() => receiver.receive(tamperedHash)).toThrow();

    receiver.receive(valid);
    expect(() => receiver.receive(attempt("A different request"))).toThrow();

    const changedMetadata = signPayload(
      {
        ...valid.payload,
        envelope: { ...valid.payload.envelope, expiresAt: "2026-08-04T10:21:00.000Z" },
      },
      {
        keyId: CORRI_DEMO_WEBHOOK_SIGNING_KEY_ID,
        privateKeyPem: webhookSigningPrivateKey,
      },
    );
    expect(() => receiver.receive(changedMetadata)).toThrow(ConflictException);
  });

  it("rejects attempts outside the configured scope and malformed ciphertext", () => {
    const receiver = new ReceiverService(settings);
    const valid = attempt();
    const wrongDestination = signPayload(
      { ...valid.payload, destinationId: "another_receiver" },
      {
        keyId: CORRI_DEMO_WEBHOOK_SIGNING_KEY_ID,
        privateKeyPem: webhookSigningPrivateKey,
      },
    );
    expect(() => receiver.receive(wrongDestination)).toThrow(UnauthorizedException);

    const malformedCiphertext = signPayload(
      {
        ...valid.payload,
        envelope: {
          ...valid.payload.envelope,
          encryptedPayload: {
            ...valid.payload.envelope.encryptedPayload,
            authTag: `${"A".repeat(22)}==`,
          },
        },
      },
      {
        keyId: CORRI_DEMO_WEBHOOK_SIGNING_KEY_ID,
        privateKeyPem: webhookSigningPrivateKey,
      },
    );
    expect(() => receiver.receive(malformedCiphertext)).toThrow(UnprocessableEntityException);
  });

  it("exposes delivery and bank-owned message routes", async () => {
    const moduleReference = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RECEIVER_SETTINGS)
      .useValue(settings)
      .compile();
    app = moduleReference.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      logger: false,
    });
    app.setGlobalPrefix("v1");
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const deliveryResponse = await app.inject({
      method: "POST",
      url: "/v1/wema/deliveries",
      payload: attempt(),
    });
    const messagesResponse = await app.inject({ method: "GET", url: "/v1/wema/messages" });

    expect(deliveryResponse.statusCode).toBe(201);
    expect(receiverAcknowledgementSchema.safeParse(deliveryResponse.json()).success).toBe(true);
    expect(messagesResponse.statusCode).toBe(200);
    expect(messagesResponse.json()).toEqual([
      expect.objectContaining({ message: "Please help with my transfer" }),
    ]);
  });

  it("creates the production receiver application graph with receiver-owned keys", async () => {
    const now = new Date();
    const encrypted = encryptRequest(
      "Production graph probe",
      encryptionPublicKey,
      WEMA_DEMO_ENCRYPTION_KEY_ID,
    );
    const liveEnvelope = deliveryEnvelopeSchema.parse({
      eventId: "delivery_live_graph",
      tenantId: "wema",
      applicationId: "alat-demo",
      anonymousInstallationId: "inst_live_graph",
      visitToken: "visit_live_graph",
      branchId: "wema_marina",
      routeKey: "customer-care.general",
      ...encrypted,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 60_000).toISOString(),
    });
    const liveAttempt = signPayload(
      {
        destinationId: "wema_mock_receiver",
        attemptNumber: 1,
        sentAt: now.toISOString(),
        envelope: liveEnvelope,
      },
      {
        keyId: CORRI_DEMO_WEBHOOK_SIGNING_KEY_ID,
        privateKeyPem: webhookSigningPrivateKey,
      },
    );
    app = await createReceiverApplication();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const response = await app.inject({
      method: "POST",
      url: "/v1/wema/deliveries",
      payload: liveAttempt,
    });

    expect(response.statusCode).toBe(201);
    expect(receiverAcknowledgementSchema.parse(response.json()).eventId).toBe(
      "delivery_live_graph",
    );
  });
});
