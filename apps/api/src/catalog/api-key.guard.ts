import { ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";

import { CATALOG_REPOSITORY, type CatalogRepository } from "./catalog.repository.js";

interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  params?: Record<string, string>;
  tenantId?: string;
}

function readApiKey(headers: AuthenticatedRequest["headers"]): string | undefined {
  const authorization = headers.authorization;
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    const key = authorization.slice("Bearer ".length).trim();
    return key.length > 0 ? key : undefined;
  }

  const apiKey = headers["x-api-key"];
  if (typeof apiKey === "string" && apiKey.length > 0) {
    return apiKey;
  }

  return undefined;
}

/**
 * Authenticates a write against the tenant that owns it.
 *
 * A key identifies exactly one tenant, so holding a key for one organisation
 * does not let you write another's catalog even though the route names it. The
 * mismatch is a 403 rather than a 404: the caller is authenticated, just not
 * for this tenant.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly repository: CatalogRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const apiKey = readApiKey(request.headers);
    if (apiKey === undefined) {
      throw new UnauthorizedException();
    }

    const tenantId = await this.repository.findTenantIdByApiKey(apiKey);
    if (tenantId === undefined) {
      throw new UnauthorizedException();
    }

    const routeTenantId = request.params?.tenantId;
    if (routeTenantId !== undefined && routeTenantId !== tenantId) {
      throw new ForbiddenException();
    }

    request.tenantId = tenantId;
    return true;
  }
}
