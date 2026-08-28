import {
  createApplicationRequestSchema,
  createTenantRequestSchema,
  updateApplicationPolicyRequestSchema,
  updateBranchRequestSchema,
  upsertBranchesRequestSchema,
  type Application,
  type Branch,
  type CreateTenantResponse,
  type GeofencePolicy,
  type UpsertBranchesResponse,
} from "@opencori/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";

import { ApiKeyGuard } from "./api-key.guard.js";
import { CatalogService } from "./catalog.service.js";

/**
 * Onboarding: how an organisation registers itself and the locations it wants
 * watched.
 *
 * Creating a tenant is deliberately unguarded — it is the call that issues the
 * first API key, so there is nothing to authenticate with yet. Everything
 * below it is guarded, and the guard also checks that the key belongs to the
 * tenant named in the path.
 */
@Controller("tenants")
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Post()
  async createTenant(@Body() body: unknown): Promise<CreateTenantResponse> {
    const parsed = createTenantRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return this.catalog.createTenant(parsed.data);
  }

  @Post(":tenantId/applications")
  @UseGuards(ApiKeyGuard)
  async createApplication(
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ): Promise<Application> {
    const parsed = createApplicationRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return this.catalog.createApplication(tenantId, parsed.data);
  }

  @Get(":tenantId/applications/:applicationId/policy")
  @UseGuards(ApiKeyGuard)
  async getPolicy(
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
  ): Promise<GeofencePolicy> {
    return this.catalog.getPolicy(tenantId, applicationId);
  }

  /** Where the visit timer and the cooldowns are set. */
  @Put(":tenantId/applications/:applicationId/policy")
  @UseGuards(ApiKeyGuard)
  async setPolicy(
    @Param("tenantId") tenantId: string,
    @Param("applicationId") applicationId: string,
    @Body() body: unknown,
  ): Promise<GeofencePolicy> {
    const parsed = updateApplicationPolicyRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return this.catalog.setPolicy(tenantId, applicationId, parsed.data.policy);
  }

  /**
   * Bulk upload. Idempotent by branch id, so an organisation can re-send its
   * whole location file and only the changed rows move.
   */
  @Put(":tenantId/branches")
  @HttpCode(200)
  @UseGuards(ApiKeyGuard)
  async upsertBranches(
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ): Promise<UpsertBranchesResponse> {
    const parsed = upsertBranchesRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return this.catalog.upsertBranches(tenantId, parsed.data);
  }

  @Get(":tenantId/branches")
  @UseGuards(ApiKeyGuard)
  async listBranches(
    @Param("tenantId") tenantId: string,
  ): Promise<{ branches: readonly Branch[] }> {
    return { branches: await this.catalog.listBranches(tenantId) };
  }

  @Patch(":tenantId/branches/:branchId")
  @UseGuards(ApiKeyGuard)
  async updateBranch(
    @Param("tenantId") tenantId: string,
    @Param("branchId") branchId: string,
    @Body() body: unknown,
  ): Promise<Branch> {
    const parsed = updateBranchRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return this.catalog.updateBranch(tenantId, branchId, parsed.data);
  }
}
