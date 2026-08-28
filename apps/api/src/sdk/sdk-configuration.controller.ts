import type { SignedConfiguration } from "@corri/contracts";
import { BadRequestException, Controller, Get, Inject, Query } from "@nestjs/common";
import { z } from "zod";

import { DemoCatalogService } from "../demo/demo-catalog.service.js";

const configurationQuerySchema = z
  .object({
    tenantId: z.literal("wema"),
    applicationId: z.literal("alat-demo"),
  })
  .strict();

@Controller("sdk/configuration")
export class SdkConfigurationController {
  constructor(@Inject(DemoCatalogService) private readonly catalog: DemoCatalogService) {}

  @Get()
  getConfiguration(@Query() query: Record<string, unknown>): SignedConfiguration {
    const parsed = configurationQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return this.catalog.publishConfiguration(parsed.data.tenantId, parsed.data.applicationId);
  }
}
