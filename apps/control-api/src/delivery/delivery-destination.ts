import {
  receiverAcknowledgementSchema,
  type ReceiverAcknowledgement,
  type SignedDeliveryAttempt,
} from "@corri/contracts";
import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { EnvironmentService } from "../config/environment.js";

export const DELIVERY_DESTINATION = Symbol("DELIVERY_DESTINATION");

export interface DeliveryDestination {
  deliver(attempt: SignedDeliveryAttempt): Promise<ReceiverAcknowledgement>;
}

@Injectable()
export class WemaWebhookDestination implements DeliveryDestination {
  constructor(@Inject(EnvironmentService) private readonly environment: EnvironmentService) {}

  async deliver(attempt: SignedDeliveryAttempt): Promise<ReceiverAcknowledgement> {
    try {
      const response = await fetch(this.environment.values.WEMA_DEMO_WEBHOOK_URL, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(attempt),
        signal: AbortSignal.timeout(this.environment.values.WEMA_DEMO_WEBHOOK_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new ServiceUnavailableException();
      }
      return receiverAcknowledgementSchema.parse(await response.json());
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException();
    }
  }
}
