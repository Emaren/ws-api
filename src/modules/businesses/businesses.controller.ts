import { Router, type RequestHandler } from "express";
import { respondWithError } from "../../shared/http.js";
import { BusinessesService } from "./businesses.service.js";

export function createBusinessesRouter(businessesService: BusinessesService): Router {
  const router = Router();

  const listBusinesses: RequestHandler = (_req, res) => {
    try {
      res.json(businessesService.listBusinesses());
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const createBusiness: RequestHandler = (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name : "";
    const ownerUserId = typeof req.body?.ownerUserId === "string" ? req.body.ownerUserId : "";
    const contactEmail = typeof req.body?.contactEmail === "string" ? req.body.contactEmail : "";

    try {
      const business = businessesService.createBusiness({
        name,
        ownerUserId,
        contactEmail,
      });
      res.status(201).json(business);
    } catch (error) {
      respondWithError(res, error);
    }
  };

  router.get("/", listBusinesses);
  router.post("/", createBusiness);

  return router;
}
