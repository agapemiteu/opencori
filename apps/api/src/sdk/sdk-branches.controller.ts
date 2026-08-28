import { nearbyBranchesQuerySchema, type SignedNearbyBranchesResponse } from "@opencori/contracts";
import { BadRequestException, Controller, Get, Inject, Query } from "@nestjs/common";

import { NearbyBranchesService } from "./nearby-branches.service.js";

@Controller("sdk/branches")
export class SdkBranchesController {
  constructor(@Inject(NearbyBranchesService) private readonly nearby: NearbyBranchesService) {}

  @Get("nearby")
  async findNearby(@Query() query: Record<string, unknown>): Promise<SignedNearbyBranchesResponse> {
    const parsed = nearbyBranchesQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return this.nearby.findNearby(parsed.data);
  }
}
