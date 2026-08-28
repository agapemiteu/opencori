import type {
  Application,
  Branch,
  BranchInput,
  GeofencePolicy,
  Tenant,
  UpdateBranchRequest,
} from "@opencori/contracts";
import { Injectable } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";

import { alatDemoApplication, wemaDemoBranches, wemaDemoTenant } from "./seed.js";
import { hashApiKey, type CatalogRepository, type UpsertOutcome } from "./catalog.repository.js";

/**
 * The durable catalog.
 *
 * Rows are stored as JSONB rather than a column per field. The contracts
 * already validate every record on the way in, so a second definition of the
 * same shape in DDL would be a second thing to keep in step for no extra
 * safety. It also means adding a field to a contract needs no migration.
 *
 * The trade-off is that Postgres cannot index into a branch's coordinates, so
 * nearby lookups still filter in memory after loading a tenant's locations.
 * That is the same cost the in-memory store already pays, and it only becomes
 * worth changing for a tenant with far more locations than a bank has branches.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS tenants (
  id            text PRIMARY KEY,
  api_key_hash  text,
  data          jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS applications (
  tenant_id      text NOT NULL,
  application_id text NOT NULL,
  data           jsonb NOT NULL,
  policy         jsonb,
  signing_key    text,
  PRIMARY KEY (tenant_id, application_id)
);
CREATE TABLE IF NOT EXISTS branches (
  tenant_id text NOT NULL,
  branch_id text NOT NULL,
  data      jsonb NOT NULL,
  PRIMARY KEY (tenant_id, branch_id)
);
`;

@Injectable()
export class PostgresCatalogRepository implements CatalogRepository, OnModuleDestroy {
  readonly #pool: Pool;

  constructor(connectionString: string) {
    this.#pool = new Pool({ connectionString });
  }

  /**
   * Creates the tables if they are missing and seeds the demo tenant once.
   *
   * Seeding is ON CONFLICT DO NOTHING, so a redeploy leaves an operator's edits
   * to the demo records alone rather than resetting them on every boot.
   */
  async initialize(): Promise<void> {
    await this.#pool.query(SCHEMA);
    await this.#pool.query(
      `INSERT INTO tenants (id, api_key_hash, data) VALUES ($1, NULL, $2)
       ON CONFLICT (id) DO NOTHING`,
      [wemaDemoTenant.id, JSON.stringify(wemaDemoTenant)],
    );
    await this.#pool.query(
      `INSERT INTO applications (tenant_id, application_id, data, policy) VALUES ($1, $2, $3, NULL)
       ON CONFLICT (tenant_id, application_id) DO NOTHING`,
      [alatDemoApplication.tenantId, alatDemoApplication.id, JSON.stringify(alatDemoApplication)],
    );
    for (const branch of wemaDemoBranches) {
      await this.#pool.query(
        `INSERT INTO branches (tenant_id, branch_id, data) VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, branch_id) DO NOTHING`,
        [branch.tenantId, branch.id, JSON.stringify(branch)],
      );
    }
  }

  /**
   * Nest calls this on shutdown. Without it the pool keeps its sockets open and
   * a redeploy leaves connections behind until Postgres times them out, which
   * on a small instance is enough to exhaust the connection limit.
   */
  async onModuleDestroy(): Promise<void> {
    await this.#pool.end();
  }

  async getTenant(tenantId: string): Promise<Tenant | undefined> {
    const result = await this.#pool.query<{ data: Tenant }>(
      "SELECT data FROM tenants WHERE id = $1",
      [tenantId],
    );
    return result.rows[0]?.data;
  }

  async getApplication(tenantId: string, applicationId: string): Promise<Application | undefined> {
    const result = await this.#pool.query<{ data: Application }>(
      "SELECT data FROM applications WHERE tenant_id = $1 AND application_id = $2",
      [tenantId, applicationId],
    );
    return result.rows[0]?.data;
  }

  async listBranches(tenantId: string): Promise<readonly Branch[]> {
    const result = await this.#pool.query<{ data: Branch }>(
      "SELECT data FROM branches WHERE tenant_id = $1 ORDER BY branch_id",
      [tenantId],
    );
    return result.rows.map((row) => row.data);
  }

  async createTenant(tenant: Tenant, apiKeyHash: string): Promise<void> {
    await this.#pool.query("INSERT INTO tenants (id, api_key_hash, data) VALUES ($1, $2, $3)", [
      tenant.id,
      apiKeyHash,
      JSON.stringify(tenant),
    ]);
  }

  /**
   * Looked up by hash rather than scanned and compared, so the work does not
   * grow with the number of tenants. The hash is not a secret: it is one SHA-256
   * of a 256-bit random key, which is not reversible by search.
   */
  async findTenantIdByApiKey(apiKey: string): Promise<string | undefined> {
    const result = await this.#pool.query<{ id: string }>(
      "SELECT id FROM tenants WHERE api_key_hash = $1",
      [hashApiKey(apiKey)],
    );
    return result.rows[0]?.id;
  }

  async createApplication(application: Application, signingPrivateKeyPem: string): Promise<void> {
    await this.#pool.query(
      `INSERT INTO applications (tenant_id, application_id, data, policy, signing_key)
       VALUES ($1, $2, $3, NULL, $4)`,
      [application.tenantId, application.id, JSON.stringify(application), signingPrivateKeyPem],
    );
  }

  /**
   * The seeded demo application is inserted with a NULL signing key, so this
   * returns undefined for it and the caller falls back to the demo key the
   * existing clients already pin.
   */
  async getSigningKey(
    tenantId: string,
    applicationId: string,
  ): Promise<{ keyId: string; privateKeyPem: string } | undefined> {
    const result = await this.#pool.query<{ data: Application; signing_key: string | null }>(
      "SELECT data, signing_key FROM applications WHERE tenant_id = $1 AND application_id = $2",
      [tenantId, applicationId],
    );
    const row = result.rows[0];
    if (row === undefined || row.signing_key === null) {
      return undefined;
    }
    return { keyId: row.data.configurationSigningKeyId, privateKeyPem: row.signing_key };
  }

  async getPolicy(tenantId: string, applicationId: string): Promise<GeofencePolicy | undefined> {
    const result = await this.#pool.query<{ policy: GeofencePolicy | null }>(
      "SELECT policy FROM applications WHERE tenant_id = $1 AND application_id = $2",
      [tenantId, applicationId],
    );
    return result.rows[0]?.policy ?? undefined;
  }

  async setPolicy(tenantId: string, applicationId: string, policy: GeofencePolicy): Promise<void> {
    await this.#pool.query(
      "UPDATE applications SET policy = $3 WHERE tenant_id = $1 AND application_id = $2",
      [tenantId, applicationId, JSON.stringify(policy)],
    );
  }

  /**
   * One transaction for the whole upload: a file that fails half way leaves the
   * catalog as it was, rather than half updated.
   */
  async upsertBranches(
    tenantId: string,
    branches: readonly BranchInput[],
    now: Date,
  ): Promise<UpsertOutcome> {
    const timestamp = now.toISOString();
    const client = await this.#pool.connect();
    let created = 0;
    let updated = 0;

    try {
      await client.query("BEGIN");
      for (const input of branches) {
        const existing = await client.query<{ data: Branch }>(
          "SELECT data FROM branches WHERE tenant_id = $1 AND branch_id = $2",
          [tenantId, input.id],
        );
        const previous = existing.rows[0]?.data;
        const record = {
          ...input,
          tenantId,
          // Keeps when the location was first registered, not last sent.
          createdAt: previous?.createdAt ?? timestamp,
          updatedAt: timestamp,
        };
        await client.query(
          `INSERT INTO branches (tenant_id, branch_id, data) VALUES ($1, $2, $3)
           ON CONFLICT (tenant_id, branch_id) DO UPDATE SET data = EXCLUDED.data`,
          [tenantId, input.id, JSON.stringify(record)],
        );
        if (previous === undefined) {
          created += 1;
        } else {
          updated += 1;
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return { created, updated };
  }

  async getBranch(tenantId: string, branchId: string): Promise<Branch | undefined> {
    const result = await this.#pool.query<{ data: Branch }>(
      "SELECT data FROM branches WHERE tenant_id = $1 AND branch_id = $2",
      [tenantId, branchId],
    );
    return result.rows[0]?.data;
  }

  async updateBranch(
    tenantId: string,
    branchId: string,
    update: UpdateBranchRequest,
    now: Date,
  ): Promise<Branch | undefined> {
    const existing = await this.getBranch(tenantId, branchId);
    if (existing === undefined) {
      return undefined;
    }

    const next: Branch = {
      ...existing,
      ...update,
      updatedAt: now.toISOString(),
    } as Branch;

    await this.#pool.query(
      "UPDATE branches SET data = $3 WHERE tenant_id = $1 AND branch_id = $2",
      [tenantId, branchId, JSON.stringify(next)],
    );
    return next;
  }
}
