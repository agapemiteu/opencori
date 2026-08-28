import { generateKeyPairSync } from "node:crypto";

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

  async createTenant(request: CreateTenantRequest): Promise<CreateTenantResponse> {
    if ((await this.repository.getTenant(request.id)) !== undefined) {
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
    await this.repository.createTenant(tenant, hashApiKey(apiKey));

    return createTenantResponseSchema.parse({
      tenantId: tenant.id,
      name: tenant.name,
      apiKey,
      createdAt: timestamp,
    });
  }

  async createApplication(
    tenantId: string,
    request: CreateApplicationRequest,
  ): Promise<Application> {
    if ((await this.repository.getTenant(tenantId)) === undefined) {
      throw new NotFoundException();
    }
    if ((await this.repository.getApplication(tenantId, request.id)) !== undefined) {
      throw new ConflictException();
    }

    const timestamp = this.clock.now().toISOString();

    // OpenCori issues the configuration signing key rather than accepting one.
    // Signing needs the private half, so a caller-supplied public key would
    // leave nothing able to sign as this application. The public half is
    // returned once here and is what the client pins.
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const configurationSigningKeyId = `${tenantId}-${request.id}-config-key`;

    const application = applicationSchema.parse({
      id: request.id,
      tenantId,
      name: request.name,
      publicApplicationKey: request.publicApplicationKey,
      configurationSigningKeyId,
      configurationSigningPublicKey: publicKey.export({ type: "spki", format: "pem" }).toString(),
      receiverEncryptionKeyId: request.receiverEncryptionKeyId,
      receiverEncryptionPublicKey: request.receiverEncryptionPublicKey,
      active: true,
      demo: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await this.repository.createApplication(
      application,
      privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    );
    await this.repository.setPolicy(tenantId, application.id, request.policy ?? DEFAULT_POLICY);
    return application;
  }

  async getPolicy(tenantId: string, applicationId: string): Promise<GeofencePolicy> {
    if ((await this.repository.getApplication(tenantId, applicationId)) === undefined) {
      throw new NotFoundException();
    }
    return (await this.repository.getPolicy(tenantId, applicationId)) ?? DEFAULT_POLICY;
  }

  async setPolicy(
    tenantId: string,
    applicationId: string,
    policy: GeofencePolicy,
  ): Promise<GeofencePolicy> {
    if ((await this.repository.getApplication(tenantId, applicationId)) === undefined) {
      throw new NotFoundException();
    }
    await this.repository.setPolicy(tenantId, applicationId, policy);
    return policy;
  }

  async upsertBranches(
    tenantId: string,
    request: UpsertBranchesRequest,
  ): Promise<UpsertBranchesResponse> {
    if ((await this.repository.getTenant(tenantId)) === undefined) {
      throw new NotFoundException();
    }

    const outcome = await this.repository.upsertBranches(
      tenantId,
      request.branches,
      this.clock.now(),
    );

    return upsertBranchesResponseSchema.parse({
      tenantId,
      created: outcome.created,
      updated: outcome.updated,
      total: (await this.repository.listBranches(tenantId)).length,
    });
  }

  async listBranches(tenantId: string): Promise<readonly Branch[]> {
    if ((await this.repository.getTenant(tenantId)) === undefined) {
      throw new NotFoundException();
    }
    return await this.repository.listBranches(tenantId);
  }

  async updateBranch(
    tenantId: string,
    branchId: string,
    update: UpdateBranchRequest,
  ): Promise<Branch> {
    if ((await this.repository.getTenant(tenantId)) === undefined) {
      throw new NotFoundException();
    }

    const existing = await this.repository.getBranch(tenantId, branchId);
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

    const updated = await this.repository.updateBranch(
      tenantId,
      branchId,
      update,
      this.clock.now(),
    );
    if (updated === undefined) {
      throw new NotFoundException();
    }
    return updated;
  }
}
