export type TenantId = string;
export type ApplicationId = string;
export type BranchId = string;
export type VisitToken = string;
export type EventId = string;
export type MeasurementConfidence = "HIGH" | "MEDIUM" | "LOW" | "EXCLUDED";

export interface GeofencePolicy {
  approachRadiusMeters: number;
  visitRadiusMeters: number;
  exitRadiusMeters: number;
  exitGraceSeconds: number;
  notNowCooldownSeconds: number;
  notVisitingCooldownSeconds: number;
  maximumVisitDurationSeconds: number;
  minimumAccuracyMeters: number;
  startPolicy: "CUSTOMER_CONFIRMED" | "DWELL_CONFIRMED" | "HOST_APP_CONFIRMED";
  endPolicy: "STABLE_GEOFENCE_EXIT" | "MANUAL_EXIT" | "MAX_DURATION" | "HOST_APP_EXIT";
}

export interface NotificationTemplate {
  locale: string;
  title: string;
  body: string;
  sound: boolean;
  vibration: boolean;
  version: string;
}

export interface PublicConfiguration {
  tenantId: TenantId;
  applicationId: ApplicationId;
  version: string;
  publishedAt: string;
  policy: GeofencePolicy;
  notification: NotificationTemplate;
}

export interface SignedPayload<T> {
  algorithm: "Ed25519";
  keyId: string;
  payload: T;
  signature: string;
}

export type SignedConfiguration = SignedPayload<PublicConfiguration>;

export interface Branch {
  id: BranchId;
  tenantId: TenantId;
  externalBranchId: string;
  name: string;
  branchType: "BRANCH" | "SERVICE_CENTER" | "CAMPUS" | "CLINIC" | "OFFICE" | "OTHER";
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  stateOrRegion: string;
  postalCode: string | null;
  countryCode: string;
  timeZone: string;
  latitude: number | null;
  longitude: number | null;
  coordinateQuality: "VERIFIED" | "ESTIMATED" | "MISSING";
  approachRadiusMeters: number;
  visitRadiusMeters: number;
  exitRadiusMeters: number;
  active: boolean;
  source: string;
  sourceVersion: string;
  verifiedAt: string | null;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
  createdAt: string;
  updatedAt: string;
}

export interface NearbyBranch {
  branch: Branch;
  distanceMeters: number;
}

export interface NearbyBranchesPayload {
  tenantId: TenantId;
  applicationId: ApplicationId;
  configurationVersion: string;
  generatedAt: string;
  query: {
    latitude: number;
    longitude: number;
    radiusKm: number;
    limit: number;
  };
  branches: NearbyBranch[];
}

export type SignedNearbyBranchesResponse = SignedPayload<NearbyBranchesPayload>;

interface VisitEventBase {
  eventId: EventId;
  tenantId: TenantId;
  applicationId: ApplicationId;
  anonymousInstallationId: string;
  branchId: BranchId;
  visitToken: VisitToken;
  occurredAt: string;
  configurationVersion: string;
  demo: boolean;
}

export interface VisitStartedEvent extends VisitEventBase {
  eventType: "VISIT_STARTED";
  startedAt: string;
  startSource: "CUSTOMER_CONFIRMED" | "DWELL_CONFIRMED" | "HOST_APP_CONFIRMED";
  startAccuracyMeters: number | null;
  measurementConfidence: MeasurementConfidence;
}

export interface VisitCompletedEvent extends VisitEventBase {
  eventType: "VISIT_COMPLETED";
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  startSource: "CUSTOMER_CONFIRMED" | "DWELL_CONFIRMED" | "HOST_APP_CONFIRMED";
  endSource: "GEOFENCE_EXIT" | "MANUAL_EXIT" | "HOST_APP_EXIT";
  endAccuracyMeters: number | null;
  measurementConfidence: MeasurementConfidence;
}

export type VisitEvent = VisitStartedEvent | VisitCompletedEvent;

export interface EncryptedPayload {
  algorithm: "AES-256-GCM";
  ciphertext: string;
  iv: string;
  authTag: string;
  encryptedDataKey: string;
  keyId: string;
}

export interface DeliveryEnvelope {
  eventId: EventId;
  tenantId: TenantId;
  applicationId: ApplicationId;
  anonymousInstallationId: string;
  visitToken: VisitToken;
  branchId: BranchId;
  routeKey: string;
  encryptedPayload: EncryptedPayload;
  payloadHash: string;
  payloadSizeBytes: number;
  createdAt: string;
  expiresAt: string;
}

export type DeliveryState =
  | "ACCEPTED"
  | "VALIDATED"
  | "QUEUED"
  | "DELIVERING"
  | "RETRYING"
  | "DELIVERED"
  | "FAILED"
  | "EXPIRED"
  | "DEAD_LETTERED";

export interface DeliveryReceipt {
  eventId: EventId;
  tenantId: TenantId;
  destinationId: string;
  state: DeliveryState;
  attemptCount: number;
  acceptedAt: string;
  deliveredAt: string | null;
  receiverReference: string | null;
  latencyMilliseconds: number | null;
}

export type CorriState =
  | "DISABLED"
  | "MONITORING"
  | "APPROACH_CANDIDATE"
  | "PROMPT_PENDING"
  | "COOLDOWN"
  | "LONG_COOLDOWN"
  | "VISIT_ACTIVE"
  | "EXIT_PENDING"
  | "COMPLETED"
  | "EXPIRED";
