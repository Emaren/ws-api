import cors from "cors";
import express, { type RequestHandler } from "express";
import type { CorsOptions } from "cors";
import type { AppEnv } from "./config/env.js";
import { buildApiContract } from "./contracts/api-contract.js";
import { createMemoryStore } from "./infrastructure/memory/memory-store.js";
import {
  createRequireRoles,
  createRequireSession,
  createResolveSession,
} from "./middleware/authz.js";
import { createErrorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestContextMiddleware } from "./middleware/request-context.js";
import { createRequestLogger } from "./middleware/request-logger.js";
import { createArticlesRouter } from "./modules/articles/articles.controller.js";
import { InMemoryArticlesRepository } from "./modules/articles/articles.repository.js";
import { ArticlesService } from "./modules/articles/articles.service.js";
import { createAuthController } from "./modules/auth/auth.controller.js";
import { AuthRepositoryAdapter } from "./modules/auth/auth.repository.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { createBillingRouter } from "./modules/billing/billing.controller.js";
import { InMemoryBillingRepository } from "./modules/billing/billing.repository.js";
import { BillingService } from "./modules/billing/billing.service.js";
import { createBusinessOpsRouter } from "./modules/business-ops/business-ops.controller.js";
import { InMemoryBusinessOpsRepository } from "./modules/business-ops/business-ops.repository.js";
import { BusinessOpsService } from "./modules/business-ops/business-ops.service.js";
import { createBusinessesRouter } from "./modules/businesses/businesses.controller.js";
import { InMemoryBusinessesRepository } from "./modules/businesses/businesses.repository.js";
import { BusinessesService } from "./modules/businesses/businesses.service.js";
import { createInventoryRouter } from "./modules/inventory/inventory.controller.js";
import { InMemoryInventoryRepository } from "./modules/inventory/inventory.repository.js";
import { InventoryService } from "./modules/inventory/inventory.service.js";
import { createNotificationsRouter } from "./modules/notifications/notifications.controller.js";
import { InMemoryNotificationsRepository } from "./modules/notifications/notifications.repository.js";
import { NotificationsService } from "./modules/notifications/notifications.service.js";
import { createRewardsRouter } from "./modules/rewards/rewards.controller.js";
import { InMemoryRewardsRepository } from "./modules/rewards/rewards.repository.js";
import { RewardsService } from "./modules/rewards/rewards.service.js";
import { createUsersRouter } from "./modules/users/users.controller.js";
import { InMemoryUsersRepository } from "./modules/users/users.repository.js";
import { UsersService } from "./modules/users/users.service.js";
import { RBAC_ROLES } from "./shared/rbac.js";

function buildCorsOrigin(origins: string[]): CorsOptions["origin"] {
  return origins.length > 0 ? origins : true;
}

export function createApp(env: AppEnv): express.Express {
  const app = express();
  const startedAtMs = Date.now();

  app.use(cors({ origin: buildCorsOrigin(env.corsOrigins) }));
  app.use(requestContextMiddleware);
  app.use(createRequestLogger(env.logLevel));
  app.use(express.json());

  const store = createMemoryStore();

  const usersRepository = new InMemoryUsersRepository(store);
  const authRepository = new AuthRepositoryAdapter(usersRepository, store);
  const articlesRepository = new InMemoryArticlesRepository(store);
  const businessesRepository = new InMemoryBusinessesRepository(store);
  const inventoryRepository = new InMemoryInventoryRepository(store);
  const notificationsRepository = new InMemoryNotificationsRepository(store);
  const billingRepository = new InMemoryBillingRepository(store);
  const rewardsRepository = new InMemoryRewardsRepository(store);
  const businessOpsRepository = new InMemoryBusinessOpsRepository();

  const authService = new AuthService(authRepository, {
    sessionTtlSeconds: env.authSessionTtlSeconds,
  });
  const usersService = new UsersService(usersRepository);
  const articlesService = new ArticlesService(articlesRepository);
  const businessesService = new BusinessesService(businessesRepository);
  const inventoryService = new InventoryService(inventoryRepository);
  const notificationsService = new NotificationsService(notificationsRepository);
  const billingService = new BillingService(billingRepository);
  const rewardsService = new RewardsService(rewardsRepository);
  const businessOpsService = new BusinessOpsService(businessOpsRepository);

  if (env.bootstrapAdminEmail && env.bootstrapAdminPassword) {
    try {
      authService.register({
        email: env.bootstrapAdminEmail,
        password: env.bootstrapAdminPassword,
        name: env.bootstrapAdminName,
        role: "OWNER",
      });
    } catch {
      // Ignore duplicate bootstrap attempts.
    }
  }

  const authController = createAuthController(authService, {
    logLevel: env.logLevel,
  });
  const requireSession = createRequireSession(authService, {
    logLevel: env.logLevel,
  });
  const resolveSession = createResolveSession(authService, {
    logLevel: env.logLevel,
  });
  const requireOwnerAdmin = createRequireRoles(RBAC_ROLES.ownerAdmin, {
    logLevel: env.logLevel,
  });
  const requireEditorial = createRequireRoles(RBAC_ROLES.editorial, {
    logLevel: env.logLevel,
  });
  const requireStaff = createRequireRoles(RBAC_ROLES.staff, {
    logLevel: env.logLevel,
  });
  const requireAuthenticated = createRequireRoles(RBAC_ROLES.authenticated, {
    logLevel: env.logLevel,
  });

  const healthHandler: RequestHandler = (_req, res) => {
    res.json({
      status: "ok",
      checks: {
        process: "ok",
      },
      service: env.serviceName,
      nodeEnv: env.nodeEnv,
      uptime_s: Math.floor((Date.now() - startedAtMs) / 1000),
      modules: {
        users: store.users.length,
        authSessions: store.authSessions.length,
        articles: store.articles.length,
        businesses: store.businesses.length,
        inventoryItems: store.inventoryItems.length,
        notifications: store.notifications.length,
        billingCustomers: store.billingCustomers.length,
        rewardEntries: store.rewardLedger.length,
        businessOps: businessOpsService.counts(),
      },
    });
  };

  const readinessHandler: RequestHandler = (_req, res) => {
    const bootstrapConfigured = Boolean(env.bootstrapAdminEmail && env.bootstrapAdminPassword);
    const bootstrapReady =
      !bootstrapConfigured ||
      Boolean(usersRepository.findByEmail(env.bootstrapAdminEmail ?? ""));

    const checks = {
      env: "ok",
      memoryStore: "ok",
      bootstrapAdmin: bootstrapReady ? "ok" : "error",
    } as const;

    const ready = Object.values(checks).every((value) => value === "ok");
    const payload = {
      status: ready ? "ready" : "not_ready",
      service: env.serviceName,
      checks,
      modules: {
        users: store.users.length,
        authSessions: store.authSessions.length,
        articles: store.articles.length,
        businesses: store.businesses.length,
        inventoryItems: store.inventoryItems.length,
        notifications: store.notifications.length,
        billingCustomers: store.billingCustomers.length,
        rewardEntries: store.rewardLedger.length,
        businessOps: businessOpsService.counts(),
      },
    };

    if (!ready) {
      res.status(503).json(payload);
      return;
    }

    res.json(payload);
  };

  app.get("/", (_req, res) => {
    res.json({ service: env.serviceName, ok: true });
  });

  app.get("/ping", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/health", healthHandler);
  app.get("/api/health", healthHandler);
  app.get("/ready", readinessHandler);
  app.get("/api/ready", readinessHandler);
  app.get("/api/contract", (_req, res) => {
    res.json(buildApiContract(env.serviceName));
  });

  app.use("/auth", authController.router);
  app.post("/login", authController.loginHandler);
  app.post("/api/register", authController.registerHandler);
  app.post("/logout", authController.logoutHandler);
  app.get("/me", authController.meHandler);
  app.get("/session", authController.sessionHandler);
  app.post("/api/auth/logout", authController.logoutHandler);
  app.get("/api/auth/me", authController.meHandler);
  app.get("/api/auth/session", authController.sessionHandler);

  app.use("/users", requireSession, requireOwnerAdmin, createUsersRouter(usersService));
  app.use(
    "/articles",
    createArticlesRouter(articlesService, {
      resolveSession,
      requireSession,
      requireEditorial,
    }),
  );
  app.use("/businesses", requireSession, requireStaff, createBusinessesRouter(businessesService));
  app.use("/inventory", requireSession, requireEditorial, createInventoryRouter(inventoryService));
  app.use(
    "/notifications",
    requireSession,
    requireStaff,
    createNotificationsRouter(notificationsService),
  );
  app.use("/billing", requireSession, requireOwnerAdmin, createBillingRouter(billingService));
  app.use("/rewards", requireSession, requireAuthenticated, createRewardsRouter(rewardsService));
  app.use("/ops", requireSession, requireStaff, createBusinessOpsRouter(businessOpsService));
  app.use(notFoundHandler);
  app.use(createErrorHandler(env.logLevel));

  return app;
}
