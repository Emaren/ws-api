import { Router, type Request, type RequestHandler } from "express";
import { HttpError } from "../../shared/http-error.js";
import { respondWithError } from "../../shared/http.js";
import type { UserRole } from "../../shared/models.js";
import { normalizeRole } from "../../shared/rbac.js";
import { RewardsService } from "./rewards.service.js";

function principalUser(req: Request): { id: string; role: UserRole } {
  const principal = req.res?.locals.principal;
  const userId = principal?.user?.id;
  const role = normalizeRole(principal?.user?.role);

  if (!userId || !role) {
    throw new HttpError(401, "Authentication required");
  }

  return { id: userId, role };
}

export function createRewardsRouter(rewardsService: RewardsService): Router {
  const router = Router();

  const listRules: RequestHandler = (_req, res) => {
    try {
      res.json({ rules: rewardsService.listRules() });
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const listEntries: RequestHandler = (req, res) => {
    const userIdQuery = typeof req.query.userId === "string" ? req.query.userId : undefined;
    const token = typeof req.query.token === "string" ? req.query.token : undefined;
    const ruleId = typeof req.query.ruleId === "string" ? req.query.ruleId : undefined;
    const payoutStatus =
      typeof req.query.payoutStatus === "string" ? req.query.payoutStatus : undefined;
    const createdAfter =
      typeof req.query.createdAfter === "string" ? req.query.createdAfter : undefined;
    const createdBefore =
      typeof req.query.createdBefore === "string" ? req.query.createdBefore : undefined;

    try {
      const principal = principalUser(req);
      res.json(
        rewardsService.listEntries({
          requestingUserId: principal.id,
          requestingRole: principal.role,
          userId: userIdQuery,
          token,
          ruleId,
          payoutStatus,
          createdAfter,
          createdBefore,
        }),
      );
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const accrueByRule: RequestHandler = (req, res) => {
    const ruleId = typeof req.body?.ruleId === "string" ? req.body.ruleId : "";
    const quantity = Number(req.body?.quantity ?? 1);
    const sourceType = typeof req.body?.sourceType === "string" ? req.body.sourceType : undefined;
    const sourceId = typeof req.body?.sourceId === "string" ? req.body.sourceId : undefined;
    const idempotencyKey =
      typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey : undefined;
    const metadata = req.body?.metadata;
    const targetUserId =
      typeof req.body?.targetUserId === "string" ? req.body.targetUserId : undefined;

    try {
      const principal = principalUser(req);
      const entry = rewardsService.accrueByRule({
        requestingUserId: principal.id,
        requestingRole: principal.role,
        ruleId,
        quantity,
        sourceType,
        sourceId,
        idempotencyKey,
        metadata,
        targetUserId,
      });

      res.status(201).json(entry);
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const createManualEntry: RequestHandler = (req, res) => {
    const userId = typeof req.body?.userId === "string" ? req.body.userId : "";
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const amount = Number(req.body?.amount);
    const reason = typeof req.body?.reason === "string" ? req.body.reason : "";
    const metadata = req.body?.metadata;

    try {
      const principal = principalUser(req);
      const entry = rewardsService.addManualEntry({
        requestingRole: principal.role,
        userId,
        token,
        amount,
        reason,
        metadata,
      });

      res.status(201).json(entry);
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const report: RequestHandler = (req, res) => {
    try {
      const principal = principalUser(req);
      const payload = rewardsService.buildReport({
        requestingRole: principal.role,
        userId: typeof req.query.userId === "string" ? req.query.userId : undefined,
        token: typeof req.query.token === "string" ? req.query.token : undefined,
        ruleId: typeof req.query.ruleId === "string" ? req.query.ruleId : undefined,
        payoutStatus:
          typeof req.query.payoutStatus === "string" ? req.query.payoutStatus : undefined,
        createdAfter:
          typeof req.query.createdAfter === "string" ? req.query.createdAfter : undefined,
        createdBefore:
          typeof req.query.createdBefore === "string" ? req.query.createdBefore : undefined,
      });

      res.json(payload);
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const exportPreview: RequestHandler = (req, res) => {
    try {
      const principal = principalUser(req);
      const payload = rewardsService.exportPreview({
        requestingRole: principal.role,
        format: typeof req.query.format === "string" ? req.query.format : undefined,
        userId: typeof req.query.userId === "string" ? req.query.userId : undefined,
        token: typeof req.query.token === "string" ? req.query.token : undefined,
        ruleId: typeof req.query.ruleId === "string" ? req.query.ruleId : undefined,
        payoutStatus:
          typeof req.query.payoutStatus === "string" ? req.query.payoutStatus : undefined,
        createdAfter:
          typeof req.query.createdAfter === "string" ? req.query.createdAfter : undefined,
        createdBefore:
          typeof req.query.createdBefore === "string" ? req.query.createdBefore : undefined,
      });

      if (payload.format === "csv") {
        res.setHeader("content-type", "text/csv; charset=utf-8");
        res.setHeader(
          "content-disposition",
          `attachment; filename=reward-ledger-${payload.payoutBatchId}.csv`,
        );
        res.status(200).send(payload.csv);
        return;
      }

      res.json(payload);
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const markExported: RequestHandler = (req, res) => {
    try {
      const principal = principalUser(req);
      const payload = rewardsService.markExported({
        requestingRole: principal.role,
        entryIds: Array.isArray(req.body?.entryIds)
          ? req.body.entryIds.filter(
              (entryId: unknown): entryId is string => typeof entryId === "string",
            )
          : undefined,
        payoutBatchId:
          typeof req.body?.payoutBatchId === "string" ? req.body.payoutBatchId : undefined,
        token: typeof req.body?.token === "string" ? req.body.token : undefined,
        ruleId: typeof req.body?.ruleId === "string" ? req.body.ruleId : undefined,
        payoutStatus:
          typeof req.body?.payoutStatus === "string" ? req.body.payoutStatus : undefined,
        createdAfter:
          typeof req.body?.createdAfter === "string" ? req.body.createdAfter : undefined,
        createdBefore:
          typeof req.body?.createdBefore === "string" ? req.body.createdBefore : undefined,
      });

      res.json(payload);
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const settleExportBatch: RequestHandler = (req, res) => {
    const payoutBatchId =
      typeof req.body?.payoutBatchId === "string" ? req.body.payoutBatchId : "";
    const payoutTxHash =
      typeof req.body?.payoutTxHash === "string" ? req.body.payoutTxHash : "";

    try {
      const principal = principalUser(req);
      const payload = rewardsService.settleExportBatch({
        requestingRole: principal.role,
        payoutBatchId,
        payoutTxHash,
        entryIds: Array.isArray(req.body?.entryIds)
          ? req.body.entryIds.filter(
              (entryId: unknown): entryId is string => typeof entryId === "string",
            )
          : undefined,
      });

      res.json(payload);
    } catch (error) {
      respondWithError(res, error);
    }
  };

  router.get("/rules", listRules);
  router.get("/ledger", listEntries);
  router.post("/accrual", accrueByRule);
  router.post("/ledger", createManualEntry);

  router.get("/report", report);
  router.get("/export", exportPreview);
  router.post("/export/mark", markExported);
  router.post("/export/settle", settleExportBatch);

  return router;
}
