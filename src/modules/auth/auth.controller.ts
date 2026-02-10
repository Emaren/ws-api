import { Router, type Request, type RequestHandler } from "express";
import { respondWithError } from "../../shared/http.js";
import type { UserRole } from "../../shared/models.js";
import { AuthService } from "./auth.service.js";

const REGISTER_DEFAULT_ROLE: UserRole = "USER";

export interface AuthController {
  router: Router;
  loginHandler: RequestHandler;
  registerHandler: RequestHandler;
  logoutHandler: RequestHandler;
  meHandler: RequestHandler;
  sessionHandler: RequestHandler;
}

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

export function createAuthController(
  authService: AuthService,
  options?: { logLevel?: string },
): AuthController {
  const router = Router();

  const loginHandler: RequestHandler = (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    try {
      const result = authService.login({ email, password });
      res.json(result);
    } catch (error) {
      respondWithError(res, error, {
        logLevel: options?.logLevel,
        method: req.method,
        path: req.originalUrl,
      });
    }
  };

  const registerHandler: RequestHandler = (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const name = typeof req.body?.name === "string" ? req.body.name : "";

    try {
      const user = authService.register({
        email,
        password,
        name,
        role: REGISTER_DEFAULT_ROLE,
      });

      res.status(201).json({ message: "User created", user });
    } catch (error) {
      respondWithError(res, error, {
        logLevel: options?.logLevel,
        method: req.method,
        path: req.originalUrl,
      });
    }
  };

  const logoutHandler: RequestHandler = (req, res) => {
    const accessToken = bearerTokenFromRequest(req);

    try {
      res.json(authService.logout(accessToken));
    } catch (error) {
      respondWithError(res, error, {
        logLevel: options?.logLevel,
        method: req.method,
        path: req.originalUrl,
      });
    }
  };

  const meHandler: RequestHandler = (req, res) => {
    const accessToken = bearerTokenFromRequest(req);

    try {
      res.json(authService.getMe(accessToken));
    } catch (error) {
      respondWithError(res, error, {
        logLevel: options?.logLevel,
        method: req.method,
        path: req.originalUrl,
      });
    }
  };

  const sessionHandler: RequestHandler = (req, res) => {
    const accessToken = bearerTokenFromRequest(req);

    try {
      res.json(authService.getSession(accessToken));
    } catch (error) {
      respondWithError(res, error, {
        logLevel: options?.logLevel,
        method: req.method,
        path: req.originalUrl,
      });
    }
  };

  router.post("/login", loginHandler);
  router.post("/register", registerHandler);
  router.post("/logout", logoutHandler);
  router.get("/me", meHandler);
  router.get("/session", sessionHandler);

  return {
    router,
    loginHandler,
    registerHandler,
    logoutHandler,
    meHandler,
    sessionHandler,
  };
}
