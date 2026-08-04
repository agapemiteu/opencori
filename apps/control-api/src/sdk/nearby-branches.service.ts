import {
  nearbyBranchesPayloadSchema,
  signedNearbyBranchesResponseSchema,
  type NearbyBranch,
  type NearbyBranchesQuery,
  type SignedNearbyBranchesResponse,
} from "@corri/contracts";
import { signPayload } from "@corri/config-verifier";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  DEMO_CATALOG_REPOSITORY,
  type DemoCatalogRepository,
} from "../demo/demo-catalog.repository.js";
import {
  DEMO_CONFIGURATION_KEY_ID,
  DEMO_CONFIGURATION_PRIVATE_KEY,
  DEMO_CONFIGURATION_VERSION,
} from "../demo/demo-seed.js";
import { CLOCK, type Clock } from "../platform/clock.js";

const earthRadiusMeters = 6_371_000;

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceMeters(
  latitude: number,
  longitude: number,
  branchLatitude: number,
  branchLongitude: number,
): number {
  const latitudeDelta = degreesToRadians(branchLatitude - latitude);
  const longitudeDelta = degreesToRadians(branchLongitude - longitude);
  const originLatitude = degreesToRadians(latitude);
  const targetLatitude = degreesToRadians(branchLatitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) * Math.cos(targetLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine)));
}

@Injectable()
export class NearbyBranchesService {
  constructor(
    @Inject(DEMO_CATALOG_REPOSITORY)
    private readonly repository: DemoCatalogRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  findNearby(query: NearbyBranchesQuery): SignedNearbyBranchesResponse {
    const application = this.repository.getApplication(query.tenantId, query.applicationId);
    if (application === undefined) {
      throw new NotFoundException();
    }

    const maximumDistanceMeters = query.radiusKm * 1_000;
    const branches: NearbyBranch[] = this.repository
      .listBranches(query.tenantId)
      .flatMap((branch) => {
        if (!branch.active || branch.latitude === null || branch.longitude === null) {
          return [];
        }
        const distance = distanceMeters(query.lat, query.lng, branch.latitude, branch.longitude);
        return distance <= maximumDistanceMeters ? [{ branch, distanceMeters: distance }] : [];
      })
      .sort((left, right) => left.distanceMeters - right.distanceMeters)
      .slice(0, query.limit);

    const payload = nearbyBranchesPayloadSchema.parse({
      tenantId: query.tenantId,
      applicationId: query.applicationId,
      configurationVersion: DEMO_CONFIGURATION_VERSION,
      generatedAt: this.clock.now().toISOString(),
      query: {
        latitude: query.lat,
        longitude: query.lng,
        radiusKm: query.radiusKm,
        limit: query.limit,
      },
      branches,
    });

    return signedNearbyBranchesResponseSchema.parse(
      signPayload(payload, {
        keyId: DEMO_CONFIGURATION_KEY_ID,
        privateKeyPem: DEMO_CONFIGURATION_PRIVATE_KEY,
      }),
    );
  }
}
