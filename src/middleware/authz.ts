import type { Request, RequestHandler } from "express";
import type { AuthService } from "../modules/auth/auth.service.js";
import { HttpError } from "../shared/http-error.js";
import { respondWithError } from "../shared/http.js";
import type { UserRole } from "../shared/models.js";
import { hasAnyRole, normalizeRole } from "../shared/rbac.js";

function bearerTokenFromRequest(req: Request): string {
  const header = req.header("authorization");
  if (!header) {
    return "";
  }

  const [scheme, token] = header.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return "";
  }

  return token.trim();
}

export function createRequireSession(
  authService: AuthService,
  options?: { logLevel?: string },
): RequestHandler {
  return (req, res, next) => {
    try {
      const token = bearerTokenFromRequest(req);
      const principal = authService.getSession(token);
      res.locals.principal = principal;
      next();
    } catch (error) {
      respondWithError(res, error, {
        logLevel: options?.logLevel,
        method: req.method,
        path: req.originalUrl,
      });
    }
  };
}

export function createRequireRoles(
  allowedRoles: readonly UserRole[],
  options?: { logLevel?: string },
): RequestHandler {
  return (req, res, next) => {
    try {
      const principal = res.locals.principal;
      if (!principal) {
        throw new HttpError(401, "Authentication required");
      }

      const role = normalizeRole(principal.user.role);
      if (!hasAnyRole(role, allowedRoles)) {
        throw new HttpError(403, "Insufficient role permissions");
      }

      next();
    } catch (error) {
      respondWithError(res, error, {
        logLevel: options?.logLevel,
        method: req.method,
        path: req.originalUrl,
      });
    }
  };
}
