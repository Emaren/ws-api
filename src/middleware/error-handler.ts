import type { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError, isHttpError } from "../shared/http-error.js";
import { logEvent } from "../shared/logger.js";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export function createErrorHandler(logLevel: string): ErrorRequestHandler {
  return (error, req, res, _next) => {
    const requestId = typeof res.locals.requestId === "string" ? res.locals.requestId : "n/a";

    if (isHttpError(error)) {
      if (error.statusCode >= 500) {
        logEvent("error", logLevel, "http_error", {
          requestId,
          method: req.method,
          path: req.originalUrl,
          statusCode: error.statusCode,
          message: error.message,
        });
      }

      res.status(error.statusCode).json({
        error: {
          message: error.message,
          statusCode: error.statusCode,
          requestId,
        },
      });
      return;
    }

    logEvent("error", logLevel, "unhandled_error", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: {
        message: "Internal server error",
        statusCode: 500,
        requestId,
      },
    });
  };
}
