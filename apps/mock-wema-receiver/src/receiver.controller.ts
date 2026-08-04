import type { ReceiverAcknowledgement } from "@corri/contracts";
import { Body, Controller, Get, Inject, Post } from "@nestjs/common";

import { ReceiverService, type ReceivedWemaMessage } from "./receiver.service.js";

@Controller("wema")
export class ReceiverController {
  constructor(@Inject(ReceiverService) private readonly receiver: ReceiverService) {}

  @Post("deliveries")
  receive(@Body() body: unknown): ReceiverAcknowledgement {
    return this.receiver.receive(body);
  }

  @Get("messages")
  messages(): readonly ReceivedWemaMessage[] {
    return this.receiver.listMessages();
  }
}
