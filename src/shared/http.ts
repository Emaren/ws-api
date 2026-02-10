import type { Response } from "express";
import { isHttpError } from "./http-error.js";

export function respondWithError(res: Response, error: unknown): void {
  if (isHttpError(error)) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  console.error("Unhandled error", error);
  res.status(500).json({ message: "Internal server error" });
}
