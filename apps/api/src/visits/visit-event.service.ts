import {
  demoAnalyticsResponseSchema,
  privacyProofResponseSchema,
  visitEventIngestionReceiptSchema,
  type DemoAnalyticsResponse,
  type PrivacyProofResponse,
  type VisitEvent,
  type VisitEventIngestionReceipt,
} from "@opencori/contracts";
import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { CATALOG_REPOSITORY, type CatalogReader } from "../catalog/catalog.repository.js";
import { DEMO_CONFIGURATION_VERSION } from "../catalog/seed.js";
import { DELIVERY_REPOSITORY, type DeliveryRepository } from "../delivery/delivery.repository.js";
import { VISIT_EVENT_REPOSITORY, type VisitEventRepository } from "./visit-event.repository.js";

function percentile(sorted: readonly number[], fraction: number): number | null {
  if (sorted.length === 0) {
    return null;
  }
  const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index] ?? null;
}

function median(sorted: readonly number[]): number | null {
  if (sorted.length === 0) {
    return null;
  }
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? null;
  }
  const left = sorted[middle - 1];
  const right = sorted[middle];
  return left === undefined || right === undefined ? null : Math.round((left + right) / 2);
}

@Injectable()
export class VisitEventService {
  constructor(
    @Inject(VISIT_EVENT_REPOSITORY) private readonly events: VisitEventRepository,
    @Inject(CATALOG_REPOSITORY)
    private readonly catalog: CatalogReader,
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepository,
  ) {}

  async record(event: VisitEvent): Promise<VisitEventIngestionReceipt> {
    const application = await this.catalog.getApplication(event.tenantId, event.applicationId);
    const branch = (await this.catalog.listBranches(event.tenantId)).find(
      (candidate) => candidate.id === event.branchId,
    );
    if (
      application === undefined ||
      branch === undefined ||
      event.configurationVersion !== DEMO_CONFIGURATION_VERSION ||
      !event.demo
    ) {
      throw new NotFoundException();
    }
    // A branch the tenant has switched off accepts no new visits. Terminal
    // events still go through, otherwise a visit that was already open when the
    // branch was switched off could never be closed and would stay active for
    // ever in the visit repository and the analytics.
    if (!branch.active && event.eventType === "VISIT_STARTED") {
      throw new ForbiddenException();
    }
    return visitEventIngestionReceiptSchema.parse({
      eventId: event.eventId,
      tenantId: event.tenantId,
      visitToken: event.visitToken,
      status: this.events.append(event),
    });
  }

  analytics(): DemoAnalyticsResponse {
    const events = this.events.list("wema", "alat-demo");
    const started = events.filter((event) => event.eventType === "VISIT_STARTED");
    const completed = events.filter((event) => event.eventType === "VISIT_COMPLETED");
    const durations = completed.map((event) => event.durationSeconds).sort((a, b) => a - b);
    const terminalVisitTokens = new Set(
      events
        .filter((event) => event.eventType !== "VISIT_STARTED")
        .map((event) => event.visitToken),
    );
    const deliveries = this.deliveries.list("wema", "alat-demo");
    const latencies = deliveries
      .flatMap((delivery) =>
        delivery.receipt.latencyMilliseconds === null ? [] : [delivery.receipt.latencyMilliseconds],
      )
      .sort((a, b) => a - b);
    return demoAnalyticsResponseSchema.parse({
      tenantId: "wema",
      applicationId: "alat-demo",
      demo: true,
      confirmedVisits: started.length,
      activeVisits: started.filter((event) => !terminalVisitTokens.has(event.visitToken)).length,
      completedVisits: completed.length,
      medianBranchPresenceDurationSeconds: median(durations),
      p90BranchPresenceDurationSeconds: percentile(durations, 0.9),
      deliveredRequests: deliveries.filter((delivery) => delivery.receipt.state === "DELIVERED")
        .length,
      medianDeliveryLatencyMilliseconds: median(latencies),
    });
  }

  privacyProof(): PrivacyProofResponse {
    const events = this.events.list("wema", "alat-demo");
    const deliveries = this.deliveries.list("wema", "alat-demo");
    return privacyProofResponseSchema.parse({
      tenantId: "wema",
      applicationId: "alat-demo",
      demo: true,
      readableRequestContentStored: false,
      bankingDataStored: false,
      inspectedVisitEventCount: events.length,
      inspectedDeliveryCount: deliveries.length,
      retainedEncryptedPayloadCount: deliveries.filter(
        (delivery) => delivery.encryptedPayload !== null,
      ).length,
      storedFieldCategories: [
        "anonymous installation and application identifiers",
        "branch and visit identifiers",
        "visit timestamps, duration, source, and confidence",
        "configuration version and demo marker",
      ],
      prohibitedFieldCategories: [
        "customer identity and banking identifiers",
        "account, balance, transaction, or credential data",
        "plain-text request or complaint content",
      ],
    });
  }
}
