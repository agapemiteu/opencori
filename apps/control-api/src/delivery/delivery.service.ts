import { signPayload } from "@corri/config-verifier";
import {
  deliveryReceiptSchema,
  receiverAcknowledgementSchema,
  signedDeliveryAttemptSchema,
  type DeliveryEnvelope,
  type DeliveryReceipt,
} from "@corri/contracts";
import {
  BadGatewayException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  DEMO_CATALOG_REPOSITORY,
  type DemoCatalogRepository,
} from "../demo/demo-catalog.repository.js";
import { CLOCK, type Clock } from "../platform/clock.js";
import {
  VISIT_EVENT_REPOSITORY,
  type VisitEventRepository,
} from "../visits/visit-event.repository.js";
import { DELIVERY_DESTINATION, type DeliveryDestination } from "./delivery-destination.js";
import {
  DELIVERY_REPOSITORY,
  type DeliveryRecord,
  type DeliveryRepository,
} from "./delivery.repository.js";

export const CORRI_DEMO_WEBHOOK_SIGNING_KEY_ID = "corri-demo-webhook-key-01";
export const CORRI_DEMO_WEBHOOK_SIGNING_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIGaqNI+NGDglTm/aZtCJnFLi4hmYy4wdMkPiFoxSauCx
-----END PRIVATE KEY-----
`;

@Injectable()
export class DeliveryService {
  private readonly inFlight = new Map<string, Promise<DeliveryReceipt>>();

  constructor(
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepository,
    @Inject(DELIVERY_DESTINATION) private readonly destination: DeliveryDestination,
    @Inject(VISIT_EVENT_REPOSITORY) private readonly visits: VisitEventRepository,
    @Inject(DEMO_CATALOG_REPOSITORY) private readonly catalog: DemoCatalogRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async deliver(envelope: DeliveryEnvelope): Promise<DeliveryReceipt> {
    const now = this.clock.now();
    if (Date.parse(envelope.expiresAt) <= now.getTime()) {
      throw new GoneException();
    }
    if (
      envelope.routeKey !== "customer-care.general" ||
      this.catalog.getApplication(envelope.tenantId, envelope.applicationId) === undefined ||
      !this.catalog
        .listBranches(envelope.tenantId)
        .some((branch) => branch.id === envelope.branchId) ||
      !this.visits.hasActiveVisit(envelope)
    ) {
      throw new NotFoundException();
    }

    const accepted = this.deliveries.accept(envelope, now.toISOString());
    if (accepted.receipt.state === "DELIVERED") {
      return accepted.receipt;
    }
    if (accepted.encryptedPayload === null) {
      throw new ConflictException();
    }
    const deliveryKey = `${envelope.tenantId}:${envelope.eventId}`;
    const existingDelivery = this.inFlight.get(deliveryKey);
    if (existingDelivery !== undefined) {
      return existingDelivery;
    }
    const delivery = this.deliverAccepted(envelope, accepted, now);
    this.inFlight.set(deliveryKey, delivery);
    try {
      return await delivery;
    } finally {
      if (this.inFlight.get(deliveryKey) === delivery) {
        this.inFlight.delete(deliveryKey);
      }
    }
  }

  private async deliverAccepted(
    envelope: DeliveryEnvelope,
    accepted: DeliveryRecord,
    now: Date,
  ): Promise<DeliveryReceipt> {
    const attempt = signedDeliveryAttemptSchema.parse(
      signPayload(
        {
          destinationId: accepted.receipt.destinationId,
          attemptNumber: 1,
          sentAt: now.toISOString(),
          envelope,
        },
        {
          keyId: CORRI_DEMO_WEBHOOK_SIGNING_KEY_ID,
          privateKeyPem: CORRI_DEMO_WEBHOOK_SIGNING_PRIVATE_KEY,
        },
      ),
    );
    const acknowledgement = receiverAcknowledgementSchema.parse(
      await this.destination.deliver(attempt),
    );
    if (
      acknowledgement.eventId !== envelope.eventId ||
      acknowledgement.destinationId !== accepted.receipt.destinationId ||
      acknowledgement.payloadHash !== envelope.payloadHash
    ) {
      throw new BadGatewayException();
    }
    const latencyMilliseconds = Date.parse(acknowledgement.receivedAt) - now.getTime();
    if (latencyMilliseconds < 0) {
      throw new BadGatewayException();
    }
    return deliveryReceiptSchema.parse(
      this.deliveries.markDelivered(
        envelope.tenantId,
        envelope.eventId,
        acknowledgement,
        latencyMilliseconds,
      ).receipt,
    );
  }

  getReceipt(tenantId: string, eventId: string): DeliveryReceipt {
    const record = this.deliveries.get(tenantId, eventId);
    if (record === undefined) {
      throw new NotFoundException();
    }
    return record.receipt;
  }
}
