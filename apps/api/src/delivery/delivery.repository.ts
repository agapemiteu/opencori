import { createHash } from "node:crypto";

import { canonicalize } from "@corri/config-verifier";
import {
  deliveryReceiptSchema,
  type DeliveryEnvelope,
  type DeliveryReceipt,
  type EncryptedPayload,
  type ReceiverAcknowledgement,
} from "@corri/contracts";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";

export const DELIVERY_REPOSITORY = Symbol("DELIVERY_REPOSITORY");

export interface DeliveryRecord {
  eventId: DeliveryEnvelope["eventId"];
  tenantId: DeliveryEnvelope["tenantId"];
  applicationId: DeliveryEnvelope["applicationId"];
  visitToken: DeliveryEnvelope["visitToken"];
  branchId: DeliveryEnvelope["branchId"];
  routeKey: DeliveryEnvelope["routeKey"];
  payloadHash: string;
  envelopeFingerprint: string;
  payloadSizeBytes: number;
  encryptedPayload: EncryptedPayload | null;
  receipt: DeliveryReceipt;
}

export interface DeliveryRepository {
  accept(envelope: DeliveryEnvelope, acceptedAt: string): DeliveryRecord;
  markDelivered(
    tenantId: string,
    eventId: string,
    acknowledgement: ReceiverAcknowledgement,
    latencyMilliseconds: number,
  ): DeliveryRecord;
  get(tenantId: string, eventId: string): DeliveryRecord | undefined;
  list(tenantId: string, applicationId: string): readonly DeliveryRecord[];
}

@Injectable()
export class InMemoryDeliveryRepository implements DeliveryRepository {
  private readonly records = new Map<string, DeliveryRecord>();

  accept(envelope: DeliveryEnvelope, acceptedAt: string): DeliveryRecord {
    const key = `${envelope.tenantId}:${envelope.eventId}`;
    const envelopeFingerprint = createHash("sha256")
      .update(canonicalize(envelope), "utf8")
      .digest("hex");
    const existing = this.records.get(key);
    if (existing !== undefined) {
      if (existing.envelopeFingerprint !== envelopeFingerprint) {
        throw new ConflictException();
      }
      return existing;
    }
    const record: DeliveryRecord = {
      eventId: envelope.eventId,
      tenantId: envelope.tenantId,
      applicationId: envelope.applicationId,
      visitToken: envelope.visitToken,
      branchId: envelope.branchId,
      routeKey: envelope.routeKey,
      payloadHash: envelope.payloadHash,
      envelopeFingerprint,
      payloadSizeBytes: envelope.payloadSizeBytes,
      encryptedPayload: envelope.encryptedPayload,
      receipt: deliveryReceiptSchema.parse({
        eventId: envelope.eventId,
        tenantId: envelope.tenantId,
        destinationId: "wema_mock_receiver",
        state: "ACCEPTED",
        attemptCount: 0,
        acceptedAt,
        deliveredAt: null,
        receiverReference: null,
        latencyMilliseconds: null,
      }),
    };
    this.records.set(key, record);
    return record;
  }

  markDelivered(
    tenantId: string,
    eventId: string,
    acknowledgement: ReceiverAcknowledgement,
    latencyMilliseconds: number,
  ): DeliveryRecord {
    const key = `${tenantId}:${eventId}`;
    const record = this.records.get(key);
    if (record === undefined) {
      throw new NotFoundException();
    }
    const delivered: DeliveryRecord = {
      ...record,
      encryptedPayload: null,
      receipt: deliveryReceiptSchema.parse({
        ...record.receipt,
        state: "DELIVERED",
        attemptCount: 1,
        deliveredAt: acknowledgement.receivedAt,
        receiverReference: acknowledgement.receiverReference,
        latencyMilliseconds,
      }),
    };
    this.records.set(key, delivered);
    return delivered;
  }

  get(tenantId: string, eventId: string): DeliveryRecord | undefined {
    return this.records.get(`${tenantId}:${eventId}`);
  }

  list(tenantId: string, applicationId: string): readonly DeliveryRecord[] {
    return [...this.records.values()].filter(
      (record) => record.tenantId === tenantId && record.applicationId === applicationId,
    );
  }
}
