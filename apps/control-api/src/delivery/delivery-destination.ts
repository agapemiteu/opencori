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

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

@Injectable()
export class WemaWebhookDestination implements DeliveryDestination {
  constructor(@Inject(EnvironmentService) private readonly environment: EnvironmentService) {}

  /**
   * Retries are safe because the receiver is idempotent: it keys deliveries on
   * tenant, application, and event id, and returns the original acknowledgement
   * for a repeat of the same envelope. A host that suspends idle services can
   * refuse the first call outright while it wakes, so one attempt is not enough.
   */
  async deliver(attempt: SignedDeliveryAttempt): Promise<ReceiverAcknowledgement> {
    const { WEMA_DEMO_WEBHOOK_RETRIES, WEMA_DEMO_WEBHOOK_RETRY_DELAY_MS } = this.environment.values;

    for (let remaining = WEMA_DEMO_WEBHOOK_RETRIES; ; remaining -= 1) {
      try {
        return await this.attempt(attempt);
      } catch (error) {
        if (remaining <= 0) {
          throw error instanceof ServiceUnavailableException
            ? error
            : new ServiceUnavailableException();
        }
      }
      await wait(WEMA_DEMO_WEBHOOK_RETRY_DELAY_MS);
    }
  }

  private async attempt(attempt: SignedDeliveryAttempt): Promise<ReceiverAcknowledgement> {
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
