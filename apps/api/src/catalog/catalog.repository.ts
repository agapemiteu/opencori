import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type {
  Application,
  Branch,
  BranchInput,
  GeofencePolicy,
  Tenant,
  UpdateBranchRequest,
} from "@opencori/contracts";
import { Injectable } from "@nestjs/common";

import { alatDemoApplication, wemaDemoBranches, wemaDemoTenant } from "../demo/demo-seed.js";

export const CATALOG_REPOSITORY = Symbol("OPENCORI_CATALOG_REPOSITORY");

export interface UpsertOutcome {
  readonly created: number;
  readonly updated: number;
}

/**
 * What the read path needs. Delivery, visit events, and nearby lookups only
 * ever ask questions, so they depend on this rather than the full repository —
 * a narrower contract to implement when swapping the store, and a much smaller
 * thing to fake in a test.
 */
export interface CatalogReader {
  getTenant(tenantId: string): Promise<Tenant | undefined>;
  getApplication(tenantId: string, applicationId: string): Promise<Application | undefined>;
  listBranches(tenantId: string): Promise<readonly Branch[]>;
}

/**
 * The catalog is the organisation's own configuration: who they are, which
 * application talks to us, and which locations to watch. None of it is customer
 * data, which is why it can be stored at all.
 */
export interface CatalogRepository extends CatalogReader {
  createTenant(tenant: Tenant, apiKeyHash: string): Promise<void>;
  /** The tenant this key authenticates, or undefined if it authenticates none. */
  findTenantIdByApiKey(apiKey: string): Promise<string | undefined>;

  createApplication(application: Application): Promise<void>;
  getPolicy(tenantId: string, applicationId: string): Promise<GeofencePolicy | undefined>;
  setPolicy(tenantId: string, applicationId: string, policy: GeofencePolicy): Promise<void>;

  upsertBranches(
    tenantId: string,
    branches: readonly BranchInput[],
    now: Date,
  ): Promise<UpsertOutcome>;
  getBranch(tenantId: string, branchId: string): Promise<Branch | undefined>;
  updateBranch(
    tenantId: string,
    branchId: string,
    update: UpdateBranchRequest,
    now: Date,
  ): Promise<Branch | undefined>;
}

export function generateApiKey(): string {
  // 32 bytes of base64url. Prefixed so a leaked key is recognisable in a log.
  return `oc_${randomBytes(32).toString("base64url")}`;
}

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

/** Compares two hex digests without leaking their difference through timing. */
function hashesMatch(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function applicationKey(tenantId: string, applicationId: string): string {
  return `${tenantId} ${applicationId}`;
}

/**
 * Holds the catalog in memory, seeded with the demo tenant so the existing
 * demo endpoints keep answering.
 *
 * This does not survive a restart. Onboarding a real organisation needs a
 * durable implementation of this interface; the seam exists so that swap is the
 * only change required.
 */
@Injectable()
export class InMemoryCatalogRepository implements CatalogRepository {
  readonly #tenants = new Map<string, Tenant>();
  readonly #apiKeyHashes = new Map<string, string>();
  readonly #applications = new Map<string, Application>();
  readonly #policies = new Map<string, GeofencePolicy>();
  readonly #branches = new Map<string, Map<string, Branch>>();

  constructor() {
    this.#tenants.set(wemaDemoTenant.id, wemaDemoTenant);
    this.#applications.set(
      applicationKey(alatDemoApplication.tenantId, alatDemoApplication.id),
      alatDemoApplication,
    );
    this.#branches.set(
      wemaDemoTenant.id,
      new Map(wemaDemoBranches.map((branch) => [branch.id, branch])),
    );
  }

  async getTenant(tenantId: string): Promise<Tenant | undefined> {
    return this.#tenants.get(tenantId);
  }

  async getApplication(tenantId: string, applicationId: string): Promise<Application | undefined> {
    return this.#applications.get(applicationKey(tenantId, applicationId));
  }

  async listBranches(tenantId: string): Promise<readonly Branch[]> {
    const branches = this.#branches.get(tenantId);
    return branches === undefined ? [] : [...branches.values()];
  }

  async createTenant(tenant: Tenant, apiKeyHash: string): Promise<void> {
    this.#tenants.set(tenant.id, tenant);
    this.#apiKeyHashes.set(tenant.id, apiKeyHash);
    this.#branches.set(tenant.id, new Map());
  }

  async findTenantIdByApiKey(apiKey: string): Promise<string | undefined> {
    const candidate = hashApiKey(apiKey);
    for (const [tenantId, storedHash] of this.#apiKeyHashes) {
      if (hashesMatch(candidate, storedHash)) {
        return tenantId;
      }
    }
    return undefined;
  }

  async createApplication(application: Application): Promise<void> {
    this.#applications.set(applicationKey(application.tenantId, application.id), application);
  }

  async getPolicy(tenantId: string, applicationId: string): Promise<GeofencePolicy | undefined> {
    return this.#policies.get(applicationKey(tenantId, applicationId));
  }

  async setPolicy(tenantId: string, applicationId: string, policy: GeofencePolicy): Promise<void> {
    this.#policies.set(applicationKey(tenantId, applicationId), policy);
  }

  async upsertBranches(
    tenantId: string,
    branches: readonly BranchInput[],
    now: Date,
  ): Promise<UpsertOutcome> {
    let stored = this.#branches.get(tenantId);
    if (stored === undefined) {
      stored = new Map();
      this.#branches.set(tenantId, stored);
    }

    const timestamp = now.toISOString();
    let created = 0;
    let updated = 0;

    for (const input of branches) {
      const existing = stored.get(input.id);
      stored.set(input.id, {
        ...input,
        tenantId,
        // Re-uploading the same file keeps the original creation time, so the
        // catalog records when a location was first registered, not last sent.
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      } as Branch);
      if (existing === undefined) {
        created += 1;
      } else {
        updated += 1;
      }
    }

    return { created, updated };
  }

  async getBranch(tenantId: string, branchId: string): Promise<Branch | undefined> {
    return this.#branches.get(tenantId)?.get(branchId);
  }

  async updateBranch(
    tenantId: string,
    branchId: string,
    update: UpdateBranchRequest,
    now: Date,
  ): Promise<Branch | undefined> {
    const stored = this.#branches.get(tenantId);
    const existing = stored?.get(branchId);
    if (stored === undefined || existing === undefined) {
      return undefined;
    }

    const next: Branch = {
      ...existing,
      ...update,
      updatedAt: now.toISOString(),
    } as Branch;
    stored.set(branchId, next);
    return next;
  }
}
