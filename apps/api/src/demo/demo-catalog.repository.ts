import type { Application, Branch, Tenant } from "@opencori/contracts";
import { Injectable } from "@nestjs/common";

import { alatDemoApplication, wemaDemoBranches, wemaDemoTenant } from "./demo-seed.js";

export const DEMO_CATALOG_REPOSITORY = Symbol("DEMO_CATALOG_REPOSITORY");

export interface DemoCatalogRepository {
  getTenant(tenantId: string): Tenant | undefined;
  getApplication(tenantId: string, applicationId: string): Application | undefined;
  listBranches(tenantId: string): readonly Branch[];
}

@Injectable()
export class SeededDemoCatalogRepository implements DemoCatalogRepository {
  getTenant(tenantId: string): Tenant | undefined {
    return tenantId === wemaDemoTenant.id ? wemaDemoTenant : undefined;
  }

  getApplication(tenantId: string, applicationId: string): Application | undefined {
    return tenantId === alatDemoApplication.tenantId && applicationId === alatDemoApplication.id
      ? alatDemoApplication
      : undefined;
  }

  listBranches(tenantId: string): readonly Branch[] {
    return tenantId === wemaDemoTenant.id ? wemaDemoBranches : [];
  }
}
