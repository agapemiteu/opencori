import { Module } from "@nestjs/common";

import { EnvironmentService } from "./config/environment.js";
import { DELIVERY_DESTINATION, WemaWebhookDestination } from "./delivery/delivery-destination.js";
import { DELIVERY_REPOSITORY, InMemoryDeliveryRepository } from "./delivery/delivery.repository.js";
import { DeliveryService } from "./delivery/delivery.service.js";
import { DeliveryController } from "./delivery/delivery.controller.js";
import {
  DEMO_CATALOG_REPOSITORY,
  SeededDemoCatalogRepository,
} from "./demo/demo-catalog.repository.js";
import { DemoCatalogService } from "./demo/demo-catalog.service.js";
import { DemoController } from "./demo/demo.controller.js";
import { HealthController } from "./health/health.controller.js";
import { HealthService } from "./health/health.service.js";
import { CLOCK, SystemClock } from "./platform/clock.js";
import { NearbyBranchesService } from "./sdk/nearby-branches.service.js";
import { SdkBranchesController } from "./sdk/sdk-branches.controller.js";
import { SdkConfigurationController } from "./sdk/sdk-configuration.controller.js";
import {
  InMemoryVisitEventRepository,
  VISIT_EVENT_REPOSITORY,
} from "./visits/visit-event.repository.js";
import { VisitEventService } from "./visits/visit-event.service.js";
import { VisitEventsController } from "./visits/visit-events.controller.js";

@Module({
  controllers: [
    DemoController,
    DeliveryController,
    HealthController,
    SdkBranchesController,
    SdkConfigurationController,
    VisitEventsController,
  ],
  providers: [
    DemoCatalogService,
    DeliveryService,
    EnvironmentService,
    HealthService,
    NearbyBranchesService,
    VisitEventService,
    {
      provide: DEMO_CATALOG_REPOSITORY,
      useClass: SeededDemoCatalogRepository,
    },
    {
      provide: DELIVERY_DESTINATION,
      useClass: WemaWebhookDestination,
    },
    {
      provide: DELIVERY_REPOSITORY,
      useClass: InMemoryDeliveryRepository,
    },
    {
      provide: VISIT_EVENT_REPOSITORY,
      useClass: InMemoryVisitEventRepository,
    },
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
  ],
})
export class AppModule {}
