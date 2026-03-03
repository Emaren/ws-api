import { Router, type RequestHandler } from "express";
import { respondWithError } from "../../shared/http.js";
import { UsersService } from "./users.service.js";

export function createUsersRouter(usersService: UsersService): Router {
  const router = Router();

  const listUsers: RequestHandler = async (_req, res) => {
    try {
      res.json(await usersService.listUsers());
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const updateRole: RequestHandler = async (req, res) => {
    const userId = typeof req.params.id === "string" ? req.params.id : "";
    const role = typeof req.body?.role === "string" ? req.body.role : "";

    try {
      res.json(await usersService.setRole(userId, role));
    } catch (error) {
      respondWithError(res, error);
    }
  };

  router.get("/", listUsers);
  router.patch("/:id/role", updateRole);

  return router;
}
