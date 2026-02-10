import { Router, type RequestHandler } from "express";
import { respondWithError } from "../../shared/http.js";
import { BillingService } from "./billing.service.js";

export function createBillingRouter(billingService: BillingService): Router {
  const router = Router();

  const listCustomers: RequestHandler = (_req, res) => {
    try {
      res.json(billingService.listCustomers());
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const createCustomer: RequestHandler = (req, res) => {
    const userId = typeof req.body?.userId === "string" ? req.body.userId : "";
    const plan = typeof req.body?.plan === "string" ? req.body.plan : "FREE";
    const stripeCustomerId = typeof req.body?.stripeCustomerId === "string" ? req.body.stripeCustomerId : "";
    const periodEnd = typeof req.body?.periodEnd === "string" ? req.body.periodEnd : "";

    try {
      const customer = billingService.createCustomer({
        userId,
        plan,
        stripeCustomerId,
        periodEnd,
      });

      res.status(201).json(customer);
    } catch (error) {
      respondWithError(res, error);
    }
  };

  router.get("/customers", listCustomers);
  router.post("/customers", createCustomer);

  return router;
}
