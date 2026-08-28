import { createHash } from "node:crypto";

import { canonicalize, verifySignedPayload } from "@corri/config-verifier";
import {
  receiverAcknowledgementSchema,
  signedDeliveryAttemptSchema,
  type ReceiverAcknowledgement,
  type SignedDeliveryAttempt,
} from "@corri/contracts";
import { decryptRequest, hashEncryptedPayload } from "@corri/crypto-envelope";
import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";

export const RECEIVER_SETTINGS = Symbol("RECEIVER_SETTINGS");

export interface ReceiverSettings {
  expectedTenantId: string;
  expectedApplicationId: string;
  expectedDestinationId: string;
  webhookSigningKeyId: string;
  webhookSigningPublicKey: string;
  encryptionKeyId: string;
  encryptionPrivateKey: string;
  now(): Date;
}

export interface ReceivedWemaMessage {
  eventId: string;
  branchId: string;
  visitToken: string;
  message: string;
  receivedAt: string;
  receiverReference: string;
}

@Injectable()
export class ReceiverService {
  private readonly deliveries = new Map<
    string,
    { acknowledgement: ReceiverAcknowledgement; envelopeFingerprint: string }
  >();
  private readonly messages = new Map<string, ReceivedWemaMessage>();

  constructor(@Inject(RECEIVER_SETTINGS) private readonly settings: ReceiverSettings) {}

  receive(input: unknown): ReceiverAcknowledgement {
    const attempt: SignedDeliveryAttempt = signedDeliveryAttemptSchema.parse(input);
    if (
      !verifySignedPayload(attempt, {
        keyId: this.settings.webhookSigningKeyId,
        publicKeyPem: this.settings.webhookSigningPublicKey,
      })
    ) {
      throw new UnauthorizedException();
    }

    const now = this.settings.now();
    const sentAt = Date.parse(attempt.payload.sentAt);
    if (
      Math.abs(now.getTime() - sentAt) > 300_000 ||
      Date.parse(attempt.payload.envelope.expiresAt) <= now.getTime()
    ) {
      throw new UnauthorizedException();
    }
    const envelope = attempt.payload.envelope;
    if (
      envelope.tenantId !== this.settings.expectedTenantId ||
      envelope.applicationId !== this.settings.expectedApplicationId ||
      attempt.payload.destinationId !== this.settings.expectedDestinationId
    ) {
      throw new UnauthorizedException();
    }
    const deliveryKey = `${envelope.tenantId}:${envelope.applicationId}:${envelope.eventId}`;
    const envelopeFingerprint = createHash("sha256")
      .update(
        canonicalize({
          destinationId: attempt.payload.destinationId,
          envelope,
        }),
        "utf8",
      )
      .digest("hex");
    const existing = this.deliveries.get(deliveryKey);
    if (existing !== undefined) {
      if (existing.envelopeFingerprint !== envelopeFingerprint) {
        throw new ConflictException();
      }
      return existing.acknowledgement;
    }
    if (hashEncryptedPayload(envelope.encryptedPayload) !== envelope.payloadHash) {
      throw new UnprocessableEntityException();
    }

    let message: string;
    try {
      message = decryptRequest(
        envelope.encryptedPayload,
        this.settings.encryptionPrivateKey,
        this.settings.encryptionKeyId,
      );
    } catch {
      throw new UnprocessableEntityException();
    }
    const receiverReference = `wema_receiver_${envelope.eventId}`;
    const acknowledgement = receiverAcknowledgementSchema.parse({
      eventId: envelope.eventId,
      destinationId: attempt.payload.destinationId,
      receiverReference,
      receivedAt: now.toISOString(),
      payloadHash: envelope.payloadHash,
    });
    this.deliveries.set(deliveryKey, { acknowledgement, envelopeFingerprint });
    this.messages.set(deliveryKey, {
      eventId: envelope.eventId,
      branchId: envelope.branchId,
      visitToken: envelope.visitToken,
      message,
      receivedAt: acknowledgement.receivedAt,
      receiverReference,
    });
    return acknowledgement;
  }

  listMessages(): readonly ReceivedWemaMessage[] {
    return [...this.messages.values()];
  }
}
