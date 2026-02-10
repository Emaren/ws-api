import { Router, type RequestHandler } from "express";
import { respondWithError } from "../../shared/http.js";
import { BusinessOpsService } from "./business-ops.service.js";

interface CrudHandlers<TRecord> {
  list: () => TRecord[];
  getById: (id: string) => TRecord;
  create: (payload: unknown) => TRecord;
  update: (id: string, payload: unknown) => TRecord;
  remove: (id: string) => TRecord;
}

function withErrorBoundary(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    try {
      handler(req, res, next);
    } catch (error) {
      respondWithError(res, error);
    }
  };
}

function registerCrudRoutes<TRecord>(
  router: Router,
  path: string,
  handlers: CrudHandlers<TRecord>,
): void {
  router.get(
    `/${path}`,
    withErrorBoundary((_req, res) => {
      res.json(handlers.list());
    }),
  );

  router.get(
    `/${path}/:id`,
    withErrorBoundary((req, res) => {
      const id = typeof req.params.id === "string" ? req.params.id : "";
      res.json(handlers.getById(id));
    }),
  );

  router.post(
    `/${path}`,
    withErrorBoundary((req, res) => {
      const created = handlers.create(req.body);
      res.status(201).json(created);
    }),
  );

  router.patch(
    `/${path}/:id`,
    withErrorBoundary((req, res) => {
      const id = typeof req.params.id === "string" ? req.params.id : "";
      res.json(handlers.update(id, req.body));
    }),
  );

  router.delete(
    `/${path}/:id`,
    withErrorBoundary((req, res) => {
      const id = typeof req.params.id === "string" ? req.params.id : "";
      const deleted = handlers.remove(id);
      res.json({ deleted: true, record: deleted });
    }),
  );
}

export function createBusinessOpsRouter(service: BusinessOpsService): Router {
  const router = Router();

  registerCrudRoutes(router, "businesses", {
    list: () => service.listBusinesses(),
    getById: (id) => service.getBusiness(id),
    create: (payload) => service.createBusiness(payload),
    update: (id, payload) => service.updateBusiness(id, payload),
    remove: (id) => service.deleteBusiness(id),
  });

  registerCrudRoutes(router, "store-profiles", {
    list: () => service.listStoreProfiles(),
    getById: (id) => service.getStoreProfile(id),
    create: (payload) => service.createStoreProfile(payload),
    update: (id, payload) => service.updateStoreProfile(id, payload),
    remove: (id) => service.deleteStoreProfile(id),
  });

  registerCrudRoutes(router, "inventory-items", {
    list: () => service.listInventoryItems(),
    getById: (id) => service.getInventoryItem(id),
    create: (payload) => service.createInventoryItem(payload),
    update: (id, payload) => service.updateInventoryItem(id, payload),
    remove: (id) => service.deleteInventoryItem(id),
  });

  registerCrudRoutes(router, "pricing-rules", {
    list: () => service.listPricingRules(),
    getById: (id) => service.getPricingRule(id),
    create: (payload) => service.createPricingRule(payload),
    update: (id, payload) => service.updatePricingRule(id, payload),
    remove: (id) => service.deletePricingRule(id),
  });

  registerCrudRoutes(router, "offers", {
    list: () => service.listOffers(),
    getById: (id) => service.getOffer(id),
    create: (payload) => service.createOffer(payload),
    update: (id, payload) => service.updateOffer(id, payload),
    remove: (id) => service.deleteOffer(id),
  });

  registerCrudRoutes(router, "campaigns", {
    list: () => service.listCampaigns(),
    getById: (id) => service.getCampaign(id),
    create: (payload) => service.createCampaign(payload),
    update: (id, payload) => service.updateCampaign(id, payload),
    remove: (id) => service.deleteCampaign(id),
  });

  registerCrudRoutes(router, "notification-recipients", {
    list: () => service.listNotificationRecipients(),
    getById: (id) => service.getNotificationRecipient(id),
    create: (payload) => service.createNotificationRecipient(payload),
    update: (id, payload) => service.updateNotificationRecipient(id, payload),
    remove: (id) => service.deleteNotificationRecipient(id),
  });

  registerCrudRoutes(router, "delivery-leads", {
    list: () => service.listDeliveryLeads(),
    getById: (id) => service.getDeliveryLead(id),
    create: (payload) => service.createDeliveryLead(payload),
    update: (id, payload) => service.updateDeliveryLead(id, payload),
    remove: (id) => service.deleteDeliveryLead(id),
  });

  registerCrudRoutes(router, "affiliate-clicks", {
    list: () => service.listAffiliateClicks(),
    getById: (id) => service.getAffiliateClick(id),
    create: (payload) => service.createAffiliateClick(payload),
    update: (id, payload) => service.updateAffiliateClick(id, payload),
    remove: (id) => service.deleteAffiliateClick(id),
  });

  registerCrudRoutes(router, "reward-ledger", {
    list: () => service.listRewardLedger(),
    getById: (id) => service.getRewardLedger(id),
    create: (payload) => service.createRewardLedger(payload),
    update: (id, payload) => service.updateRewardLedger(id, payload),
    remove: (id) => service.deleteRewardLedger(id),
  });

  router.get(
    "/counts",
    withErrorBoundary((_req, res) => {
      res.json(service.counts());
    }),
  );

  return router;
}
