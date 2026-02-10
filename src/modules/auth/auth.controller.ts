import { Router, type RequestHandler } from "express";
import { respondWithError } from "../../shared/http.js";
import type { UserRole } from "../../shared/models.js";
import { AuthService } from "./auth.service.js";

const REGISTER_DEFAULT_ROLE: UserRole = "STONEHOLDER";

export interface AuthController {
  router: Router;
  loginHandler: RequestHandler;
  registerHandler: RequestHandler;
}

export function createAuthController(authService: AuthService): AuthController {
  const router = Router();

  const loginHandler: RequestHandler = (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    try {
      const result = authService.login({ email, password });
      res.json(result);
    } catch (error) {
      respondWithError(res, error);
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
      respondWithError(res, error);
    }
  };

  router.post("/login", loginHandler);
  router.post("/register", registerHandler);

  return {
    router,
    loginHandler,
    registerHandler,
  };
}
