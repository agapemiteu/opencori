import {
  visitEventSchema,
  type DemoAnalyticsResponse,
  type PrivacyProofResponse,
  type VisitEventIngestionReceipt,
} from "@opencori/contracts";
import { BadRequestException, Body, Controller, Get, Inject, Post } from "@nestjs/common";

import { VisitEventService } from "./visit-event.service.js";

@Controller()
export class VisitEventsController {
  constructor(@Inject(VisitEventService) private readonly visits: VisitEventService) {}

  @Post("sdk/visits/events")
  record(@Body() body: unknown): VisitEventIngestionReceipt {
    const parsed = visitEventSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return this.visits.record(parsed.data);
  }

  @Get("analytics")
  analytics(): DemoAnalyticsResponse {
    return this.visits.analytics();
  }

  @Get("privacy")
  privacyProof(): PrivacyProofResponse {
    return this.visits.privacyProof();
  }
}
