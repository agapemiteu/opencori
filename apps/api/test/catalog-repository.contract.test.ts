import { randomUUID } from "node:crypto";

import type { BranchInput, Tenant } from "@opencori/contracts";
import { describe, expect, it } from "vitest";

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
      await repository.createTenant(tenant(id), hashApiKey("secret"));

      expect(await repository.getTenant(id)).toMatchObject({ id, demo: false });
      expect(await repository.getTenant("never-created")).toBeUndefined();
    });

    it("resolves a tenant from its API key, and only the right one", async () => {
      const repository = await create();
      const id = unique();
      await repository.createTenant(tenant(id), hashApiKey("the-key"));

      expect(await repository.findTenantIdByApiKey("the-key")).toBe(id);
      expect(await repository.findTenantIdByApiKey("not-the-key")).toBeUndefined();
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
      await repository.createApplication({
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
      } as any);

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
  });
}

runContract("InMemoryCatalogRepository", async () => new InMemoryCatalogRepository());

// Runs only where a database is configured. Skipped locally and in CI, which is
// the honest trade: the Postgres path is covered wherever a database exists,
// and never silently reported as covered where one does not.
const databaseUrl = process.env.DATABASE_URL;
const describePostgres = databaseUrl === undefined ? describe.skip : describe;

describePostgres("PostgresCatalogRepository (DATABASE_URL set)", () => {
  runContract("PostgresCatalogRepository", async () => {
    const repository = new PostgresCatalogRepository(databaseUrl as string);
    await repository.initialize();
    return repository;
  });
});
