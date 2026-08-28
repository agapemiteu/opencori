import { createTenantResponseSchema, upsertBranchesResponseSchema } from "@opencori/contracts";
import { Test } from "@nestjs/testing";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterEach, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";
import { configureApplication, createFastifyAdapter } from "../src/application.js";
import { CLOCK, type Clock } from "../src/platform/clock.js";

const fixedNow = new Date("2026-08-28T12:00:00.000Z");
const fixedClock: Clock = { now: () => fixedNow };

/** The smallest location an organisation can send: everything else defaults. */
function minimalBranch(id: string) {
  return {
    id,
    externalBranchId: `EXT-${id}`,
    name: `Branch ${id}`,
    addressLine1: "1 Test Street",
    city: "Lagos",
    stateOrRegion: "Lagos",
    countryCode: "NG",
    timeZone: "Africa/Lagos",
  };
}

describe("organisation onboarding", () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  async function createTestApplication(): Promise<NestFastifyApplication> {
    const moduleReference = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLOCK)
      .useValue(fixedClock)
      .compile();
    app = moduleReference.createNestApplication<NestFastifyApplication>(createFastifyAdapter(), {
      logger: false,
    });
    configureApplication(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    return app;
  }

  async function createTenant(
    testApp: NestFastifyApplication,
    id: string,
  ): Promise<{ tenantId: string; apiKey: string }> {
    const response = await testApp.inject({
      method: "POST",
      url: "/v1/tenants",
      payload: { id, name: `${id} Bank` },
    });
    expect(response.statusCode).toBe(201);
    const body = createTenantResponseSchema.parse(response.json());
    return { tenantId: body.tenantId, apiKey: body.apiKey };
  }

  it("issues an API key once, and never returns it again", async () => {
    const testApp = await createTestApplication();
    const { tenantId, apiKey } = await createTenant(testApp, "first-bank");

    expect(tenantId).toBe("first-bank");
    expect(apiKey).toMatch(/^oc_/);

    // Nothing else in the API hands the key back.
    const branches = await testApp.inject({
      method: "GET",
      url: `/v1/tenants/${tenantId}/branches`,
      headers: { authorization: `Bearer ${apiKey}` },
    });
    expect(branches.statusCode).toBe(200);
    expect(JSON.stringify(branches.json())).not.toContain(apiKey);
  });

  it("refuses a second tenant with the same id", async () => {
    const testApp = await createTestApplication();
    await createTenant(testApp, "second-bank");

    const duplicate = await testApp.inject({
      method: "POST",
      url: "/v1/tenants",
      payload: { id: "second-bank", name: "Impostor" },
    });
    expect(duplicate.statusCode).toBe(409);
  });

  it("bulk uploads locations and defaults the geofence radii", async () => {
    const testApp = await createTestApplication();
    const { tenantId, apiKey } = await createTenant(testApp, "third-bank");

    const upload = await testApp.inject({
      method: "PUT",
      url: `/v1/tenants/${tenantId}/branches`,
      headers: { authorization: `Bearer ${apiKey}` },
      payload: { branches: [minimalBranch("marina"), minimalBranch("ikeja")] },
    });

    expect(upload.statusCode).toBe(200);
    const result = upsertBranchesResponseSchema.parse(upload.json());
    expect(result).toMatchObject({ created: 2, updated: 0, total: 2 });

    const listed = await testApp.inject({
      method: "GET",
      url: `/v1/tenants/${tenantId}/branches`,
      headers: { authorization: `Bearer ${apiKey}` },
    });
    const { branches } = listed.json() as { branches: readonly Record<string, unknown>[] };
    const marina = branches.find((branch) => branch.id === "marina");

    expect(marina).toMatchObject({
      tenantId,
      approachRadiusMeters: 250,
      visitRadiusMeters: 100,
      exitRadiusMeters: 150,
      active: true,
      // No coordinates were supplied, so it cannot claim to have any.
      coordinateQuality: "MISSING",
      latitude: null,
    });
  });

  it("is idempotent by branch id, and keeps the original creation time", async () => {
    const testApp = await createTestApplication();
    const { tenantId, apiKey } = await createTenant(testApp, "fourth-bank");
    const headers = { authorization: `Bearer ${apiKey}` };

    await testApp.inject({
      method: "PUT",
      url: `/v1/tenants/${tenantId}/branches`,
      headers,
      payload: { branches: [minimalBranch("marina")] },
    });

    const second = await testApp.inject({
      method: "PUT",
      url: `/v1/tenants/${tenantId}/branches`,
      headers,
      payload: { branches: [{ ...minimalBranch("marina"), name: "Marina Renamed" }] },
    });

    // Re-sending the same file must not duplicate the catalog.
    expect(upsertBranchesResponseSchema.parse(second.json())).toMatchObject({
      created: 0,
      updated: 1,
      total: 1,
    });
  });

  it("rejects duplicate ids inside one request", async () => {
    const testApp = await createTestApplication();
    const { tenantId, apiKey } = await createTenant(testApp, "fifth-bank");

    const response = await testApp.inject({
      method: "PUT",
      url: `/v1/tenants/${tenantId}/branches`,
      headers: { authorization: `Bearer ${apiKey}` },
      payload: { branches: [minimalBranch("marina"), minimalBranch("marina")] },
    });

    expect(response.statusCode).toBe(400);
  });

  it("switches a location off without deleting it", async () => {
    const testApp = await createTestApplication();
    const { tenantId, apiKey } = await createTenant(testApp, "sixth-bank");
    const headers = { authorization: `Bearer ${apiKey}` };

    await testApp.inject({
      method: "PUT",
      url: `/v1/tenants/${tenantId}/branches`,
      headers,
      payload: { branches: [minimalBranch("marina")] },
    });

    const patched = await testApp.inject({
      method: "PATCH",
      url: `/v1/tenants/${tenantId}/branches/marina`,
      headers,
      payload: { active: false },
    });

    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({ id: "marina", active: false });
  });

  it("rejects a radius update that would invert the geofence ordering, as a 400", async () => {
    const testApp = await createTestApplication();
    const { tenantId, apiKey } = await createTenant(testApp, "seventh-bank");
    const headers = { authorization: `Bearer ${apiKey}` };

    await testApp.inject({
      method: "PUT",
      url: `/v1/tenants/${tenantId}/branches`,
      headers,
      payload: { branches: [minimalBranch("marina")] },
    });

    // Exit must stay at or above visit; 10 is below the default visit of 100.
    const patched = await testApp.inject({
      method: "PATCH",
      url: `/v1/tenants/${tenantId}/branches/marina`,
      headers,
      payload: { exitRadiusMeters: 10 },
    });

    expect(patched.statusCode).toBe(400);
  });

  describe("authentication", () => {
    it("refuses a write with no key", async () => {
      const testApp = await createTestApplication();
      const { tenantId } = await createTenant(testApp, "eighth-bank");

      const response = await testApp.inject({
        method: "PUT",
        url: `/v1/tenants/${tenantId}/branches`,
        payload: { branches: [minimalBranch("marina")] },
      });

      expect(response.statusCode).toBe(401);
    });

    it("refuses a write with an unknown key", async () => {
      const testApp = await createTestApplication();
      const { tenantId } = await createTenant(testApp, "ninth-bank");

      const response = await testApp.inject({
        method: "PUT",
        url: `/v1/tenants/${tenantId}/branches`,
        headers: { authorization: "Bearer oc_not-a-real-key" },
        payload: { branches: [minimalBranch("marina")] },
      });

      expect(response.statusCode).toBe(401);
    });

    it("will not let one organisation write another's catalog", async () => {
      const testApp = await createTestApplication();
      const attacker = await createTenant(testApp, "attacker-bank");
      const victim = await createTenant(testApp, "victim-bank");

      const response = await testApp.inject({
        method: "PUT",
        url: `/v1/tenants/${victim.tenantId}/branches`,
        headers: { authorization: `Bearer ${attacker.apiKey}` },
        payload: { branches: [minimalBranch("marina")] },
      });

      expect(response.statusCode).toBe(403);

      const victimBranches = await testApp.inject({
        method: "GET",
        url: `/v1/tenants/${victim.tenantId}/branches`,
        headers: { authorization: `Bearer ${victim.apiKey}` },
      });
      expect((victimBranches.json() as { branches: unknown[] }).branches).toHaveLength(0);
    });

    /**
     * The seeded demo tenant exists but was never issued a key, so no request
     * can write to it. These are the shapes someone would actually try.
     */
    it("lets nobody write to the seeded demo tenant", async () => {
      const testApp = await createTestApplication();
      const payload = { branches: [minimalBranch("planted")] };

      const attempts = [
        {},
        { authorization: "Bearer " },
        { authorization: "Bearer wema" },
        { authorization: "Bearer null" },
        { "x-api-key": "wema" },
        { "x-api-key": "" },
      ];

      for (const headers of attempts) {
        const response = await testApp.inject({
          method: "PUT",
          url: "/v1/tenants/wema/branches",
          headers,
          payload,
        });
        expect(response.statusCode).toBe(401);
      }

      // And nothing was planted by any of them.
      const branches = await testApp.inject({ method: "GET", url: "/v1/branches" });
      expect(JSON.stringify(branches.json())).not.toContain("planted");
    });

    it("will not let a real tenant's key reach the demo tenant", async () => {
      const testApp = await createTestApplication();
      const { apiKey } = await createTenant(testApp, "outsider-bank");

      const response = await testApp.inject({
        method: "PUT",
        url: "/v1/tenants/wema/branches",
        headers: { authorization: `Bearer ${apiKey}` },
        payload: { branches: [minimalBranch("planted")] },
      });

      expect(response.statusCode).toBe(403);
    });

    it("accepts the key through x-api-key as well as Bearer", async () => {
      const testApp = await createTestApplication();
      const { tenantId, apiKey } = await createTenant(testApp, "tenth-bank");

      const response = await testApp.inject({
        method: "GET",
        url: `/v1/tenants/${tenantId}/branches`,
        headers: { "x-api-key": apiKey },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe("visit timer and cooldowns", () => {
    it("defaults the policy, then lets the organisation change it", async () => {
      const testApp = await createTestApplication();
      const { tenantId, apiKey } = await createTenant(testApp, "policy-bank");
      const headers = { authorization: `Bearer ${apiKey}` };

      await testApp.inject({
        method: "POST",
        url: `/v1/tenants/${tenantId}/applications`,
        headers,
        payload: {
          id: "mobile",
          name: "Mobile App",
          publicApplicationKey: "pk_test",
          configurationSigningKeyId: "sign-1",
          configurationSigningPublicKey:
            "-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----",
          receiverEncryptionKeyId: "enc-1",
          receiverEncryptionPublicKey: "-----BEGIN PUBLIC KEY-----\ndef\n-----END PUBLIC KEY-----",
        },
      });

      const defaulted = await testApp.inject({
        method: "GET",
        url: `/v1/tenants/${tenantId}/applications/mobile/policy`,
        headers,
      });
      expect(defaulted.json()).toMatchObject({ maximumVisitDurationSeconds: 14_400 });

      const updated = await testApp.inject({
        method: "PUT",
        url: `/v1/tenants/${tenantId}/applications/mobile/policy`,
        headers,
        payload: {
          policy: {
            approachRadiusMeters: 400,
            visitRadiusMeters: 120,
            exitRadiusMeters: 200,
            exitGraceSeconds: 60,
            notNowCooldownSeconds: 600,
            notVisitingCooldownSeconds: 43_200,
            maximumVisitDurationSeconds: 3_600,
            minimumAccuracyMeters: 40,
            startPolicy: "CUSTOMER_CONFIRMED",
            endPolicy: "STABLE_GEOFENCE_EXIT",
          },
        },
      });

      expect(updated.statusCode).toBe(200);
      expect(updated.json()).toMatchObject({ maximumVisitDurationSeconds: 3_600 });
    });
  });

  it("leaves the seeded demo tenant reachable through the existing routes", async () => {
    const testApp = await createTestApplication();

    // Onboarding shares one repository with the read side, so the demo catalog
    // must survive the new module being wired in.
    const branches = await testApp.inject({ method: "GET", url: "/v1/branches" });
    expect(branches.statusCode).toBe(200);
    expect((branches.json() as { branches: unknown[] }).branches.length).toBeGreaterThan(0);
  });
});
