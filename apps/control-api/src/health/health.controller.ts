import type { HealthResponse } from "@corri/contracts";
import { Controller, Get, Inject } from "@nestjs/common";

import { HealthService } from "./health.service.js";

@Controller("health")
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  getHealth(): HealthResponse {
    return this.healthService.getHealth();
  }
}
