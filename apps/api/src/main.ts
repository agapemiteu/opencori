import "reflect-metadata";

import { EnvironmentService } from "./config/environment.js";
import { createApplication } from "./application.js";

async function bootstrap(): Promise<void> {
  const app = await createApplication();
  const environment = app.get(EnvironmentService).values;
  await app.listen(environment.CORRI_PORT, environment.CORRI_HOST);
}

bootstrap().catch((error: unknown) => {
  const errorName = error instanceof Error ? error.name : "UnknownError";
  console.error(`Control API failed to start: ${errorName}`);
  process.exitCode = 1;
});
