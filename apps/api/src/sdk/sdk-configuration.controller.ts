import type { SignedConfiguration } from "@opencori/contracts";
import { BadRequestException, Controller, Get, Inject, Query } from "@nestjs/common";
import { z } from "zod";

import { CatalogReadService } from "../catalog/catalog-read.service.js";

const configurationQuerySchema = z
  .object({
    tenantId: z.literal("wema"),
    applicationId: z.literal("alat-demo"),
  })
  .strict();

@Controller("sdk/configuration")
export class SdkConfigurationController {
  constructor(@Inject(CatalogReadService) private readonly catalog: CatalogReadService) {}

  @Get()
  getConfiguration(@Query() query: Record<string, unknown>): Promise<SignedConfiguration> {
    const parsed = configurationQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return this.catalog.publishConfiguration(parsed.data.tenantId, parsed.data.applicationId);
  }
}
