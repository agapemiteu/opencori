import { randomUUID } from "node:crypto";

import type { BranchInput, Tenant } from "@opencori/contracts";
import { afterAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";

import {
  InMemoryCatalogRepository,
  hashApiKey,
  type CatalogRepository,
} from "../src/catalog/catalog.repository.js";
import { PostgresCatalogRepository } from "../src/catalog/postgres-catalog.repository.js";

/**
 * One suite, both stores.
 *
 * The in-memory and Postgres repositories are the same interface, so they get
 * the same tests rather than one being trusted because the other passes. The
 * Postgres run needs a database and is skipped without DATABASE_URL, which is
 * why the in-memory run must never be skipped: it is the one that always runs.
 */
const now = new Date("2026-08-28T12:00:00.000Z");
const later = new Date("2026-08-29T12:00:00.000Z");

function tenant(id: string): Tenant {
  return {
    id,
    name: `${id} Bank`,
    demo: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  } as Tenant;
}

function branch(id: string, overrides: Partial<BranchInput> = {}): BranchInput {
  return {
    id,
    externalBranchId: `EXT-${id}`,
    name: `Branch ${id}`,
    branchType: "BRANCH",
    addressLine1: "1 Test Street",
    addressLine2: null,
    city: "Lagos",
    stateOrRegion: "Lagos",
    postalCode: null,
    countryCode: "NG",
    timeZone: "Africa/Lagos",
    latitude: null,
    longitude: null,
    coordinateQuality: "MISSING",
    approachRadiusMeters: 250,
    visitRadiusMeters: 100,
    exitRadiusMeters: 150,
    active: true,
    source: "contract-test",
    sourceVersion: "1",
    verifiedAt: null,
    metadata: {},
    ...overrides,
  } as BranchInput;
}

function runContract(name: string, create: () => Promise<CatalogRepository>): void {
  describe(`${name} satisfies the catalog contract`, () => {
    // Unique per run so a Postgres database can be reused without a reset
    // between runs, and so two runs never collide on the same rows.
    const unique = () => `t-${randomUUID().slice(0, 8)}`;

    it("stores and returns a tenant", async () => {
      const repository = await create();
      const id = unique();
      await repository.createTenant(tenant(id), hashApiKey(`secret-${id}`));

      expect(await repository.getTenant(id)).toMatchObject({ id, demo: false });
      expect(await repository.getTenant("never-created")).toBeUndefined();
    });

    it("resolves a tenant from its API key, and only the right one", async () => {
      const repository = await create();
      const id = unique();
      const theKey = `the-key-${id}`;
      await repository.createTenant(tenant(id), hashApiKey(theKey));

      expect(await repository.findTenantIdByApiKey(theKey)).toBe(id);
      expect(await repository.findTenantIdByApiKey(`not-${theKey}`)).toBeUndefined();
    });

    it("counts a first upload as created and a repeat as updated", async () => {
      const repository = await create();
      const id = unique();
      await repository.createTenant(tenant(id), hashApiKey(unique()));

      expect(await repository.upsertBranches(id, [branch("a"), branch("b")], now)).toEqual({
        created: 2,
        updated: 0,
      });
      expect(await repository.upsertBranches(id, [branch("a")], now)).toEqual({
        created: 0,
        updated: 1,
      });
      expect(await repository.listBranches(id)).toHaveLength(2);
    });

    it("keeps the original creation time when a location is re-uploaded", async () => {
      const repository = await create();
      const id = unique();
      await repository.createTenant(tenant(id), hashApiKey(unique()));

      await repository.upsertBranches(id, [branch("a")], now);
      await repository.upsertBranches(id, [branch("a", { name: "Renamed" })], later);

      const stored = await repository.getBranch(id, "a");
      expect(stored?.createdAt).toBe(now.toISOString());
      expect(stored?.updatedAt).toBe(later.toISOString());
      expect(stored?.name).toBe("Renamed");
    });

    it("keeps each tenant's locations to itself", async () => {
      const repository = await create();
      const first = unique();
      const second = unique();
      await repository.createTenant(tenant(first), hashApiKey(unique()));
      await repository.createTenant(tenant(second), hashApiKey(unique()));

      await repository.upsertBranches(first, [branch("a")], now);

      expect(await repository.listBranches(second)).toHaveLength(0);
      expect(await repository.getBranch(second, "a")).toBeUndefined();
    });

    it("updates a location and reports a missing one as undefined", async () => {
      const repository = await create();
      const id = unique();
      await repository.createTenant(tenant(id), hashApiKey(unique()));
      await repository.upsertBranches(id, [branch("a")], now);

      const updated = await repository.updateBranch(id, "a", { active: false }, later);
      expect(updated).toMatchObject({ id: "a", active: false, updatedAt: later.toISOString() });
      expect(
        await repository.updateBranch(id, "missing", { active: false }, later),
      ).toBeUndefined();
    });

    it("defaults an application to no stored policy, then remembers one", async () => {
      const repository = await create();
      const id = unique();
      await repository.createTenant(tenant(id), hashApiKey(unique()));
      await repository.createApplication(
        {
          id: "app",
          tenantId: id,
          name: "App",
          publicApplicationKey: "pk",
          configurationSigningKeyId: "sign-1",
          configurationSigningPublicKey: "public",
          receiverEncryptionKeyId: "enc-1",
          receiverEncryptionPublicKey: "public",
          active: true,
          demo: false,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        "PRIVATE_KEY_PEM",
      );

      expect(await repository.getPolicy(id, "app")).toBeUndefined();

      const policy = {
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
      } as const;
      await repository.setPolicy(id, "app", policy);

      expect(await repository.getPolicy(id, "app")).toMatchObject({
        maximumVisitDurationSeconds: 3_600,
      });
    });

    it("carries the seeded demo tenant", async () => {
      const repository = await create();
      expect(await repository.getTenant("wema")).toBeDefined();
      expect((await repository.listBranches("wema")).length).toBeGreaterThan(0);
    });

    it("does not duplicate the seed when it boots again", async () => {
      const first = await create();
      const before = (await first.listBranches("wema")).length;

      // For Postgres this re-runs initialize() against a database that already
      // has the seed, which is what every redeploy does. Seeding is
      // ON CONFLICT DO NOTHING precisely so a redeploy neither duplicates the
      // demo records nor resets an operator's edits to them.
      const second = await create();

      expect((await second.listBranches("wema")).length).toBe(before);
    });

    describe("API key handling", () => {
      /**
       * The seeded demo tenant is created without an API key, because nobody
       * should be able to write to it. In Postgres its api_key_hash is NULL,
       * and SQL NULL never equals anything, so no key can match it. In memory
       * it simply has no entry. Both must refuse.
       *
       * If this ever fails, anyone could onboard branches into the demo tenant.
       */
      it("never authenticates the seeded demo tenant", async () => {
        const repository = await create();
        expect(await repository.getTenant("wema")).toBeDefined();

        for (const attempt of ["", "wema", "null", "NULL", "undefined", "oc_anything"]) {
          expect(await repository.findTenantIdByApiKey(attempt)).not.toBe("wema");
        }
      });

      it("gives two tenants different keys, and each opens only its own", async () => {
        const repository = await create();
        const first = unique();
        const second = unique();
        await repository.createTenant(tenant(first), hashApiKey(`key-${first}`));
        await repository.createTenant(tenant(second), hashApiKey(`key-${second}`));

        expect(await repository.findTenantIdByApiKey(`key-${first}`)).toBe(first);
        expect(await repository.findTenantIdByApiKey(`key-${second}`)).toBe(second);
      });

      it("refuses a key that is close but not equal", async () => {
        const repository = await create();
        const id = unique();
        const correct = `oc_correct-${id}`;
        await repository.createTenant(tenant(id), hashApiKey(correct));

        // A prefix, a suffix, and a case change must all fail: the stored value
        // is a hash, so matching is all-or-nothing rather than partial.
        for (const attempt of [
          correct.slice(0, -1),
          `${correct} `,
          correct.toUpperCase(),
          "oc_",
          "",
        ]) {
          expect(await repository.findTenantIdByApiKey(attempt)).toBeUndefined();
        }
      });

      it("stores the hash, never the key itself", async () => {
        const repository = await create();
        const id = unique();
        const key = `oc_super-secret-${id}`;
        await repository.createTenant(tenant(id), hashApiKey(key));

        // Whatever a store hands back about a tenant must not contain the key.
        const stored = JSON.stringify(await repository.getTenant(id));
        expect(stored).not.toContain(key);
        expect(stored).not.toContain(`super-secret-${id}`);
      });
    });
  });
}

runContract("InMemoryCatalogRepository", async () => new InMemoryCatalogRepository());

// Runs only where a database is configured. Skipped locally and in CI, which is
// the honest trade: the Postgres path is covered wherever a database exists,
// and never silently reported as covered where one does not.
const databaseUrl = process.env.DATABASE_URL;
const describePostgres = databaseUrl === undefined ? describe.skip : describe;

describePostgres("PostgresCatalogRepository (DATABASE_URL set)", () => {
  // A hosted database is a network round trip per statement, and each case
  // opens a connection and runs the schema before it starts. Vitest's 5s
  // default is a local-only assumption and fails these on latency alone.
  vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

  /**
   * Every tenant this suite creates is removed afterwards.
   *
   * Without this the fixtures simply accumulate: pointing DATABASE_URL at the
   * database that also backs a deployment left dozens of "t-..." tenants sitting
   * in the live catalog. Only rows this suite created are touched, matched on
   * the "t-" prefix its ids use, so the seeded demo tenant is never at risk.
   */
  afterAll(async () => {
    const client = new Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    try {
      for (const table of ["branches", "applications"]) {
        await client.query(`DELETE FROM ${table} WHERE tenant_id LIKE 't-%'`);
      }
      await client.query("DELETE FROM tenants WHERE id LIKE 't-%'");
    } finally {
      await client.end();
    }
  });

  runContract("PostgresCatalogRepository", async () => {
    const repository = new PostgresCatalogRepository(databaseUrl as string);
    await repository.initialize();
    return repository;
  });
});
