import { Module } from "@nestjs/common";

import {
  CORRI_DEMO_WEBHOOK_SIGNING_KEY_ID,
  CORRI_DEMO_WEBHOOK_SIGNING_PUBLIC_KEY,
  WEMA_DEMO_ENCRYPTION_KEY_ID,
  WEMA_DEMO_ENCRYPTION_PRIVATE_KEY,
} from "./demo-keys.js";
import { ReceiverController } from "./receiver.controller.js";
import { RECEIVER_SETTINGS, ReceiverService } from "./receiver.service.js";

@Module({
  controllers: [ReceiverController],
  providers: [
    ReceiverService,
    {
      provide: RECEIVER_SETTINGS,
      useValue: {
        expectedTenantId: "wema",
        expectedApplicationId: "alat-demo",
        expectedDestinationId: "wema_mock_receiver",
        webhookSigningKeyId: CORRI_DEMO_WEBHOOK_SIGNING_KEY_ID,
        webhookSigningPublicKey: CORRI_DEMO_WEBHOOK_SIGNING_PUBLIC_KEY,
        encryptionKeyId: WEMA_DEMO_ENCRYPTION_KEY_ID,
        encryptionPrivateKey: WEMA_DEMO_ENCRYPTION_PRIVATE_KEY,
        now: () => new Date(),
      },
    },
  ],
})
export class AppModule {}
