import type { DeliveryEnvelope, VisitEvent } from "@opencori/contracts";
import { ConflictException, Injectable } from "@nestjs/common";

export const VISIT_EVENT_REPOSITORY = Symbol("VISIT_EVENT_REPOSITORY");

export interface VisitEventRepository {
  append(event: VisitEvent): "RECORDED" | "DUPLICATE";
  hasActiveVisit(
    scope: Pick<
      DeliveryEnvelope,
      "tenantId" | "applicationId" | "anonymousInstallationId" | "branchId" | "visitToken"
    >,
  ): boolean;
  list(tenantId: string, applicationId: string): readonly VisitEvent[];
}

interface VisitRecord {
  started?: VisitEvent;
  terminal?: VisitEvent;
}

@Injectable()
export class InMemoryVisitEventRepository implements VisitEventRepository {
  private readonly events = new Map<string, VisitEvent>();
  private readonly visits = new Map<string, VisitRecord>();

  append(event: VisitEvent): "RECORDED" | "DUPLICATE" {
    const eventKey = `${event.tenantId}:${event.eventId}`;
    const existingEvent = this.events.get(eventKey);
    if (existingEvent !== undefined) {
      if (JSON.stringify(existingEvent) === JSON.stringify(event)) {
        return "DUPLICATE";
      }
      throw new ConflictException();
    }

    const visitKey = `${event.tenantId}:${event.applicationId}:${event.visitToken}`;
    const visit = this.visits.get(visitKey) ?? {};
    if (event.eventType === "VISIT_STARTED") {
      if (visit.started !== undefined || visit.terminal !== undefined) {
        throw new ConflictException();
      }
      const alreadyActive = [...this.visits.values()].some(
        (candidate) =>
          candidate.started?.tenantId === event.tenantId &&
          candidate.started.applicationId === event.applicationId &&
          candidate.started.anonymousInstallationId === event.anonymousInstallationId &&
          candidate.terminal === undefined,
      );
      if (alreadyActive) {
        throw new ConflictException();
      }
      visit.started = event;
    } else {
      if (
        visit.started === undefined ||
        visit.terminal !== undefined ||
        visit.started.anonymousInstallationId !== event.anonymousInstallationId ||
        visit.started.branchId !== event.branchId ||
        visit.started.startedAt !== event.startedAt ||
        visit.started.startSource !== event.startSource
      ) {
        throw new ConflictException();
      }
      visit.terminal = event;
    }

    this.events.set(eventKey, event);
    this.visits.set(visitKey, visit);
    return "RECORDED";
  }

  list(tenantId: string, applicationId: string): readonly VisitEvent[] {
    return [...this.events.values()].filter(
      (event) => event.tenantId === tenantId && event.applicationId === applicationId,
    );
  }

  hasActiveVisit(
    scope: Pick<
      DeliveryEnvelope,
      "tenantId" | "applicationId" | "anonymousInstallationId" | "branchId" | "visitToken"
    >,
  ): boolean {
    const visit = this.visits.get(`${scope.tenantId}:${scope.applicationId}:${scope.visitToken}`);
    return (
      visit?.started !== undefined &&
      visit.terminal === undefined &&
      visit.started.anonymousInstallationId === scope.anonymousInstallationId &&
      visit.started.branchId === scope.branchId
    );
  }
}
