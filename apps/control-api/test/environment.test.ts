import { describe, expect, it } from "vitest";

import { parseEnvironment } from "../src/config/environment.js";

describe("parseEnvironment", () => {
  it("applies safe local defaults", () => {
    expect(parseEnvironment({})).toEqual({
      CORRI_HOST: "0.0.0.0",
      CORRI_PORT: 3_000,
      CORRI_SERVICE_VERSION: "0.0.0",
      NODE_ENV: "development",
    });
  });

  it("coerces a valid port and rejects an invalid port", () => {
    expect(parseEnvironment({ CORRI_PORT: "8080" }).CORRI_PORT).toBe(8_080);
    expect(() => parseEnvironment({ CORRI_PORT: "70000" })).toThrow();
  });
});
