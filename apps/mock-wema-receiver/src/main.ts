import "reflect-metadata";

import { createReceiverApplication } from "./application.js";

const app = await createReceiverApplication();
await app.listen(3_001, "0.0.0.0");
