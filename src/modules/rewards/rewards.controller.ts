import { Router, type RequestHandler } from "express";
import { respondWithError } from "../../shared/http.js";
import { RewardsService } from "./rewards.service.js";

export function createRewardsRouter(rewardsService: RewardsService): Router {
  const router = Router();

  const listEntries: RequestHandler = (req, res) => {
    const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;

    try {
      res.json(rewardsService.listEntries(userId));
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const createEntry: RequestHandler = (req, res) => {
    const userId = typeof req.body?.userId === "string" ? req.body.userId : "";
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const amount = Number(req.body?.amount);
    const reason = typeof req.body?.reason === "string" ? req.body.reason : "";
    const metadata = typeof req.body?.metadata === "string" ? req.body.metadata : "";

    try {
      const entry = rewardsService.addEntry({
        userId,
        token,
        amount,
        reason,
        metadata,
      });

      res.status(201).json(entry);
    } catch (error) {
      respondWithError(res, error);
    }
  };

  router.get("/ledger", listEntries);
  router.post("/ledger", createEntry);

  return router;
}
