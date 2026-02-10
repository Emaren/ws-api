import { Router, type RequestHandler } from "express";
import { respondWithError } from "../../shared/http.js";
import { InventoryService } from "./inventory.service.js";

export function createInventoryRouter(inventoryService: InventoryService): Router {
  const router = Router();

  const listInventory: RequestHandler = (req, res) => {
    const businessId = typeof req.query.businessId === "string" ? req.query.businessId : undefined;

    try {
      res.json(inventoryService.listInventory(businessId));
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const createInventoryItem: RequestHandler = (req, res) => {
    const businessId = typeof req.body?.businessId === "string" ? req.body.businessId : "";
    const name = typeof req.body?.name === "string" ? req.body.name : "";
    const priceCents = Number(req.body?.priceCents);
    const discountedPriceRaw = req.body?.discountedPriceCents;
    const discountedPriceCents =
      discountedPriceRaw === null || discountedPriceRaw === undefined ? null : Number(discountedPriceRaw);
    const discountEndsAt = typeof req.body?.discountEndsAt === "string" ? req.body.discountEndsAt : "";
    const unitsLeft = Number(req.body?.unitsLeft);

    try {
      const item = inventoryService.createInventoryItem({
        businessId,
        name,
        priceCents,
        discountedPriceCents,
        discountEndsAt,
        unitsLeft,
      });

      res.status(201).json(item);
    } catch (error) {
      respondWithError(res, error);
    }
  };

  router.get("/items", listInventory);
  router.post("/items", createInventoryItem);

  return router;
}
