import {
  applicationIdSchema,
  branchIdSchema,
  deliveryEnvelopeSchema,
  deliveryReceiptSchema,
  eventIdSchema,
  installationIdSchema,
  signedConfigurationSchema,
  signedNearbyBranchesResponseSchema,
  tenantIdSchema,
  visitCompletedEventSchema,
  visitStartedEventSchema,
  visitTokenSchema,
} from "@corri/contracts";
import {
  initialGeofenceState,
  transitionGeofence,
  type GeofenceEffect,
  type GeofenceEvent,
} from "@corri/geofence-state-machine";

import type {
  ApplicationId,
  BranchId,
  CorriState,
  DeliveryEnvelope,
  DeliveryReceipt,
  NearbyBranch,
  PublicConfiguration,
  SignedConfiguration,
  SignedNearbyBranchesResponse,
  TenantId,
  VisitCompletedEvent,
  VisitEvent,
  VisitStartedEvent,
  VisitToken,
} from "./public-types.js";

export { verifySignedPayloadWithWebCrypto, type WebCryptoSignatureProvider } from "./web-crypto.js";

export type {
  ApplicationId,
  Branch,
  BranchId,
  CorriState,
  DeliveryEnvelope,
  DeliveryReceipt,
  DeliveryState,
  EncryptedPayload,
  EventId,
  GeofencePolicy,
  MeasurementConfidence,
  NearbyBranch,
  NearbyBranchesPayload,
  NotificationTemplate,
  PublicConfiguration,
  SignedConfiguration,
  SignedNearbyBranchesResponse,
  SignedPayload,
  TenantId,
  VisitCompletedEvent,
  VisitEvent,
  VisitStartedEvent,
  VisitToken,
} from "./public-types.js";

export interface CorriTransport {
  fetchConfiguration(input: { tenantId: TenantId; applicationId: ApplicationId }): Promise<unknown>;
  fetchNearbyBranches(input: {
    tenantId: TenantId;
    applicationId: ApplicationId;
    latitude: number;
    longitude: number;
    radiusKm: number;
    limit: number;
  }): Promise<unknown>;
  recordVisitEvent(event: VisitEvent): Promise<void>;
  deliverEncryptedRequest(envelope: DeliveryEnvelope): Promise<unknown>;
  getDeliveryReceipt(input: { tenantId: TenantId; eventId: string }): Promise<unknown>;
}

export interface CorriInitialization {
  tenantId: string;
  applicationId: string;
  anonymousInstallationId: string;
  configurationSigningKeyId: string;
  configurationSigningPublicKey: string;
}

export interface CorriDependencies {
  transport: CorriTransport;
  verifySignature: CorriSignatureVerifier;
  now?: () => Date;
  createId?: (kind: "event" | "visit") => string;
}

export interface CreateCorriClientOptions {
  apiBaseUrl: string;
  publicApplicationKey: string;
  fetch: CorriFetch;
  verifySignature: CorriSignatureVerifier;
  initialization: CorriInitialization;
  now?: () => Date;
  createId?: (kind: "event" | "visit") => string;
}

export type CorriSignatureVerifier = <T>(
  signed: {
    algorithm: "Ed25519";
    keyId: string;
    payload: T;
    signature: string;
  },
  key: { keyId: string; publicKeyPem: string },
) => boolean | Promise<boolean>;

export interface CorriConsent {
  branchAwareness: boolean;
  notifications: boolean;
}

export interface BranchApproachEvent {
  branchId: BranchId;
  branchName: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "EXCLUDED";
  controlled: boolean;
}

export interface CorriDiagnosticEvent {
  code:
    | "CONFIGURATION_NOT_SYNCED"
    | "CONFIGURATION_SIGNATURE_REJECTED"
    | "NEARBY_SIGNATURE_REJECTED"
    | "NOT_MONITORING"
    | "BRANCH_NOT_REGISTERED"
    | "VISIT_EVENT_QUEUED";
  message: string;
}

export interface CorriEventMap {
  configurationVerified: { version: string };
  configurationRejected: { reason: string };
  branchApproach: BranchApproachEvent;
  visitStarted: VisitStartedEvent;
  visitCompleted: VisitCompletedEvent;
  deliveryAccepted: { eventId: DeliveryEnvelope["eventId"] };
  deliveryCompleted: DeliveryReceipt;
  deliveryFailed: { eventId: DeliveryEnvelope["eventId"] };
  diagnostic: CorriDiagnosticEvent;
}

type EventName = keyof CorriEventMap;
type EventListener<K extends EventName> = (event: CorriEventMap[K]) => void;

export interface CorriDiagnostics {
  initialized: boolean;
  configurationVerified: boolean;
  configurationVersion: string | null;
  consent: CorriConsent;
  monitoring: boolean;
  state: CorriState;
  registeredBranchCount: number;
  pendingVisitEventCount: number;
}

export interface VisitTimer {
  active: boolean;
  visitToken: VisitToken | null;
  startedAt: string | null;
  elapsedSeconds: number;
}

export interface ActiveVisitContext {
  branchId: BranchId;
  visitToken: VisitToken;
  startedAt: string;
}

interface InitializedState {
  tenantId: TenantId;
  applicationId: ApplicationId;
  anonymousInstallationId: ReturnType<typeof installationIdSchema.parse>;
  configurationSigningKeyId: string;
  configurationSigningPublicKey: string;
}

const defaultIdFactory = (kind: "event" | "visit"): string => {
  const cryptoProvider = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoProvider?.randomUUID === undefined) {
    throw new Error("A cryptographically secure createId adapter is required");
  }
  return `${kind}_${cryptoProvider.randomUUID()}`;
};

function isTerminalReceipt(receipt: DeliveryReceipt): boolean {
  return ["DELIVERED", "FAILED", "EXPIRED", "DEAD_LETTERED"].includes(receipt.state);
}

export class CorriClient {
  private readonly listeners = new Map<EventName, Set<(event: never) => void>>();
  private readonly pendingVisitEvents: VisitEvent[] = [];
  private readonly deliveryReceipts = new Map<string, DeliveryReceipt>();
  private readonly transport: CorriTransport;
  private readonly verifySignature: CorriSignatureVerifier;
  private readonly now: () => Date;
  private readonly createId: (kind: "event" | "visit") => string;
  private initialized: InitializedState | null = null;
  private configuration: PublicConfiguration | null = null;
  private registeredBranches: readonly NearbyBranch[] = [];
  private consent: CorriConsent = { branchAwareness: false, notifications: false };
  private geofenceState = initialGeofenceState;
  private monitoring = false;

  constructor(dependencies: CorriDependencies) {
    this.transport = dependencies.transport;
    this.verifySignature = dependencies.verifySignature;
    this.now = dependencies.now ?? (() => new Date());
    this.createId = dependencies.createId ?? defaultIdFactory;
  }

  initialize(input: CorriInitialization): void {
    this.initialized = {
      tenantId: tenantIdSchema.parse(input.tenantId),
      applicationId: applicationIdSchema.parse(input.applicationId),
      anonymousInstallationId: installationIdSchema.parse(input.anonymousInstallationId),
      configurationSigningKeyId: input.configurationSigningKeyId,
      configurationSigningPublicKey: input.configurationSigningPublicKey,
    };
  }

  async syncConfiguration(): Promise<SignedConfiguration> {
    const initialized = this.requireInitialized();
    const candidate = signedConfigurationSchema.parse(
      await this.transport.fetchConfiguration({
        tenantId: initialized.tenantId,
        applicationId: initialized.applicationId,
      }),
    );
    const verified = await this.verifySignature(candidate, {
      keyId: initialized.configurationSigningKeyId,
      publicKeyPem: initialized.configurationSigningPublicKey,
    });
    if (
      !verified ||
      candidate.payload.tenantId !== initialized.tenantId ||
      candidate.payload.applicationId !== initialized.applicationId
    ) {
      this.emit("configurationRejected", { reason: "Signature or application scope rejected" });
      this.diagnostic(
        "CONFIGURATION_SIGNATURE_REJECTED",
        "The signed configuration did not match the pinned key and application scope.",
      );
      throw new Error("Configuration signature rejected");
    }
    this.configuration = candidate.payload;
    this.emit("configurationVerified", { version: candidate.payload.version });
    return candidate;
  }

  async syncNearbyBranches(input: {
    latitude: number;
    longitude: number;
    radiusKm?: number;
    limit?: number;
  }): Promise<SignedNearbyBranchesResponse> {
    const initialized = this.requireInitialized();
    const configuration = this.requireConfiguration();
    const requestedQuery = {
      latitude: input.latitude,
      longitude: input.longitude,
      radiusKm: input.radiusKm ?? 50,
      limit: input.limit ?? 20,
    };
    const candidate = signedNearbyBranchesResponseSchema.parse(
      await this.transport.fetchNearbyBranches({
        tenantId: initialized.tenantId,
        applicationId: initialized.applicationId,
        ...requestedQuery,
      }),
    );
    const verified = await this.verifySignature(candidate, {
      keyId: initialized.configurationSigningKeyId,
      publicKeyPem: initialized.configurationSigningPublicKey,
    });
    if (
      !verified ||
      candidate.payload.tenantId !== initialized.tenantId ||
      candidate.payload.applicationId !== initialized.applicationId ||
      candidate.payload.configurationVersion !== configuration.version ||
      candidate.payload.query.latitude !== requestedQuery.latitude ||
      candidate.payload.query.longitude !== requestedQuery.longitude ||
      candidate.payload.query.radiusKm !== requestedQuery.radiusKm ||
      candidate.payload.query.limit !== requestedQuery.limit ||
      candidate.payload.branches.some(({ branch }) => branch.tenantId !== initialized.tenantId)
    ) {
      this.diagnostic(
        "NEARBY_SIGNATURE_REJECTED",
        "The nearby branch payload failed signature, scope, or version verification.",
      );
      throw new Error("Nearby branch signature rejected");
    }
    this.registeredBranches = candidate.payload.branches;
    return candidate;
  }

  setConsent(consent: CorriConsent): void {
    this.consent = { ...consent };
    if (consent.branchAwareness && this.geofenceState.status === "DISABLED") {
      this.dispatch({ type: "CONSENT_GRANTED" });
    } else if (!consent.branchAwareness && this.geofenceState.status !== "DISABLED") {
      this.dispatch({ type: "CONSENT_REVOKED", at: this.now().getTime() });
      this.monitoring = false;
    }
  }

  getConsent(): CorriConsent {
    return { ...this.consent };
  }

  startMonitoring(): void {
    this.requireConfiguration();
    if (!this.consent.branchAwareness || this.geofenceState.status !== "MONITORING") {
      this.diagnostic("NOT_MONITORING", "Branch-awareness consent is required before monitoring.");
      throw new Error("Branch-awareness consent is required");
    }
    this.monitoring = true;
  }

  stopMonitoring(): void {
    this.monitoring = false;
  }

  getRegisteredBranches(): readonly NearbyBranch[] {
    return this.registeredBranches;
  }

  triggerControlledApproach(
    branchId: string,
    confidence: "HIGH" | "MEDIUM" | "LOW" = "HIGH",
  ): void {
    if (!this.monitoring) {
      this.diagnostic("NOT_MONITORING", "A controlled approach requires active monitoring.");
      throw new Error("SDK is not monitoring");
    }
    const parsedBranchId = branchIdSchema.parse(branchId);
    if (!this.registeredBranches.some(({ branch }) => branch.id === parsedBranchId)) {
      this.diagnostic("BRANCH_NOT_REGISTERED", "The controlled branch is not registered nearby.");
      throw new Error("Branch is not registered");
    }
    const at = this.now().getTime();
    this.dispatch({
      type: "APPROACH_DETECTED",
      at,
      branchId: parsedBranchId,
      confidence,
      duplicate: false,
    });
    this.dispatch({ type: "SIGNAL_EVALUATED", at, acceptable: true });
  }

  async confirmVisit(): Promise<VisitStartedEvent> {
    const visitToken = visitTokenSchema.parse(this.createId("visit"));
    const effects = this.dispatch({
      type: "VISIT_CONFIRMED",
      at: this.now().getTime(),
      visitToken,
      source: "CUSTOMER_CONFIRMED",
    });
    const started = effects.find(
      (effect): effect is Extract<GeofenceEffect, { type: "VISIT_STARTED" }> =>
        effect.type === "VISIT_STARTED",
    );
    if (started === undefined) {
      throw new Error("Visit confirmation was rejected by the state machine");
    }
    const event = visitStartedEventSchema.parse({
      ...this.eventBase(started.branchId, started.visitToken, started.startedAt),
      eventType: "VISIT_STARTED",
      startedAt: new Date(started.startedAt).toISOString(),
      startSource: started.source,
      startAccuracyMeters: null,
      measurementConfidence: started.confidence,
    });
    await this.recordVisitEvent(event);
    this.emit("visitStarted", event);
    return event;
  }

  ignoreApproach(): void {
    this.requirePendingApproach();
    this.dispatch({ type: "PROMPT_IGNORED", at: this.now().getTime() });
  }

  snoozeBranch(): void {
    this.requirePendingApproach();
    this.dispatch({ type: "VISIT_SNOOZED", at: this.now().getTime() });
  }

  declineVisit(): void {
    this.requirePendingApproach();
    this.dispatch({ type: "VISIT_DECLINED", at: this.now().getTime() });
  }

  recordControlledExit(): void {
    this.dispatch({ type: "EXIT_DETECTED", at: this.now().getTime() });
  }

  async completeStableExit(): Promise<VisitCompletedEvent> {
    const effects = this.dispatch({ type: "EXIT_GRACE_ELAPSED", at: this.now().getTime() });
    return this.completeVisitFromEffects(effects);
  }

  async completeVisitManually(): Promise<VisitCompletedEvent> {
    const effects = this.dispatch({
      type: "VISIT_COMPLETED_MANUALLY",
      at: this.now().getTime(),
      source: "MANUAL_EXIT",
    });
    return this.completeVisitFromEffects(effects);
  }

  getVisitTimer(): VisitTimer {
    const state = this.geofenceState;
    if (state.status !== "VISIT_ACTIVE" && state.status !== "EXIT_PENDING") {
      return { active: false, visitToken: null, startedAt: null, elapsedSeconds: 0 };
    }
    return {
      active: true,
      visitToken: state.visitToken,
      startedAt: new Date(state.startedAt).toISOString(),
      elapsedSeconds: Math.max(0, Math.floor((this.now().getTime() - state.startedAt) / 1_000)),
    };
  }

  getActiveVisit(): ActiveVisitContext | null {
    const state = this.geofenceState;
    if (state.status !== "VISIT_ACTIVE" && state.status !== "EXIT_PENDING") {
      return null;
    }
    return {
      branchId: state.branchId,
      visitToken: state.visitToken,
      startedAt: new Date(state.startedAt).toISOString(),
    };
  }

  async deliverEncryptedRequest(input: unknown): Promise<DeliveryReceipt> {
    const initialized = this.requireInitialized();
    this.requireConfiguration();
    const envelope = deliveryEnvelopeSchema.parse(input);
    const activeVisit = this.getActiveVisit();
    if (
      activeVisit === null ||
      envelope.tenantId !== initialized.tenantId ||
      envelope.applicationId !== initialized.applicationId ||
      envelope.visitToken !== activeVisit.visitToken ||
      envelope.branchId !== activeVisit.branchId
    ) {
      throw new Error("Encrypted delivery does not match the active visit scope");
    }
    try {
      const receipt = deliveryReceiptSchema.parse(
        await this.transport.deliverEncryptedRequest(envelope),
      );
      this.requireReceiptScope(receipt, initialized.tenantId, envelope.eventId);
      this.emit("deliveryAccepted", { eventId: envelope.eventId });
      if (isTerminalReceipt(receipt)) {
        this.deliveryReceipts.set(envelope.eventId, receipt);
      }
      if (receipt.state === "DELIVERED") {
        this.emit("deliveryCompleted", receipt);
      } else if (["FAILED", "EXPIRED", "DEAD_LETTERED"].includes(receipt.state)) {
        this.emit("deliveryFailed", { eventId: envelope.eventId });
      }
      return receipt;
    } catch (error) {
      this.emit("deliveryFailed", { eventId: envelope.eventId });
      throw error;
    }
  }

  async getDeliveryReceipt(eventIdInput: string): Promise<DeliveryReceipt> {
    const initialized = this.requireInitialized();
    const eventId = eventIdSchema.parse(eventIdInput);
    const cached = this.deliveryReceipts.get(eventId);
    if (cached !== undefined) {
      return cached;
    }
    const receipt = deliveryReceiptSchema.parse(
      await this.transport.getDeliveryReceipt({ tenantId: initialized.tenantId, eventId }),
    );
    this.requireReceiptScope(receipt, initialized.tenantId, eventId);
    if (isTerminalReceipt(receipt)) {
      this.deliveryReceipts.set(eventId, receipt);
    }
    return receipt;
  }

  async flushPendingVisitEvents(): Promise<void> {
    while (this.pendingVisitEvents.length > 0) {
      const event = this.pendingVisitEvents[0] as VisitEvent;
      await this.transport.recordVisitEvent(event);
      this.pendingVisitEvents.shift();
    }
  }

  getDiagnostics(): CorriDiagnostics {
    return {
      initialized: this.initialized !== null,
      configurationVerified: this.configuration !== null,
      configurationVersion: this.configuration?.version ?? null,
      consent: this.getConsent(),
      monitoring: this.monitoring,
      state: this.geofenceState.status,
      registeredBranchCount: this.registeredBranches.length,
      pendingVisitEventCount: this.pendingVisitEvents.length,
    };
  }

  resetDemoState(): void {
    this.initialized = null;
    this.configuration = null;
    this.registeredBranches = [];
    this.consent = { branchAwareness: false, notifications: false };
    this.geofenceState = initialGeofenceState;
    this.monitoring = false;
    this.pendingVisitEvents.length = 0;
    this.deliveryReceipts.clear();
    this.listeners.clear();
  }

  on<K extends EventName>(name: K, listener: EventListener<K>): () => void {
    const listeners = this.listeners.get(name) ?? new Set<(event: never) => void>();
    listeners.add(listener as (event: never) => void);
    this.listeners.set(name, listeners);
    return () => this.off(name, listener);
  }

  off<K extends EventName>(name: K, listener: EventListener<K>): void {
    this.listeners.get(name)?.delete(listener as (event: never) => void);
  }

  private requireInitialized(): InitializedState {
    if (this.initialized === null) {
      throw new Error("Corri SDK is not initialized");
    }
    return this.initialized;
  }

  private requireConfiguration(): PublicConfiguration {
    if (this.configuration === null) {
      this.diagnostic("CONFIGURATION_NOT_SYNCED", "A verified configuration is required.");
      throw new Error("Configuration is not synchronized");
    }
    return this.configuration;
  }

  private requirePendingApproach(): void {
    if (this.geofenceState.status !== "PROMPT_PENDING") {
      throw new Error("A pending branch approach is required");
    }
  }

  private requireReceiptScope(receipt: DeliveryReceipt, tenantId: TenantId, eventId: string): void {
    if (receipt.tenantId !== tenantId || receipt.eventId !== eventId) {
      throw new Error("Delivery receipt scope rejected");
    }
  }

  private dispatch(event: GeofenceEvent): readonly GeofenceEffect[] {
    const result = transitionGeofence(
      this.geofenceState,
      event,
      this.configuration?.policy ?? {
        exitGraceSeconds: 0,
        maximumVisitDurationSeconds: 1,
        notNowCooldownSeconds: 0,
        notVisitingCooldownSeconds: 0,
      },
    );
    this.geofenceState = result.state;
    for (const effect of result.effects) {
      if (effect.type === "BRANCH_PROMPT_REQUESTED") {
        const branch = this.registeredBranches.find(
          ({ branch: item }) => item.id === effect.branchId,
        );
        if (branch !== undefined) {
          this.emit("branchApproach", {
            branchId: effect.branchId,
            branchName: branch.branch.name,
            confidence: effect.confidence,
            controlled: true,
          });
        }
      }
    }
    return result.effects;
  }

  private eventBase(branchId: BranchId, visitToken: VisitToken, occurredAt: number) {
    const initialized = this.requireInitialized();
    const configuration = this.requireConfiguration();
    return {
      eventId: this.createId("event"),
      tenantId: initialized.tenantId,
      applicationId: initialized.applicationId,
      anonymousInstallationId: initialized.anonymousInstallationId,
      branchId,
      visitToken,
      occurredAt: new Date(occurredAt).toISOString(),
      configurationVersion: configuration.version,
      demo: true,
    };
  }

  private async completeVisitFromEffects(
    effects: readonly GeofenceEffect[],
  ): Promise<VisitCompletedEvent> {
    const completed = effects.find(
      (effect): effect is Extract<GeofenceEffect, { type: "VISIT_COMPLETED" }> =>
        effect.type === "VISIT_COMPLETED",
    );
    if (completed === undefined) {
      throw new Error("Visit completion was rejected by the state machine");
    }
    const event = visitCompletedEventSchema.parse({
      ...this.eventBase(completed.branchId, completed.visitToken, completed.endedAt),
      eventType: "VISIT_COMPLETED",
      startedAt: new Date(completed.startedAt).toISOString(),
      endedAt: new Date(completed.endedAt).toISOString(),
      durationSeconds: completed.durationSeconds,
      startSource: "CUSTOMER_CONFIRMED",
      endSource: completed.source,
      endAccuracyMeters: null,
      measurementConfidence: completed.confidence,
    });
    await this.recordVisitEvent(event);
    this.emit("visitCompleted", event);
    return event;
  }

  private async recordVisitEvent(event: VisitEvent): Promise<void> {
    try {
      await this.transport.recordVisitEvent(event);
    } catch {
      this.pendingVisitEvents.push(event);
      this.diagnostic(
        "VISIT_EVENT_QUEUED",
        "Visit metadata was queued locally after delivery failed.",
      );
    }
  }

  private diagnostic(code: CorriDiagnosticEvent["code"], message: string): void {
    this.emit("diagnostic", { code, message });
  }

  private emit<K extends EventName>(name: K, event: CorriEventMap[K]): void {
    for (const listener of this.listeners.get(name) ?? []) {
      try {
        listener(event as never);
      } catch {
        // Host callbacks are isolated from SDK state transitions.
      }
    }
  }
}

export interface CorriHttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type CorriFetch = (
  url: string,
  init?: {
    method?: "GET" | "POST";
    headers?: Readonly<Record<string, string>>;
    body?: string;
  },
) => Promise<CorriHttpResponse>;

export class CorriTransportError extends Error {
  constructor(readonly status: number) {
    super(`Corri transport request failed with HTTP ${status}`);
    this.name = "CorriTransportError";
  }
}

export class FetchCorriTransport implements CorriTransport {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly publicApplicationKey: string,
    private readonly fetcher: CorriFetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  fetchConfiguration(input: {
    tenantId: TenantId;
    applicationId: ApplicationId;
  }): Promise<unknown> {
    const query = new URLSearchParams({
      tenantId: input.tenantId,
      applicationId: input.applicationId,
    });
    return this.request(`/v1/sdk/configuration?${query.toString()}`, { method: "GET" });
  }

  fetchNearbyBranches(input: {
    tenantId: TenantId;
    applicationId: ApplicationId;
    latitude: number;
    longitude: number;
    radiusKm: number;
    limit: number;
  }): Promise<unknown> {
    const query = new URLSearchParams({
      tenantId: input.tenantId,
      applicationId: input.applicationId,
      lat: String(input.latitude),
      lng: String(input.longitude),
      radiusKm: String(input.radiusKm),
      limit: String(input.limit),
    });
    return this.request(`/v1/sdk/branches/nearby?${query.toString()}`, { method: "GET" });
  }

  async recordVisitEvent(event: VisitEvent): Promise<void> {
    await this.request("/v1/sdk/visits/events", {
      method: "POST",
      body: JSON.stringify(event),
    });
  }

  deliverEncryptedRequest(envelope: DeliveryEnvelope): Promise<unknown> {
    return this.request("/v1/sdk/deliveries", {
      method: "POST",
      body: JSON.stringify(envelope),
    });
  }

  getDeliveryReceipt(input: { tenantId: TenantId; eventId: string }): Promise<unknown> {
    const query = new URLSearchParams({ tenantId: input.tenantId });
    return this.request(
      `/v1/sdk/deliveries/${encodeURIComponent(input.eventId)}?${query.toString()}`,
      { method: "GET" },
    );
  }

  private async request(
    path: string,
    init: { method: "GET" | "POST"; body?: string },
  ): Promise<unknown> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-corri-public-application-key": this.publicApplicationKey,
      },
    });
    if (!response.ok) {
      throw new CorriTransportError(response.status);
    }
    return response.json();
  }
}

export function createCorriClient(options: CreateCorriClientOptions): CorriClient {
  const client = new CorriClient({
    transport: new FetchCorriTransport(
      options.apiBaseUrl,
      options.publicApplicationKey,
      options.fetch,
    ),
    verifySignature: options.verifySignature,
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.createId === undefined ? {} : { createId: options.createId }),
  });
  client.initialize(options.initialization);
  return client;
}
