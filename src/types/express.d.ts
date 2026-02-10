import type { PublicAuthSession, PublicUser } from "../shared/models.js";

declare global {
  namespace Express {
    interface Locals {
      principal?: {
        user: PublicUser;
        session: PublicAuthSession;
      };
    }
  }
}

export {};
