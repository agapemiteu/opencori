import { ServiceUnavailableException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseEnvironment } from "../src/config/environment.js";
import { WemaWebhookDestination } from "../src/delivery/delivery-destination.js";

const attempt = {
  keyId: "corri-demo-webhook-key-01",
  signature: "c2ln",
  payload: { destinationId: "wema_mock_receiver", attemptNumber: 1 },
} as never;

const acknowledgement = {
  eventId: "delivery_01",
  destinationId: "wema_mock_receiver",
  payloadHash: "a".repeat(64),
  receiverReference: "wema_receiver_delivery_01",
  receivedAt: "2026-08-20T12:00:00.000Z",
};

function destinationWith(source: NodeJS.ProcessEnv): WemaWebhookDestination {
  return new WemaWebhookDestination({ values: parseEnvironment(source) });
}

function jsonResponse(): Response {
  return new Response(JSON.stringify(acknowledgement), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WemaWebhookDestination", () => {
  it("makes a single attempt by default", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(destinationWith({}).deliver(attempt)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("recovers when a suspended receiver refuses the first calls then wakes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(jsonResponse());
    vi.stubGlobal("fetch", fetchMock);

    const destination = destinationWith({
      WEMA_DEMO_WEBHOOK_RETRIES: "4",
      WEMA_DEMO_WEBHOOK_RETRY_DELAY_MS: "100",
    });

    await expect(destination.deliver(attempt)).resolves.toMatchObject({
      receiverReference: "wema_receiver_delivery_01",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up once the retries are exhausted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const destination = destinationWith({
      WEMA_DEMO_WEBHOOK_RETRIES: "2",
      WEMA_DEMO_WEBHOOK_RETRY_DELAY_MS: "100",
    });

    await expect(destination.deliver(attempt)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
