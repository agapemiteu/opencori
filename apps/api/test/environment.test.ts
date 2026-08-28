import { describe, expect, it } from "vitest";

import { parseEnvironment } from "../src/config/environment.js";

describe("parseEnvironment", () => {
  it("applies safe local defaults", () => {
    expect(parseEnvironment({})).toEqual({
      CORRI_HOST: "0.0.0.0",
      CORRI_PORT: 3_000,
      CORRI_SERVICE_VERSION: "0.0.0",
      CORRI_CORS_ORIGINS: ["http://localhost:3002"],
      WEMA_DEMO_WEBHOOK_URL: "http://127.0.0.1:3001/v1/wema/deliveries",
      WEMA_DEMO_WEBHOOK_TIMEOUT_MS: 10_000,
      WEMA_DEMO_WEBHOOK_RETRIES: 0,
      WEMA_DEMO_WEBHOOK_RETRY_DELAY_MS: 2_000,
      NODE_ENV: "development",
    });
  });

  it("accepts a longer webhook timeout for hosts that suspend idle services", () => {
    expect(
      parseEnvironment({ WEMA_DEMO_WEBHOOK_TIMEOUT_MS: "60000" }).WEMA_DEMO_WEBHOOK_TIMEOUT_MS,
    ).toBe(60_000);
    expect(() => parseEnvironment({ WEMA_DEMO_WEBHOOK_TIMEOUT_MS: "500" })).toThrow();
  });

  it("coerces a valid port and rejects an invalid port", () => {
    expect(parseEnvironment({ CORRI_PORT: "8080" }).CORRI_PORT).toBe(8_080);
    expect(() => parseEnvironment({ CORRI_PORT: "70000" })).toThrow();
  });

  it("falls back to a host-assigned PORT but lets CORRI_PORT win", () => {
    expect(parseEnvironment({ PORT: "10000" }).CORRI_PORT).toBe(10_000);
    expect(parseEnvironment({ PORT: "10000", CORRI_PORT: "3000" }).CORRI_PORT).toBe(3_000);
  });

  it("parses an explicit CORS origin allow-list and rejects wildcards", () => {
    expect(
      parseEnvironment({
        CORRI_CORS_ORIGINS: "https://alat.example, https://preview.alat.example",
      }).CORRI_CORS_ORIGINS,
    ).toEqual(["https://alat.example", "https://preview.alat.example"]);
    expect(() => parseEnvironment({ CORRI_CORS_ORIGINS: "*" })).toThrow();
  });
});
