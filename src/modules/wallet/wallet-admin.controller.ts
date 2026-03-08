import { Router, type RequestHandler } from "express";
import { respondWithError } from "../../shared/http.js";
import { WalletService } from "./wallet.service.js";

export function createWalletAdminRouter(walletService: WalletService): Router {
  const router = Router();

  const listWalletLinks: RequestHandler = (_req, res) => {
    try {
      res.json(walletService.listWalletLinks());
    } catch (error) {
      respondWithError(res, error);
    }
  };

  router.get("/", listWalletLinks);

  return router;
}
