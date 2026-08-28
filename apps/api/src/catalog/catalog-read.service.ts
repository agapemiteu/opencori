import {
  demoCatalogResponseSchema,
  demoBranchesResponseSchema,
  type DemoBranchesResponse,
  type DemoCatalogResponse,
  type PublicConfiguration,
  publicConfigurationSchema,
  signedConfigurationSchema,
  type SignedConfiguration,
} from "@opencori/contracts";
import { signPayload } from "@opencori/config-verifier";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { CLOCK, type Clock } from "../platform/clock.js";
import { CATALOG_REPOSITORY, type CatalogRepository } from "./catalog.repository.js";
import {
  DEMO_CONFIGURATION_KEY_ID,
  DEMO_CONFIGURATION_PRIVATE_KEY,
  DEMO_CONFIGURATION_VERSION,
} from "./seed.js";

@Injectable()
export class CatalogReadService {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly repository: CatalogRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async getCatalog(): Promise<DemoCatalogResponse> {
    const tenant = await this.repository.getTenant("wema");
    const application = await this.repository.getApplication("wema", "alat-demo");
    if (tenant === undefined || application === undefined) {
      throw new NotFoundException();
    }

    return demoCatalogResponseSchema.parse({
      tenant,
      application,
      branchCount: (await this.repository.listBranches(tenant.id)).length,
      sourceSummary:
        "Demo records use Wema-owned public pages for branch names, states, sort codes, and the Marina address. Only Marina has a demo-only estimated coordinate and no record is production-eligible.",
    });
  }

  async getBranches(): Promise<DemoBranchesResponse> {
    if ((await this.repository.getTenant("wema")) === undefined) {
      throw new NotFoundException();
    }
    return demoBranchesResponseSchema.parse({
      tenantId: "wema",
      demo: true,
      branches: await this.repository.listBranches("wema"),
    });
  }

  async publishConfiguration(
    tenantId: string,
    applicationId: string,
  ): Promise<SignedConfiguration> {
    // Signed with the key OpenCori issued this application, falling back to the
    // demo key for the seeded application, which was never issued one.
    const signingKey = (await this.repository.getSigningKey(tenantId, applicationId)) ?? {
      keyId: DEMO_CONFIGURATION_KEY_ID,
      privateKeyPem: DEMO_CONFIGURATION_PRIVATE_KEY,
    };

    const application = await this.repository.getApplication(tenantId, applicationId);
    if (application === undefined) {
      throw new NotFoundException();
    }

    const payload: PublicConfiguration = publicConfigurationSchema.parse({
      tenantId,
      applicationId,
      version: DEMO_CONFIGURATION_VERSION,
      publishedAt: this.clock.now().toISOString(),
      policy: {
        approachRadiusMeters: 250,
        visitRadiusMeters: 100,
        exitRadiusMeters: 150,
        exitGraceSeconds: 30,
        notNowCooldownSeconds: 300,
        notVisitingCooldownSeconds: 86_400,
        maximumVisitDurationSeconds: 14_400,
        minimumAccuracyMeters: 50,
        startPolicy: "CUSTOMER_CONFIRMED",
        endPolicy: "STABLE_GEOFENCE_EXIT",
      },
      notification: {
        locale: "en-NG",
        title: "Wema branch nearby",
        body: "You are near {branchName}. Are you visiting this branch today?",
        sound: true,
        vibration: true,
        version: "wema-demo-en-ng-1",
      },
    });

    return signedConfigurationSchema.parse(signPayload(payload, signingKey));
  }
}
