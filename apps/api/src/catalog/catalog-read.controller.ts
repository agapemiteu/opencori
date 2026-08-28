import type {
  DemoBranchesResponse,
  DemoCatalogResponse,
  SignedConfiguration,
} from "@opencori/contracts";
import { z } from "zod";
import { BadRequestException, Body, Controller, Get, Inject, Post } from "@nestjs/common";

import { CatalogReadService } from "./catalog-read.service.js";

const publishRequestSchema = z
  .object({
    tenantId: z.literal("wema"),
    applicationId: z.literal("alat-demo"),
  })
  .strict();

@Controller()
export class CatalogReadController {
  constructor(@Inject(CatalogReadService) private readonly catalog: CatalogReadService) {}

  // The demo/ paths are what the currently deployed client calls. Kept as
  // aliases so the API and its clients can be released independently rather
  // than having to land in the same minute.
  @Get(["catalog", "demo/catalog"])
  async getCatalog(): Promise<DemoCatalogResponse> {
    return this.catalog.getCatalog();
  }

  @Get(["branches", "demo/branches"])
  async getBranches(): Promise<DemoBranchesResponse> {
    return this.catalog.getBranches();
  }

  @Post(["configurations/publish", "demo/configurations/publish"])
  async publishConfiguration(@Body() body: unknown): Promise<SignedConfiguration> {
    const parsed = publishRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return this.catalog.publishConfiguration(parsed.data.tenantId, parsed.data.applicationId);
  }
}
