import { Router, type Request, type RequestHandler } from "express";
import { respondWithError } from "../../shared/http.js";
import type { UserRole } from "../../shared/models.js";
import { AuthService } from "./auth.service.js";

const REGISTER_DEFAULT_ROLE: UserRole = "USER";

export interface AuthController {
  router: Router;
  loginHandler: RequestHandler;
  registerHandler: RequestHandler;
  resetPasswordBridgeHandler: RequestHandler;
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

  const loginHandler: RequestHandler = async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    try {
      const result = await authService.login({ email, password });
      res.json(result);
    } catch (error) {
      respondWithError(res, error, {
        logLevel: options?.logLevel,
        method: req.method,
        path: req.originalUrl,
      });
    }
  };

  const registerHandler: RequestHandler = async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const name = typeof req.body?.name === "string" ? req.body.name : "";

    try {
      const user = await authService.register({
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

  const resetPasswordBridgeHandler: RequestHandler = async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const bridgeKeyHeader = req.header("x-ws-bridge-key");
    const bridgeKey = typeof bridgeKeyHeader === "string" ? bridgeKeyHeader : "";

    try {
      const result = await authService.resetPasswordViaBridge({
        email,
        password,
        bridgeKey,
      });
      res.json(result);
    } catch (error) {
      respondWithError(res, error, {
        logLevel: options?.logLevel,
        method: req.method,
        path: req.originalUrl,
      });
    }
  };

  const logoutHandler: RequestHandler = async (req, res) => {
    const accessToken = bearerTokenFromRequest(req);

    try {
      res.json(await authService.logout(accessToken));
    } catch (error) {
      respondWithError(res, error, {
        logLevel: options?.logLevel,
        method: req.method,
        path: req.originalUrl,
      });
    }
  };

  const meHandler: RequestHandler = async (req, res) => {
    const accessToken = bearerTokenFromRequest(req);

    try {
      res.json(await authService.getMe(accessToken));
    } catch (error) {
      respondWithError(res, error, {
        logLevel: options?.logLevel,
        method: req.method,
        path: req.originalUrl,
      });
    }
  };

  const sessionHandler: RequestHandler = async (req, res) => {
    const accessToken = bearerTokenFromRequest(req);

    try {
      res.json(await authService.getSession(accessToken));
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
  router.post("/password/reset", resetPasswordBridgeHandler);
  router.post("/logout", logoutHandler);
  router.get("/me", meHandler);
  router.get("/session", sessionHandler);

  return {
    router,
    loginHandler,
    registerHandler,
    resetPasswordBridgeHandler,
    logoutHandler,
    meHandler,
    sessionHandler,
  };
}
