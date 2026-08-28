import { visitCompletedEventSchema, visitStartedEventSchema } from "@opencori/contracts";
import { describe, expect, it } from "vitest";

import { InMemoryVisitEventRepository } from "../src/visits/visit-event.repository.js";

const started = visitStartedEventSchema.parse({
  eventId: "visit_event_started_scope",
  tenantId: "wema",
  applicationId: "alat-demo",
  anonymousInstallationId: "inst_scope_01",
  branchId: "wema_marina",
  visitToken: "visit_scope_01",
  occurredAt: "2026-08-03T10:00:00.000Z",
  configurationVersion: "test-config-1",
  demo: true,
  eventType: "VISIT_STARTED",
  startedAt: "2026-08-03T10:00:00.000Z",
  startSource: "CUSTOMER_CONFIRMED",
  startAccuracyMeters: null,
  measurementConfidence: "HIGH",
});

describe("visit event repository", () => {
  it("allows only one active visit per installation", () => {
    const repository = new InMemoryVisitEventRepository();
    repository.append(started);

    const secondVisit = visitStartedEventSchema.parse({
      ...started,
      eventId: "visit_event_started_scope_02",
      visitToken: "visit_scope_02",
      branchId: "wema_aba",
    });

    expect(() => repository.append(secondVisit)).toThrow();
  });

  it("rejects a terminal event from a different installation", () => {
    const repository = new InMemoryVisitEventRepository();
    repository.append(started);
    const completed = visitCompletedEventSchema.parse({
      eventId: "visit_event_completed_scope",
      tenantId: started.tenantId,
      applicationId: started.applicationId,
      anonymousInstallationId: "inst_scope_02",
      branchId: started.branchId,
      visitToken: started.visitToken,
      occurredAt: "2026-08-03T10:01:00.000Z",
      configurationVersion: started.configurationVersion,
      demo: true,
      eventType: "VISIT_COMPLETED",
      startedAt: started.startedAt,
      endedAt: "2026-08-03T10:01:00.000Z",
      durationSeconds: 60,
      startSource: started.startSource,
      endSource: "MANUAL_EXIT",
      endAccuracyMeters: null,
      measurementConfidence: "HIGH",
    });

    expect(() => repository.append(completed)).toThrow();
  });
});
