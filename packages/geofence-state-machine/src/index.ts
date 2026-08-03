import type {
  BranchId,
  GeofencePolicy,
  MeasurementConfidence,
  VisitStartSource,
  VisitToken,
} from "@corri/contracts";

export type StateMachinePolicy = Pick<
  GeofencePolicy,
  | "exitGraceSeconds"
  | "maximumVisitDurationSeconds"
  | "notNowCooldownSeconds"
  | "notVisitingCooldownSeconds"
>;

interface BranchContext {
  branchId: BranchId;
  confidence: MeasurementConfidence;
}

export type GeofenceState =
  | { status: "DISABLED" }
  | { status: "MONITORING" }
  | ({
      status: "APPROACH_CANDIDATE";
      detectedAt: number;
      duplicate: boolean;
    } & BranchContext)
  | ({ status: "PROMPT_PENDING"; promptedAt: number } & BranchContext)
  | ({ status: "COOLDOWN"; until: number } & BranchContext)
  | ({ status: "LONG_COOLDOWN"; until: number } & BranchContext)
  | ({
      status: "VISIT_ACTIVE";
      visitToken: VisitToken;
      startedAt: number;
      startSource: VisitStartSource;
    } & BranchContext)
  | ({
      status: "EXIT_PENDING";
      visitToken: VisitToken;
      startedAt: number;
      startSource: VisitStartSource;
      outsideSince: number;
    } & BranchContext)
  | ({
      status: "COMPLETED";
      visitToken: VisitToken;
      startedAt: number;
      endedAt: number;
      durationSeconds: number;
      endSource: "GEOFENCE_EXIT" | "MANUAL_EXIT" | "HOST_APP_EXIT";
    } & BranchContext)
  | ({
      status: "EXPIRED";
      visitToken: VisitToken;
      startedAt: number;
      endedAt: number;
      durationSeconds: number;
    } & BranchContext);

export type GeofenceEvent =
  | { type: "CONSENT_GRANTED" }
  | { type: "CONSENT_REVOKED"; at: number }
  | {
      type: "APPROACH_DETECTED";
      at: number;
      branchId: BranchId;
      confidence: MeasurementConfidence;
      duplicate: boolean;
    }
  | { type: "SIGNAL_EVALUATED"; at: number; acceptable: boolean }
  | { type: "PROMPT_IGNORED"; at: number }
  | { type: "VISIT_SNOOZED"; at: number }
  | { type: "VISIT_DECLINED"; at: number }
  | {
      type: "VISIT_CONFIRMED";
      at: number;
      visitToken: VisitToken;
      source: VisitStartSource;
    }
  | { type: "COOLDOWN_ELAPSED"; at: number }
  | { type: "EXIT_DETECTED"; at: number }
  | { type: "REENTRY_DETECTED"; at: number }
  | { type: "EXIT_GRACE_ELAPSED"; at: number }
  | { type: "VISIT_COMPLETED_MANUALLY"; at: number; source: "MANUAL_EXIT" | "HOST_APP_EXIT" }
  | { type: "MAX_DURATION_ELAPSED"; at: number }
  | { type: "RESET" };

export type GeofenceEffect =
  | ({ type: "BRANCH_PROMPT_REQUESTED" } & BranchContext)
  | ({
      type: "VISIT_STARTED";
      visitToken: VisitToken;
      startedAt: number;
      source: VisitStartSource;
    } & BranchContext)
  | ({
      type: "VISIT_COMPLETED";
      visitToken: VisitToken;
      startedAt: number;
      endedAt: number;
      durationSeconds: number;
      source: "GEOFENCE_EXIT" | "MANUAL_EXIT" | "HOST_APP_EXIT";
    } & BranchContext)
  | ({
      type: "VISIT_EXPIRED";
      visitToken: VisitToken;
      startedAt: number;
      endedAt: number;
      durationSeconds: number;
    } & BranchContext)
  | ({
      type: "VISIT_ABORTED";
      visitToken: VisitToken;
      startedAt: number;
      endedAt: number;
      durationSeconds: number;
      reason: "CONSENT_REVOKED";
    } & BranchContext)
  | {
      type: "DIAGNOSTIC";
      code: "IGNORED_EVENT" | "INVALID_POLICY" | "INVALID_TIMESTAMP";
      event: GeofenceEvent["type"];
      state: GeofenceState["status"];
    };

export interface TransitionResult {
  state: GeofenceState;
  effects: readonly GeofenceEffect[];
}

export const initialGeofenceState: GeofenceState = { status: "DISABLED" };

function diagnostic(
  state: GeofenceState,
  event: GeofenceEvent,
  code: Extract<GeofenceEffect, { type: "DIAGNOSTIC" }>["code"],
): TransitionResult {
  return {
    state,
    effects: [
      {
        type: "DIAGNOSTIC",
        code,
        event: event.type,
        state: state.status,
      },
    ],
  };
}

function ignored(state: GeofenceState, event: GeofenceEvent): TransitionResult {
  return diagnostic(state, event, "IGNORED_EVENT");
}

function isValidTimestamp(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function isValidPolicy(policy: StateMachinePolicy): boolean {
  return (
    Number.isSafeInteger(policy.exitGraceSeconds) &&
    policy.exitGraceSeconds >= 0 &&
    policy.exitGraceSeconds <= 86_400 &&
    Number.isSafeInteger(policy.notNowCooldownSeconds) &&
    policy.notNowCooldownSeconds >= 0 &&
    policy.notNowCooldownSeconds <= 604_800 &&
    Number.isSafeInteger(policy.notVisitingCooldownSeconds) &&
    policy.notVisitingCooldownSeconds >= 0 &&
    policy.notVisitingCooldownSeconds <= 2_592_000 &&
    Number.isSafeInteger(policy.maximumVisitDurationSeconds) &&
    policy.maximumVisitDurationSeconds > 0 &&
    policy.maximumVisitDurationSeconds <= 604_800
  );
}

function durationSeconds(startedAt: number, endedAt: number): number {
  return Math.max(0, Math.floor((endedAt - startedAt) / 1_000));
}

function completeVisit(
  state: Extract<GeofenceState, { status: "VISIT_ACTIVE" | "EXIT_PENDING" }>,
  endedAt: number,
  source: "GEOFENCE_EXIT" | "MANUAL_EXIT" | "HOST_APP_EXIT",
): TransitionResult {
  const duration = durationSeconds(state.startedAt, endedAt);
  const next: GeofenceState = {
    status: "COMPLETED",
    branchId: state.branchId,
    confidence: state.confidence,
    visitToken: state.visitToken,
    startedAt: state.startedAt,
    endedAt,
    durationSeconds: duration,
    endSource: source,
  };

  return {
    state: next,
    effects: [
      {
        type: "VISIT_COMPLETED",
        branchId: state.branchId,
        confidence: state.confidence,
        visitToken: state.visitToken,
        startedAt: state.startedAt,
        endedAt,
        durationSeconds: duration,
        source,
      },
    ],
  };
}

function abortVisit(
  state: Extract<GeofenceState, { status: "VISIT_ACTIVE" | "EXIT_PENDING" }>,
  endedAt: number,
): TransitionResult {
  const duration = durationSeconds(state.startedAt, endedAt);
  return {
    state: initialGeofenceState,
    effects: [
      {
        type: "VISIT_ABORTED",
        branchId: state.branchId,
        confidence: state.confidence,
        visitToken: state.visitToken,
        startedAt: state.startedAt,
        endedAt,
        durationSeconds: duration,
        reason: "CONSENT_REVOKED",
      },
    ],
  };
}

export function transitionGeofence(
  state: GeofenceState,
  event: GeofenceEvent,
  policy: StateMachinePolicy,
): TransitionResult {
  if (event.type === "RESET") {
    return state.status === "VISIT_ACTIVE" || state.status === "EXIT_PENDING"
      ? ignored(state, event)
      : { state: initialGeofenceState, effects: [] };
  }

  if ("at" in event && !isValidTimestamp(event.at)) {
    return diagnostic(state, event, "INVALID_TIMESTAMP");
  }

  if (event.type === "CONSENT_REVOKED") {
    if (
      (state.status === "VISIT_ACTIVE" || state.status === "EXIT_PENDING") &&
      event.at < state.startedAt
    ) {
      return diagnostic(state, event, "INVALID_TIMESTAMP");
    }
    if (state.status === "VISIT_ACTIVE" || state.status === "EXIT_PENDING") {
      return abortVisit(state, event.at);
    }
    return { state: initialGeofenceState, effects: [] };
  }

  if (!isValidPolicy(policy)) {
    return diagnostic(state, event, "INVALID_POLICY");
  }

  if (event.type === "CONSENT_GRANTED") {
    return state.status === "DISABLED"
      ? { state: { status: "MONITORING" }, effects: [] }
      : ignored(state, event);
  }

  switch (state.status) {
    case "DISABLED":
      return ignored(state, event);

    case "MONITORING":
      if (event.type !== "APPROACH_DETECTED") {
        return ignored(state, event);
      }
      return {
        state: {
          status: "APPROACH_CANDIDATE",
          branchId: event.branchId,
          confidence: event.confidence,
          detectedAt: event.at,
          duplicate: event.duplicate,
        },
        effects: [],
      };

    case "APPROACH_CANDIDATE":
      if (event.type !== "SIGNAL_EVALUATED") {
        return ignored(state, event);
      }
      if (event.at < state.detectedAt) {
        return diagnostic(state, event, "INVALID_TIMESTAMP");
      }
      if (!event.acceptable || state.duplicate || state.confidence === "EXCLUDED") {
        return { state: { status: "MONITORING" }, effects: [] };
      }
      return {
        state: {
          status: "PROMPT_PENDING",
          branchId: state.branchId,
          confidence: state.confidence,
          promptedAt: event.at,
        },
        effects: [
          {
            type: "BRANCH_PROMPT_REQUESTED",
            branchId: state.branchId,
            confidence: state.confidence,
          },
        ],
      };

    case "PROMPT_PENDING":
      if ("at" in event && event.at < state.promptedAt) {
        return diagnostic(state, event, "INVALID_TIMESTAMP");
      }
      if (event.type === "PROMPT_IGNORED" || event.type === "VISIT_SNOOZED") {
        return {
          state: {
            status: "COOLDOWN",
            branchId: state.branchId,
            confidence: state.confidence,
            until: event.at + policy.notNowCooldownSeconds * 1_000,
          },
          effects: [],
        };
      }
      if (event.type === "VISIT_DECLINED") {
        return {
          state: {
            status: "LONG_COOLDOWN",
            branchId: state.branchId,
            confidence: state.confidence,
            until: event.at + policy.notVisitingCooldownSeconds * 1_000,
          },
          effects: [],
        };
      }
      if (event.type === "VISIT_CONFIRMED") {
        const next: GeofenceState = {
          status: "VISIT_ACTIVE",
          branchId: state.branchId,
          confidence: state.confidence,
          visitToken: event.visitToken,
          startedAt: event.at,
          startSource: event.source,
        };
        return {
          state: next,
          effects: [
            {
              type: "VISIT_STARTED",
              branchId: state.branchId,
              confidence: state.confidence,
              visitToken: event.visitToken,
              startedAt: event.at,
              source: event.source,
            },
          ],
        };
      }
      return ignored(state, event);

    case "COOLDOWN":
    case "LONG_COOLDOWN":
      if (event.type === "COOLDOWN_ELAPSED" && event.at >= state.until) {
        return { state: { status: "MONITORING" }, effects: [] };
      }
      return ignored(state, event);

    case "VISIT_ACTIVE":
      if ("at" in event && event.at < state.startedAt) {
        return diagnostic(state, event, "INVALID_TIMESTAMP");
      }
      if (event.type === "EXIT_DETECTED") {
        return {
          state: { ...state, status: "EXIT_PENDING", outsideSince: event.at },
          effects: [],
        };
      }
      if (event.type === "VISIT_COMPLETED_MANUALLY") {
        return completeVisit(state, event.at, event.source);
      }
      if (
        event.type === "MAX_DURATION_ELAPSED" &&
        event.at - state.startedAt >= policy.maximumVisitDurationSeconds * 1_000
      ) {
        const duration = durationSeconds(state.startedAt, event.at);
        return {
          state: {
            status: "EXPIRED",
            branchId: state.branchId,
            confidence: state.confidence,
            visitToken: state.visitToken,
            startedAt: state.startedAt,
            endedAt: event.at,
            durationSeconds: duration,
          },
          effects: [
            {
              type: "VISIT_EXPIRED",
              branchId: state.branchId,
              confidence: state.confidence,
              visitToken: state.visitToken,
              startedAt: state.startedAt,
              endedAt: event.at,
              durationSeconds: duration,
            },
          ],
        };
      }
      return ignored(state, event);

    case "EXIT_PENDING":
      if ("at" in event && event.at < state.outsideSince) {
        return diagnostic(state, event, "INVALID_TIMESTAMP");
      }
      if (event.type === "REENTRY_DETECTED") {
        return {
          state: {
            status: "VISIT_ACTIVE",
            branchId: state.branchId,
            confidence: state.confidence,
            visitToken: state.visitToken,
            startedAt: state.startedAt,
            startSource: state.startSource,
          },
          effects: [],
        };
      }
      if (
        event.type === "EXIT_GRACE_ELAPSED" &&
        event.at - state.outsideSince >= policy.exitGraceSeconds * 1_000
      ) {
        return completeVisit(state, event.at, "GEOFENCE_EXIT");
      }
      if (event.type === "VISIT_COMPLETED_MANUALLY") {
        return completeVisit(state, event.at, event.source);
      }
      if (
        event.type === "MAX_DURATION_ELAPSED" &&
        event.at - state.startedAt >= policy.maximumVisitDurationSeconds * 1_000
      ) {
        const activeState: GeofenceState = {
          status: "VISIT_ACTIVE",
          branchId: state.branchId,
          confidence: state.confidence,
          visitToken: state.visitToken,
          startedAt: state.startedAt,
          startSource: state.startSource,
        };
        return transitionGeofence(activeState, event, policy);
      }
      return ignored(state, event);

    case "COMPLETED":
    case "EXPIRED":
      return ignored(state, event);
  }
}
