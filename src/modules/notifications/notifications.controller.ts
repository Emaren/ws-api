import { Router, type RequestHandler } from "express";
import { respondWithError } from "../../shared/http.js";
import type { NotificationChannel, NotificationStatus } from "../../shared/models.js";
import { NotificationsService } from "./notifications.service.js";

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== "string" && typeof value !== "number") {
    return fallback;
  }

  const parsed =
    typeof value === "number" ? Math.trunc(value) : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseNotificationStatus(value: unknown): NotificationStatus | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "queued" ||
    normalized === "processing" ||
    normalized === "retrying" ||
    normalized === "sent" ||
    normalized === "failed"
  ) {
    return normalized;
  }

  return undefined;
}

function parseNotificationChannel(value: unknown): NotificationChannel | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "email" || normalized === "sms" || normalized === "push") {
    return normalized;
  }

  return undefined;
}

export function createNotificationsRouter(notificationsService: NotificationsService): Router {
  const router = Router();

  const listJobs: RequestHandler = (req, res) => {
    try {
      const status = parseNotificationStatus(req.query?.status);
      const channel = parseNotificationChannel(req.query?.channel);
      const businessId =
        typeof req.query?.businessId === "string" ? req.query.businessId.trim() : undefined;

      res.json(
        notificationsService.listJobs({
          ...(status ? { status } : {}),
          ...(channel ? { channel } : {}),
          ...(businessId ? { businessId } : {}),
        }),
      );
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const listAuditLogs: RequestHandler = (req, res) => {
    try {
      const jobId = typeof req.query?.jobId === "string" ? req.query.jobId.trim() : undefined;
      res.json(notificationsService.listAuditLogs(jobId || undefined));
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const listJobAuditLogs: RequestHandler = (req, res) => {
    const jobId = typeof req.params.id === "string" ? req.params.id : "";

    try {
      res.json(notificationsService.listAuditLogs(jobId));
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const createJob: RequestHandler = (req, res) => {
    const businessId = typeof req.body?.businessId === "string" ? req.body.businessId : "";
    const channel = typeof req.body?.channel === "string" ? req.body.channel : "";
    const audience = typeof req.body?.audience === "string" ? req.body.audience : "";
    const subject = typeof req.body?.subject === "string" ? req.body.subject : undefined;
    const message = typeof req.body?.message === "string" ? req.body.message : "";
    const metadata =
      req.body && typeof req.body.metadata === "object" && !Array.isArray(req.body.metadata)
        ? (req.body.metadata as Record<string, unknown>)
        : null;
    const maxAttempts = parsePositiveInt(req.body?.maxAttempts, Number.NaN);

    try {
      const input = {
        businessId,
        channel,
        audience,
        message,
      } as {
        businessId: string;
        channel: string;
        audience: string;
        message: string;
        subject?: string;
        metadata?: Record<string, unknown>;
        maxAttempts?: number;
      };

      if (subject) {
        input.subject = subject;
      }
      if (metadata) {
        input.metadata = metadata;
      }
      if (Number.isFinite(maxAttempts)) {
        input.maxAttempts = maxAttempts;
      }

      const job = notificationsService.queueNotification(input);

      res.status(201).json(job);
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const processQueue: RequestHandler = async (req, res) => {
    const limit = parsePositiveInt(req.body?.limit, 20);

    try {
      const result = await notificationsService.processDueJobs(limit);
      res.json(result);
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const retryJob: RequestHandler = (req, res) => {
    const id = typeof req.params.id === "string" ? req.params.id : "";

    try {
      const job = notificationsService.retryJob(id);
      res.json(job);
    } catch (error) {
      respondWithError(res, error);
    }
  };

  router.get("/jobs", listJobs);
  router.get("/audit", listAuditLogs);
  router.get("/jobs/:id/audit", listJobAuditLogs);
  router.post("/jobs", createJob);
  router.post("/jobs/process", processQueue);
  router.post("/jobs/:id/retry", retryJob);

  return router;
}
