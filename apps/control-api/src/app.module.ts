import { Module } from "@nestjs/common";

import { EnvironmentService } from "./config/environment.js";
import { HealthController } from "./health/health.controller.js";
import { HealthService } from "./health/health.service.js";
import { CLOCK, SystemClock } from "./platform/clock.js";

@Module({
  controllers: [HealthController],
  providers: [
    EnvironmentService,
    HealthService,
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
  ],
})
export class AppModule {}
