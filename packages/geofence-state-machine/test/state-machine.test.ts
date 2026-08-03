import { branchIdSchema, visitTokenSchema } from "@corri/contracts";
import { describe, expect, it } from "vitest";

import {
  initialGeofenceState,
  transitionGeofence,
  type GeofenceEvent,
  type GeofenceState,
  type StateMachinePolicy,
} from "../src/index.js";

const branchId = branchIdSchema.parse("branch_lagos_001");
const visitToken = visitTokenSchema.parse("visit_001");
const policy: StateMachinePolicy = {
  exitGraceSeconds: 30,
  maximumVisitDurationSeconds: 3_600,
  notNowCooldownSeconds: 300,
  notVisitingCooldownSeconds: 86_400,
};

function transition(state: GeofenceState, event: GeofenceEvent) {
  return transitionGeofence(state, event, policy);
}

function monitoringState(): GeofenceState {
  return transition(initialGeofenceState, { type: "CONSENT_GRANTED" }).state;
}

function promptState(): GeofenceState {
  const candidate = transition(monitoringState(), {
    type: "APPROACH_DETECTED",
    at: 1_000,
    branchId,
    confidence: "HIGH",
    duplicate: false,
  }).state;

  return transition(candidate, {
    type: "SIGNAL_EVALUATED",
    at: 2_000,
    acceptable: true,
  }).state;
}

function activeState(): GeofenceState {
  return transition(promptState(), {
    type: "VISIT_CONFIRMED",
    at: 3_000,
    visitToken,
    source: "CUSTOMER_CONFIRMED",
  }).state;
}

describe("transitionGeofence", () => {
  it("requires consent and resets on revocation", () => {
    const ignored = transition(initialGeofenceState, {
      type: "APPROACH_DETECTED",
      at: 1_000,
      branchId,
      confidence: "HIGH",
      duplicate: false,
    });

    expect(ignored.effects[0]).toMatchObject({
      type: "DIAGNOSTIC",
      code: "IGNORED_EVENT",
    });
    expect(monitoringState()).toEqual({ status: "MONITORING" });
    expect(transition(monitoringState(), { type: "CONSENT_REVOKED", at: 1_000 }).state).toEqual({
      status: "DISABLED",
    });
  });

  it("rejects duplicate, excluded, and unacceptable approaches", () => {
    for (const scenario of [
      { confidence: "HIGH" as const, duplicate: true, acceptable: true },
      { confidence: "EXCLUDED" as const, duplicate: false, acceptable: true },
      { confidence: "LOW" as const, duplicate: false, acceptable: false },
    ]) {
      const candidate = transition(monitoringState(), {
        type: "APPROACH_DETECTED",
        at: 1_000,
        branchId,
        confidence: scenario.confidence,
        duplicate: scenario.duplicate,
      }).state;

      expect(
        transition(candidate, {
          type: "SIGNAL_EVALUATED",
          at: 2_000,
          acceptable: scenario.acceptable,
        }),
      ).toEqual({ state: { status: "MONITORING" }, effects: [] });
    }
  });

  it("requests a prompt for an acceptable approach", () => {
    expect(promptState()).toEqual({
      status: "PROMPT_PENDING",
      branchId,
      confidence: "HIGH",
      promptedAt: 2_000,
    });
  });

  it.each([
    ["PROMPT_IGNORED", "COOLDOWN", 302_000],
    ["VISIT_SNOOZED", "COOLDOWN", 302_000],
    ["VISIT_DECLINED", "LONG_COOLDOWN", 86_402_000],
  ] as const)("applies %s policy", (eventType, expectedStatus, expectedUntil) => {
    expect(transition(promptState(), { type: eventType, at: 2_000 }).state).toMatchObject({
      status: expectedStatus,
      until: expectedUntil,
    });
  });

  it("does not leave cooldown before its deadline", () => {
    const cooldown = transition(promptState(), {
      type: "VISIT_SNOOZED",
      at: 2_000,
    }).state;

    expect(transition(cooldown, { type: "COOLDOWN_ELAPSED", at: 301_999 }).state).toBe(cooldown);
    expect(transition(cooldown, { type: "COOLDOWN_ELAPSED", at: 302_000 }).state).toEqual({
      status: "MONITORING",
    });
  });

  it("starts a confirmed visit and emits the domain effect", () => {
    const result = transition(promptState(), {
      type: "VISIT_CONFIRMED",
      at: 3_000,
      visitToken,
      source: "CUSTOMER_CONFIRMED",
    });

    expect(result.state).toMatchObject({
      status: "VISIT_ACTIVE",
      branchId,
      visitToken,
      startedAt: 3_000,
    });
    expect(result.effects).toEqual([
      {
        type: "VISIT_STARTED",
        branchId,
        confidence: "HIGH",
        visitToken,
        startedAt: 3_000,
        source: "CUSTOMER_CONFIRMED",
      },
    ]);
  });

  it("cancels a pending exit on reentry", () => {
    const exiting = transition(activeState(), {
      type: "EXIT_DETECTED",
      at: 10_000,
    }).state;

    expect(transition(exiting, { type: "REENTRY_DETECTED", at: 20_000 }).state).toEqual(
      activeState(),
    );
  });

  it("completes only after the exit grace period", () => {
    const exiting = transition(activeState(), {
      type: "EXIT_DETECTED",
      at: 10_000,
    }).state;

    expect(transition(exiting, { type: "EXIT_GRACE_ELAPSED", at: 39_999 }).state).toBe(exiting);

    const completed = transition(exiting, {
      type: "EXIT_GRACE_ELAPSED",
      at: 40_000,
    });
    expect(completed.state).toMatchObject({
      status: "COMPLETED",
      durationSeconds: 37,
      endSource: "GEOFENCE_EXIT",
    });
    expect(completed.effects[0]).toMatchObject({
      type: "VISIT_COMPLETED",
      source: "GEOFENCE_EXIT",
      durationSeconds: 37,
    });
  });

  it.each(["MANUAL_EXIT", "HOST_APP_EXIT"] as const)(
    "supports %s completion from active and exit-pending states",
    (source) => {
      const active = activeState();
      const exiting = transition(active, { type: "EXIT_DETECTED", at: 10_000 }).state;

      expect(
        transition(active, {
          type: "VISIT_COMPLETED_MANUALLY",
          at: 20_000,
          source,
        }).state,
      ).toMatchObject({ status: "COMPLETED", endSource: source });
      expect(
        transition(exiting, {
          type: "VISIT_COMPLETED_MANUALLY",
          at: 20_000,
          source,
        }).state,
      ).toMatchObject({ status: "COMPLETED", endSource: source });
    },
  );

  it("expires visits only at maximum duration", () => {
    const active = activeState();
    const exiting = transition(active, { type: "EXIT_DETECTED", at: 10_000 }).state;

    expect(transition(active, { type: "MAX_DURATION_ELAPSED", at: 3_602_999 }).state).toBe(active);
    expect(
      transition(exiting, { type: "MAX_DURATION_ELAPSED", at: 3_603_000 }).state,
    ).toMatchObject({
      status: "EXPIRED",
      endedAt: 3_603_000,
      durationSeconds: 3_600,
    });
  });

  it("rejects unsafe and out-of-order timestamps", () => {
    const candidate = transition(monitoringState(), {
      type: "APPROACH_DETECTED",
      at: 2_000,
      branchId,
      confidence: "HIGH",
      duplicate: false,
    }).state;
    const outOfOrder = transition(candidate, {
      type: "SIGNAL_EVALUATED",
      at: 1_999,
      acceptable: true,
    });

    expect(outOfOrder.state).toBe(candidate);
    expect(outOfOrder.effects[0]).toMatchObject({
      type: "DIAGNOSTIC",
      code: "INVALID_TIMESTAMP",
    });
    expect(
      transition(initialGeofenceState, {
        type: "APPROACH_DETECTED",
        at: Number.NaN,
        branchId,
        confidence: "HIGH",
        duplicate: false,
      }).effects[0],
    ).toMatchObject({ code: "INVALID_TIMESTAMP" });
  });

  it("fails closed for policy values outside the contract", () => {
    const result = transitionGeofence(
      initialGeofenceState,
      { type: "CONSENT_GRANTED" },
      { ...policy, maximumVisitDurationSeconds: 0 },
    );

    expect(result.effects[0]).toMatchObject({
      type: "DIAGNOSTIC",
      code: "INVALID_POLICY",
    });
    expect(result.state).toBe(initialGeofenceState);
  });

  it("keeps terminal states stable until reset", () => {
    const completed = transition(activeState(), {
      type: "VISIT_COMPLETED_MANUALLY",
      at: 20_000,
      source: "MANUAL_EXIT",
    }).state;

    expect(transition(completed, { type: "CONSENT_GRANTED" }).state).toBe(completed);
    expect(transition(completed, { type: "RESET" })).toEqual({
      state: initialGeofenceState,
      effects: [],
    });
  });

  it("aborts an active visit when consent is revoked", () => {
    const active = activeState();
    const result = transition(active, { type: "CONSENT_REVOKED", at: 20_000 });

    expect(result.state).toEqual({ status: "DISABLED" });
    expect(result.effects).toEqual([
      {
        type: "VISIT_ABORTED",
        branchId,
        confidence: "HIGH",
        visitToken,
        startedAt: 3_000,
        endedAt: 20_000,
        durationSeconds: 17,
        reason: "CONSENT_REVOKED",
      },
    ]);
    expect(transition(active, { type: "RESET" }).state).toBe(active);
  });

  it("rejects out-of-order and irrelevant active-visit events", () => {
    const active = activeState();
    const exiting = transition(active, { type: "EXIT_DETECTED", at: 10_000 }).state;

    expect(
      transition(active, {
        type: "VISIT_COMPLETED_MANUALLY",
        at: 2_999,
        source: "MANUAL_EXIT",
      }).effects[0],
    ).toMatchObject({ code: "INVALID_TIMESTAMP" });
    expect(transition(active, { type: "COOLDOWN_ELAPSED", at: 20_000 }).state).toBe(active);
    expect(transition(exiting, { type: "REENTRY_DETECTED", at: 9_999 }).effects[0]).toMatchObject({
      code: "INVALID_TIMESTAMP",
    });
    expect(transition(exiting, { type: "COOLDOWN_ELAPSED", at: 20_000 }).state).toBe(exiting);
  });

  it("ignores irrelevant prompt and expired-state events", () => {
    const prompt = promptState();
    expect(transition(prompt, { type: "EXIT_DETECTED", at: 3_000 }).state).toBe(prompt);

    const expired = transition(activeState(), {
      type: "MAX_DURATION_ELAPSED",
      at: 3_603_000,
    }).state;
    expect(transition(expired, { type: "CONSENT_GRANTED" }).state).toBe(expired);
  });
});
