import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { createApp } from "./app.js";
import type { AppEnv } from "./config/env.js";

interface JsonResponse {
  status: number;
  body: any;
}

async function startTestServer() {
  const env: AppEnv = {
    nodeEnv: "test",
    serviceName: "ws-api-dynamic-pricing-test",
    port: 0,
    logLevel: "error",
    corsOrigins: [],
    allowWildcardCorsInProduction: true,
    authSessionTtlSeconds: 3600,
    bootstrapAdminEmail: "owner@test.local",
    bootstrapAdminPassword: "ownerpass123",
    bootstrapAdminName: "Owner",
  };

  const app = createApp(env);
  const server = app.listen(0);
  await once(server, "listening");

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    async close() {
      server.close();
      await once(server, "close");
    },
  };
}

async function requestJson(
  baseUrl: string,
  path: string,
  options?: {
    method?: string;
    token?: string;
    body?: Record<string, unknown>;
  },
): Promise<JsonResponse> {
  const init: RequestInit = {
    method: options?.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
  };

  if (options?.body) {
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json().catch(() => ({}));

  return {
    status: response.status,
    body,
  };
}

async function loginOwner(baseUrl: string): Promise<string> {
  const login = await requestJson(baseUrl, "/auth/login", {
    method: "POST",
    body: { email: "owner@test.local", password: "ownerpass123" },
  });

  assert.equal(login.status, 200);
  assert.equal(typeof login.body?.accessToken, "string");
  return login.body.accessToken;
}

test("dynamic pricing engine handles windows, stock thresholds, overrides, and expiry", async () => {
  const server = await startTestServer();

  try {
    const ownerToken = await loginOwner(server.baseUrl);

    const createBusiness = await requestJson(server.baseUrl, "/ops/businesses", {
      method: "POST",
      token: ownerToken,
      body: {
        slug: "dynamic-pricing-biz",
        name: "Dynamic Pricing Biz",
        status: "ACTIVE",
      },
    });
    assert.equal(createBusiness.status, 201);
    const businessId = createBusiness.body.id as string;

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const inTenMinutesIso = new Date(now + 10 * 60 * 1000).toISOString();
    const tenMinutesAgoIso = new Date(now - 10 * 60 * 1000).toISOString();

    const createWindowInventory = await requestJson(
      server.baseUrl,
      "/ops/inventory-items",
      {
        method: "POST",
        token: ownerToken,
        body: {
          businessId,
          name: "Windowed Item",
          sku: "WIN-1",
          priceCents: 1000,
          quantityOnHand: 30,
          reservedQuantity: 0,
          isActive: true,
        },
      },
    );
    assert.equal(createWindowInventory.status, 201);
    const windowInventoryId = createWindowInventory.body.id as string;

    const createRule = await requestJson(server.baseUrl, "/ops/pricing-rules", {
      method: "POST",
      token: ownerToken,
      body: {
        businessId,
        inventoryItemId: windowInventoryId,
        name: "Happy Hour 20",
        ruleType: "PERCENT_OFF",
        percentOff: 20,
        startsAt: tenMinutesAgoIso,
        endsAt: inTenMinutesIso,
        priority: 100,
      },
    });
    assert.equal(createRule.status, 201);

    const createOffer = await requestJson(server.baseUrl, "/ops/offers", {
      method: "POST",
      token: ownerToken,
      body: {
        businessId,
        inventoryItemId: windowInventoryId,
        title: "Flash 780",
        status: "LIVE",
        discountPriceCents: 780,
        startsAt: tenMinutesAgoIso,
        endsAt: inTenMinutesIso,
        unitsTotal: 20,
        unitsClaimed: 1,
      },
    });
    assert.equal(createOffer.status, 201);

    const inWindowQuote = await requestJson(server.baseUrl, "/ops/pricing/quote", {
      method: "POST",
      token: ownerToken,
      body: {
        businessId,
        inventoryItemId: windowInventoryId,
        quantity: 1,
        asOf: nowIso,
      },
    });
    assert.equal(inWindowQuote.status, 200);
    assert.equal(inWindowQuote.body?.purchasable, true);
    assert.equal(inWindowQuote.body?.finalUnitPriceCents, 780);
    assert.equal(inWindowQuote.body?.selectedSource, "OFFER");

    const outsideWindowQuote = await requestJson(
      server.baseUrl,
      "/ops/pricing/quote",
      {
        method: "POST",
        token: ownerToken,
        body: {
          businessId,
          inventoryItemId: windowInventoryId,
          quantity: 1,
          asOf: new Date(now + 3 * 60 * 60 * 1000).toISOString(),
        },
      },
    );
    assert.equal(outsideWindowQuote.status, 200);
    assert.equal(outsideWindowQuote.body?.purchasable, true);
    assert.equal(outsideWindowQuote.body?.finalUnitPriceCents, 1000);
    assert.equal(outsideWindowQuote.body?.selectedSource, "BASE");

    const createThresholdInventory = await requestJson(
      server.baseUrl,
      "/ops/inventory-items",
      {
        method: "POST",
        token: ownerToken,
        body: {
          businessId,
          name: "Threshold Item",
          sku: "THRESH-1",
          priceCents: 1000,
          quantityOnHand: 5,
          reservedQuantity: 0,
          lowStockThreshold: 5,
          isActive: true,
        },
      },
    );
    assert.equal(createThresholdInventory.status, 201);
    const thresholdInventoryId = createThresholdInventory.body.id as string;

    const thresholdQuote = await requestJson(server.baseUrl, "/ops/pricing/quote", {
      method: "POST",
      token: ownerToken,
      body: {
        businessId,
        inventoryItemId: thresholdInventoryId,
        quantity: 1,
        asOf: nowIso,
      },
    });
    assert.equal(thresholdQuote.status, 200);
    assert.equal(thresholdQuote.body?.finalUnitPriceCents, 900);
    assert.equal(thresholdQuote.body?.selectedSource, "STOCK_THRESHOLD");

    const manualOverrideQuote = await requestJson(
      server.baseUrl,
      "/ops/pricing/quote",
      {
        method: "POST",
        token: ownerToken,
        body: {
          businessId,
          inventoryItemId: thresholdInventoryId,
          quantity: 1,
          asOf: nowIso,
          manualOverrideCents: 777,
        },
      },
    );
    assert.equal(manualOverrideQuote.status, 200);
    assert.equal(manualOverrideQuote.body?.finalUnitPriceCents, 777);
    assert.equal(manualOverrideQuote.body?.selectedSource, "MANUAL_OVERRIDE");

    const createExpiringInventory = await requestJson(
      server.baseUrl,
      "/ops/inventory-items",
      {
        method: "POST",
        token: ownerToken,
        body: {
          businessId,
          name: "Expiring Item",
          sku: "EXP-1",
          priceCents: 1000,
          quantityOnHand: 12,
          reservedQuantity: 0,
          expiresAt: new Date(now + 6 * 60 * 60 * 1000).toISOString(),
          isActive: true,
        },
      },
    );
    assert.equal(createExpiringInventory.status, 201);
    const expiringInventoryId = createExpiringInventory.body.id as string;

    const expiringQuote = await requestJson(server.baseUrl, "/ops/pricing/quote", {
      method: "POST",
      token: ownerToken,
      body: {
        businessId,
        inventoryItemId: expiringInventoryId,
        quantity: 1,
        asOf: nowIso,
      },
    });
    assert.equal(expiringQuote.status, 200);
    assert.equal(expiringQuote.body?.finalUnitPriceCents, 650);
    assert.equal(expiringQuote.body?.selectedSource, "EXPIRY_CLEARANCE");

    const createExpiredInventory = await requestJson(
      server.baseUrl,
      "/ops/inventory-items",
      {
        method: "POST",
        token: ownerToken,
        body: {
          businessId,
          name: "Expired Item",
          sku: "EXP-2",
          priceCents: 1000,
          quantityOnHand: 12,
          reservedQuantity: 0,
          expiresAt: new Date(now - 60 * 60 * 1000).toISOString(),
          isActive: true,
        },
      },
    );
    assert.equal(createExpiredInventory.status, 201);
    const expiredInventoryId = createExpiredInventory.body.id as string;

    const expiredQuote = await requestJson(server.baseUrl, "/ops/pricing/quote", {
      method: "POST",
      token: ownerToken,
      body: {
        businessId,
        inventoryItemId: expiredInventoryId,
        quantity: 1,
        asOf: nowIso,
        manualOverrideCents: 111,
      },
    });
    assert.equal(expiredQuote.status, 200);
    assert.equal(expiredQuote.body?.purchasable, false);
    assert.equal(expiredQuote.body?.blockedReason, "EXPIRED");
    assert.equal(expiredQuote.body?.finalUnitPriceCents, null);
    assert.equal(expiredQuote.body?.selectedSource, null);
  } finally {
    await server.close();
  }
});
