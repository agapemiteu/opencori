import {
  deliveryEnvelopeSchema,
  eventIdSchema,
  tenantIdSchema,
  type DeliveryReceipt,
} from "@corri/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from "@nestjs/common";

import { DeliveryService } from "./delivery.service.js";

@Controller("sdk/deliveries")
export class DeliveryController {
  constructor(@Inject(DeliveryService) private readonly deliveries: DeliveryService) {}

  @Post()
  async deliver(@Body() body: unknown): Promise<DeliveryReceipt> {
    const parsed = deliveryEnvelopeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return this.deliveries.deliver(parsed.data);
  }

  @Get(":eventId")
  getReceipt(
    @Param("eventId") eventIdInput: string,
    @Query("tenantId") tenantIdInput: string,
  ): DeliveryReceipt {
    const eventId = eventIdSchema.safeParse(eventIdInput);
    const tenantId = tenantIdSchema.safeParse(tenantIdInput);
    if (!eventId.success || !tenantId.success) {
      throw new BadRequestException();
    }
    return this.deliveries.getReceipt(tenantId.data, eventId.data);
  }
}
