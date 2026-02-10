import cors from "cors";
import express, { type RequestHandler } from "express";
import type { CorsOptions } from "cors";
import type { AppEnv } from "./config/env.js";
import { createMemoryStore } from "./infrastructure/memory/memory-store.js";
import { createArticlesRouter } from "./modules/articles/articles.controller.js";
import { InMemoryArticlesRepository } from "./modules/articles/articles.repository.js";
import { ArticlesService } from "./modules/articles/articles.service.js";
import { createAuthController } from "./modules/auth/auth.controller.js";
import { AuthRepositoryAdapter } from "./modules/auth/auth.repository.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { createBillingRouter } from "./modules/billing/billing.controller.js";
import { InMemoryBillingRepository } from "./modules/billing/billing.repository.js";
import { BillingService } from "./modules/billing/billing.service.js";
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

function buildCorsOrigin(origins: string[]): CorsOptions["origin"] {
  return origins.length > 0 ? origins : true;
}

export function createApp(env: AppEnv): express.Express {
  const app = express();
  const startedAtMs = Date.now();

  app.use(cors({ origin: buildCorsOrigin(env.corsOrigins) }));
  app.use(express.json());

  const store = createMemoryStore();

  const usersRepository = new InMemoryUsersRepository(store);
  const authRepository = new AuthRepositoryAdapter(usersRepository);
  const articlesRepository = new InMemoryArticlesRepository(store);
  const businessesRepository = new InMemoryBusinessesRepository(store);
  const inventoryRepository = new InMemoryInventoryRepository(store);
  const notificationsRepository = new InMemoryNotificationsRepository(store);
  const billingRepository = new InMemoryBillingRepository(store);
  const rewardsRepository = new InMemoryRewardsRepository(store);

  const authService = new AuthService(authRepository);
  const usersService = new UsersService(usersRepository);
  const articlesService = new ArticlesService(articlesRepository);
  const businessesService = new BusinessesService(businessesRepository);
  const inventoryService = new InventoryService(inventoryRepository);
  const notificationsService = new NotificationsService(notificationsRepository);
  const billingService = new BillingService(billingRepository);
  const rewardsService = new RewardsService(rewardsRepository);

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

  const authController = createAuthController(authService);

  const healthHandler: RequestHandler = (_req, res) => {
    res.json({
      status: "ok",
      service: env.serviceName,
      uptime_s: Math.floor((Date.now() - startedAtMs) / 1000),
      modules: {
        users: store.users.length,
        articles: store.articles.length,
        businesses: store.businesses.length,
        inventoryItems: store.inventoryItems.length,
        notifications: store.notifications.length,
        billingCustomers: store.billingCustomers.length,
        rewardEntries: store.rewardLedger.length,
      },
    });
  };

  app.get("/", (_req, res) => {
    res.json({ service: env.serviceName, ok: true });
  });

  app.get("/ping", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/health", healthHandler);
  app.get("/api/health", healthHandler);

  app.use("/auth", authController.router);
  app.post("/login", authController.loginHandler);
  app.post("/api/register", authController.registerHandler);

  app.use("/users", createUsersRouter(usersService));
  app.use("/articles", createArticlesRouter(articlesService));
  app.use("/businesses", createBusinessesRouter(businessesService));
  app.use("/inventory", createInventoryRouter(inventoryService));
  app.use("/notifications", createNotificationsRouter(notificationsService));
  app.use("/billing", createBillingRouter(billingService));
  app.use("/rewards", createRewardsRouter(rewardsService));

  return app;
}
