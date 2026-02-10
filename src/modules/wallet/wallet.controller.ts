import { Router, type RequestHandler } from "express";
import { HttpError } from "../../shared/http-error.js";
import { respondWithError } from "../../shared/http.js";
import { WalletService } from "./wallet.service.js";

function principalUserId(locals: Express.Locals): string {
  const userId = locals.principal?.user?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication required");
  }

  return userId;
}

export function createWalletRouter(walletService: WalletService): Router {
  const router = Router();

  const getLinkedWallet: RequestHandler = (_req, res) => {
    try {
      const userId = principalUserId(res.locals);
      res.json({ wallet: walletService.getLinkedWallet(userId) });
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const createChallenge: RequestHandler = (req, res) => {
    const walletAddress = typeof req.body?.walletAddress === "string" ? req.body.walletAddress : "";
    const chainType = typeof req.body?.chainType === "string" ? req.body.chainType : undefined;

    try {
      const userId = principalUserId(res.locals);
      const result = walletService.createChallenge({
        userId,
        walletAddress,
        chainType,
      });
      res.status(201).json(result);
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const verifyAndLink: RequestHandler = (req, res) => {
    const challengeId = typeof req.body?.challengeId === "string" ? req.body.challengeId : "";
    const signature = typeof req.body?.signature === "string" ? req.body.signature : "";
    const publicKeyBase64 =
      typeof req.body?.publicKey === "string"
        ? req.body.publicKey
        : typeof req.body?.publicKeyBase64 === "string"
          ? req.body.publicKeyBase64
          : "";

    try {
      const userId = principalUserId(res.locals);
      const wallet = walletService.verifyAndLink({
        userId,
        challengeId,
        signature,
        publicKeyBase64,
      });

      res.json({ wallet });
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const unlinkWallet: RequestHandler = (_req, res) => {
    try {
      const userId = principalUserId(res.locals);
      res.json(walletService.unlinkWallet(userId));
    } catch (error) {
      respondWithError(res, error);
    }
  };

  router.get("/", getLinkedWallet);
  router.post("/challenge", createChallenge);
  router.post("/link", verifyAndLink);
  router.delete("/", unlinkWallet);

  return router;
}
