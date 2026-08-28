import type {
  DemoBranchesResponse,
  DemoCatalogResponse,
  SignedConfiguration,
} from "@opencori/contracts";
import { z } from "zod";
import { BadRequestException, Body, Controller, Get, Inject, Post } from "@nestjs/common";

import { DemoCatalogService } from "./demo-catalog.service.js";

const publishRequestSchema = z
  .object({
    tenantId: z.literal("wema"),
    applicationId: z.literal("alat-demo"),
  })
  .strict();

@Controller()
export class DemoController {
  constructor(@Inject(DemoCatalogService) private readonly catalog: DemoCatalogService) {}

  @Get("catalog")
  async getCatalog(): Promise<DemoCatalogResponse> {
    return this.catalog.getCatalog();
  }

  @Get("branches")
  async getBranches(): Promise<DemoBranchesResponse> {
    return this.catalog.getBranches();
  }

  @Post("configurations/publish")
  async publishConfiguration(@Body() body: unknown): Promise<SignedConfiguration> {
    const parsed = publishRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return this.catalog.publishConfiguration(parsed.data.tenantId, parsed.data.applicationId);
  }
}
