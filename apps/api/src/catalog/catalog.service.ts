import {
  applicationSchema,
  branchSchema,
  createTenantResponseSchema,
  tenantSchema,
  upsertBranchesResponseSchema,
  type Application,
  type Branch,
  type CreateApplicationRequest,
  type CreateTenantRequest,
  type CreateTenantResponse,
  type GeofencePolicy,
  type UpdateBranchRequest,
  type UpsertBranchesRequest,
  type UpsertBranchesResponse,
} from "@opencori/contracts";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { CLOCK, type Clock } from "../platform/clock.js";
import {
  CATALOG_REPOSITORY,
  generateApiKey,
  hashApiKey,
  type CatalogRepository,
} from "./catalog.repository.js";

/**
 * The policy an application gets when it does not supply one. These are the
 * values the demo has always used, promoted from a hard-coded literal to a
 * documented default.
 */
export const DEFAULT_POLICY: GeofencePolicy = {
  approachRadiusMeters: 250,
  visitRadiusMeters: 100,
  exitRadiusMeters: 150,
  exitGraceSeconds: 30,
  notNowCooldownSeconds: 300,
  notVisitingCooldownSeconds: 86_400,
  maximumVisitDurationSeconds: 14_400,
  minimumAccuracyMeters: 50,
  startPolicy: "CUSTOMER_CONFIRMED",
  endPolicy: "STABLE_GEOFENCE_EXIT",
};

@Injectable()
export class CatalogService {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly repository: CatalogRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  createTenant(request: CreateTenantRequest): CreateTenantResponse {
    if (this.repository.getTenant(request.id) !== undefined) {
      throw new ConflictException();
    }

    const timestamp = this.clock.now().toISOString();
    const tenant = tenantSchema.parse({
      id: request.id,
      name: request.name,
      demo: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // Returned now and never again: only the hash is kept.
    const apiKey = generateApiKey();
    this.repository.createTenant(tenant, hashApiKey(apiKey));

    return createTenantResponseSchema.parse({
      tenantId: tenant.id,
      name: tenant.name,
      apiKey,
      createdAt: timestamp,
    });
  }

  createApplication(tenantId: string, request: CreateApplicationRequest): Application {
    if (this.repository.getTenant(tenantId) === undefined) {
      throw new NotFoundException();
    }
    if (this.repository.getApplication(tenantId, request.id) !== undefined) {
      throw new ConflictException();
    }

    const timestamp = this.clock.now().toISOString();
    const application = applicationSchema.parse({
      id: request.id,
      tenantId,
      name: request.name,
      publicApplicationKey: request.publicApplicationKey,
      configurationSigningKeyId: request.configurationSigningKeyId,
      configurationSigningPublicKey: request.configurationSigningPublicKey,
      receiverEncryptionKeyId: request.receiverEncryptionKeyId,
      receiverEncryptionPublicKey: request.receiverEncryptionPublicKey,
      active: true,
      demo: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    this.repository.createApplication(application);
    this.repository.setPolicy(tenantId, application.id, request.policy ?? DEFAULT_POLICY);
    return application;
  }

  getPolicy(tenantId: string, applicationId: string): GeofencePolicy {
    if (this.repository.getApplication(tenantId, applicationId) === undefined) {
      throw new NotFoundException();
    }
    return this.repository.getPolicy(tenantId, applicationId) ?? DEFAULT_POLICY;
  }

  setPolicy(tenantId: string, applicationId: string, policy: GeofencePolicy): GeofencePolicy {
    if (this.repository.getApplication(tenantId, applicationId) === undefined) {
      throw new NotFoundException();
    }
    this.repository.setPolicy(tenantId, applicationId, policy);
    return policy;
  }

  upsertBranches(tenantId: string, request: UpsertBranchesRequest): UpsertBranchesResponse {
    if (this.repository.getTenant(tenantId) === undefined) {
      throw new NotFoundException();
    }

    const outcome = this.repository.upsertBranches(tenantId, request.branches, this.clock.now());

    return upsertBranchesResponseSchema.parse({
      tenantId,
      created: outcome.created,
      updated: outcome.updated,
      total: this.repository.listBranches(tenantId).length,
    });
  }

  listBranches(tenantId: string): readonly Branch[] {
    if (this.repository.getTenant(tenantId) === undefined) {
      throw new NotFoundException();
    }
    return this.repository.listBranches(tenantId);
  }

  updateBranch(tenantId: string, branchId: string, update: UpdateBranchRequest): Branch {
    if (this.repository.getTenant(tenantId) === undefined) {
      throw new NotFoundException();
    }

    const existing = this.repository.getBranch(tenantId, branchId);
    if (existing === undefined) {
      throw new NotFoundException();
    }

    // Validated before it is stored, not after. A patch is individually valid
    // yet can still invert the radius ordering once merged — an exit radius
    // below the existing visit radius, say — and that is the caller's mistake,
    // so it has to be a 400 rather than a 500 from a write that already landed.
    const candidate = branchSchema.safeParse({
      ...existing,
      ...update,
      updatedAt: this.clock.now().toISOString(),
    });
    if (!candidate.success) {
      throw new BadRequestException();
    }

    const updated = this.repository.updateBranch(tenantId, branchId, update, this.clock.now());
    if (updated === undefined) {
      throw new NotFoundException();
    }
    return updated;
  }
}
