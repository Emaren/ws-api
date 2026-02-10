import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const requestContextMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.header("x-request-id");
  const requestId = incoming && incoming.trim().length > 0 ? incoming.trim() : randomUUID();

  res.locals.requestId = requestId;
  res.locals.startedAtMs = Date.now();
  res.setHeader("x-request-id", requestId);

  next();
};
