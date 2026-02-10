import type { Response } from "express";
import { isHttpError } from "./http-error.js";
import { logEvent } from "./logger.js";

export function respondWithError(
  res: Response,
  error: unknown,
  options?: { logLevel?: string; method?: string; path?: string },
): void {
  const requestId = typeof res.locals.requestId === "string" ? res.locals.requestId : "n/a";

  if (isHttpError(error)) {
    if (error.statusCode >= 500) {
      logEvent("error", options?.logLevel, "http_error", {
        requestId,
        method: options?.method,
        path: options?.path,
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

  logEvent("error", options?.logLevel, "unhandled_error", {
    requestId,
    method: options?.method,
    path: options?.path,
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
}
