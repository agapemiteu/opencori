import "reflect-metadata";

import { createReceiverApplication } from "./application.js";

// Hosts such as Render assign the port at runtime through PORT. Fall back to
// 3001 so local development and the README stay unchanged.
const port = Number(process.env.WEMA_RECEIVER_PORT ?? process.env.PORT ?? 3_001);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new RangeError(`Invalid receiver port: ${String(port)}`);
}

const app = await createReceiverApplication();
await app.listen(port, "0.0.0.0");
