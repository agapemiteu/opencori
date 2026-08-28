import { Module } from "@nestjs/common";

import { ApiKeyGuard } from "./catalog/api-key.guard.js";
import { CatalogController } from "./catalog/catalog.controller.js";
import {
  CATALOG_REPOSITORY,
  InMemoryCatalogRepository,
  type CatalogRepository,
} from "./catalog/catalog.repository.js";
import { PostgresCatalogRepository } from "./catalog/postgres-catalog.repository.js";
import { CatalogService } from "./catalog/catalog.service.js";
import { EnvironmentService } from "./config/environment.js";
import { DELIVERY_DESTINATION, WemaWebhookDestination } from "./delivery/delivery-destination.js";
import { DELIVERY_REPOSITORY, InMemoryDeliveryRepository } from "./delivery/delivery.repository.js";
import { DeliveryService } from "./delivery/delivery.service.js";
import { DeliveryController } from "./delivery/delivery.controller.js";
import { CatalogReadService } from "./catalog/catalog-read.service.js";
import { CatalogReadController } from "./catalog/catalog-read.controller.js";
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
    CatalogController,
    CatalogReadController,
    DeliveryController,
    HealthController,
    SdkBranchesController,
    SdkConfigurationController,
    VisitEventsController,
  ],
  providers: [
    ApiKeyGuard,
    CatalogService,
    CatalogReadService,
    DeliveryService,
    EnvironmentService,
    HealthService,
    NearbyBranchesService,
    VisitEventService,
    {
      // One instance behind one token, so a location onboarded through the
      // write API is immediately visible to the read endpoints and to nearby
      // lookups.
      //
      // Without DATABASE_URL the catalog is in memory: no configuration, no
      // database, which is what `pnpm dev` and the tests want. Set it and the
      // catalog becomes durable, with no other change anywhere.
      provide: CATALOG_REPOSITORY,
      useFactory: async (environment: EnvironmentService): Promise<CatalogRepository> => {
        const connectionString = environment.values.DATABASE_URL;
        if (connectionString === undefined) {
          return new InMemoryCatalogRepository();
        }
        const repository = new PostgresCatalogRepository(connectionString);
        await repository.initialize();
        return repository;
      },
      inject: [EnvironmentService],
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
