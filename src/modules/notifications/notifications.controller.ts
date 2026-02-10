import { Router, type RequestHandler } from "express";
import { respondWithError } from "../../shared/http.js";
import { NotificationsService } from "./notifications.service.js";

export function createNotificationsRouter(notificationsService: NotificationsService): Router {
  const router = Router();

  const listJobs: RequestHandler = (_req, res) => {
    try {
      res.json(notificationsService.listJobs());
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const createJob: RequestHandler = (req, res) => {
    const businessId = typeof req.body?.businessId === "string" ? req.body.businessId : "";
    const channel = typeof req.body?.channel === "string" ? req.body.channel : "";
    const audience = typeof req.body?.audience === "string" ? req.body.audience : "";
    const message = typeof req.body?.message === "string" ? req.body.message : "";

    try {
      const job = notificationsService.queueNotification({
        businessId,
        channel,
        audience,
        message,
      });

      res.status(201).json(job);
    } catch (error) {
      respondWithError(res, error);
    }
  };

  router.get("/jobs", listJobs);
  router.post("/jobs", createJob);

  return router;
}
