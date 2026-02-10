import type { RequestHandler } from "express";
import { logEvent } from "../shared/logger.js";

export function createRequestLogger(logLevel: string): RequestHandler {
  return (req, res, next) => {
    const startedAtMs = Date.now();

    res.on("finish", () => {
      const requestId = typeof res.locals.requestId === "string" ? res.locals.requestId : "n/a";
      const durationMs = Date.now() - startedAtMs;

      logEvent("info", logLevel, "http_request", {
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? null,
      });
    });

    next();
  };
}
