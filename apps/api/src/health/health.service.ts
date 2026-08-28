import { healthResponseSchema, type HealthResponse } from "@opencori/contracts";
import { Inject, Injectable } from "@nestjs/common";

import { EnvironmentService } from "../config/environment.js";
import { CLOCK, type Clock } from "../platform/clock.js";

@Injectable()
export class HealthService {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(EnvironmentService) private readonly environment: EnvironmentService,
  ) {}

  getHealth(): HealthResponse {
    return healthResponseSchema.parse({
      status: "ok",
      service: "corri-control-api",
      version: this.environment.values.CORRI_SERVICE_VERSION,
      timestamp: this.clock.now().toISOString(),
    });
  }
}
