import type { Branch, DeliveryEnvelope, VisitEvent } from "@opencori/contracts";
import { ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";

import type { CatalogReader } from "../src/catalog/catalog.repository.js";
import {
  alatDemoApplication,
  DEMO_CONFIGURATION_VERSION,
  wemaDemoBranches,
  wemaDemoTenant,
} from "../src/catalog/seed.js";
import { DeliveryService } from "../src/delivery/delivery.service.js";
import { InMemoryDeliveryRepository } from "../src/delivery/delivery.repository.js";
import { InMemoryVisitEventRepository } from "../src/visits/visit-event.repository.js";
import { VisitEventService } from "../src/visits/visit-event.service.js";

const BRANCH_ID = "wema_marina";

/** Catalog whose branches can be switched off part way through a test. */
class SwitchableCatalog implements CatalogReader {
  readonly branches: Branch[] = wemaDemoBranches.map((branch) => ({ ...branch }));

  async getTenant(tenantId: string) {
    return tenantId === wemaDemoTenant.id ? wemaDemoTenant : undefined;
  }

  async getApplication(tenantId: string, applicationId: string) {
    return tenantId === alatDemoApplication.tenantId && applicationId === alatDemoApplication.id
      ? alatDemoApplication
      : undefined;
  }

  async listBranches(tenantId: string): Promise<readonly Branch[]> {
    return tenantId === wemaDemoTenant.id ? this.branches : [];
  }

  switchOff(branchId: string): void {
    const branch = this.branches.find((candidate) => candidate.id === branchId);
    if (branch === undefined) throw new Error(`no such branch: ${branchId}`);
    branch.active = false;
  }
}

function visitEvent(eventType: "VISIT_STARTED" | "VISIT_COMPLETED"): VisitEvent {
  return {
    eventId: `visit_event_${eventType}`,
    tenantId: "wema",
    applicationId: "alat-demo",
    anonymousInstallationId: "inst_switch_01",
    branchId: BRANCH_ID,
    visitToken: "visit_switch_01",
    eventType,
    configurationVersion: DEMO_CONFIGURATION_VERSION,
    demo: true,
    startedAt: "2026-08-20T09:00:00.000Z",
    startSource: "CUSTOMER_CONFIRMED",
    ...(eventType === "VISIT_COMPLETED"
      ? { endedAt: "2026-08-20T09:20:00.000Z", durationSeconds: 1_200, exitConfidence: "HIGH" }
      : {}),
  } as unknown as VisitEvent;
}

function envelope(): DeliveryEnvelope {
  return {
    eventId: "delivery_switch_01",
    tenantId: "wema",
    applicationId: "alat-demo",
    anonymousInstallationId: "inst_switch_01",
    branchId: BRANCH_ID,
    visitToken: "visit_switch_01",
    routeKey: "customer-care.general",
    expiresAt: "2099-01-01T00:00:00.000Z",
  } as unknown as DeliveryEnvelope;
}

describe("a branch the tenant has switched off", () => {
  let catalog: SwitchableCatalog;
  let visits: InMemoryVisitEventRepository;
  let visitEvents: VisitEventService;
  let deliveries: DeliveryService;

  beforeEach(() => {
    catalog = new SwitchableCatalog();
    visits = new InMemoryVisitEventRepository();
    const deliveryRepository = new InMemoryDeliveryRepository();
    visitEvents = new VisitEventService(visits, catalog, deliveryRepository);
    deliveries = new DeliveryService(
      deliveryRepository,
      {
        deliver: async () => {
          throw new Error("the receiver must never be reached");
        },
      },
      visits,
      catalog,
      { now: () => new Date("2026-08-20T09:10:00.000Z") },
    );
  });

  it("refuses to start a new visit", async () => {
    catalog.switchOff(BRANCH_ID);
    await expect(visitEvents.record(visitEvent("VISIT_STARTED"))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("still lets a visit that was already open be closed", async () => {
    expect((await visitEvents.record(visitEvent("VISIT_STARTED"))).status).toBe("RECORDED");
    catalog.switchOff(BRANCH_ID);
    expect((await visitEvents.record(visitEvent("VISIT_COMPLETED"))).status).toBe("RECORDED");
  });

  it("stops delivery for a visit that is already in progress", async () => {
    expect((await visitEvents.record(visitEvent("VISIT_STARTED"))).status).toBe("RECORDED");
    catalog.switchOff(BRANCH_ID);
    await expect(deliveries.deliver(envelope())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("delivers normally while the branch is on", async () => {
    expect((await visitEvents.record(visitEvent("VISIT_STARTED"))).status).toBe("RECORDED");
    // Reaching the receiver proves the branch check passed. The stub throws a
    // plain Error, which is not a ForbiddenException.
    await expect(deliveries.deliver(envelope())).rejects.not.toBeInstanceOf(ForbiddenException);
  });
});
