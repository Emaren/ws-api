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
    serviceName: "ws-api-business-ops-test",
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

test("business-ops CRUD endpoints support new schema resources with validation", async () => {
  const server = await startTestServer();

  try {
    const ownerToken = await loginOwner(server.baseUrl);

    const createBusiness = await requestJson(server.baseUrl, "/ops/businesses", {
      method: "POST",
      token: ownerToken,
      body: {
        slug: "avalon-foods",
        name: "Avalon Foods",
        status: "ACTIVE",
        timezone: "America/Edmonton",
      },
    });
    assert.equal(createBusiness.status, 201);
    const businessId = createBusiness.body.id as string;

    const duplicateBusiness = await requestJson(server.baseUrl, "/ops/businesses", {
      method: "POST",
      token: ownerToken,
      body: {
        slug: "avalon-foods",
        name: "Duplicate Avalon",
      },
    });
    assert.equal(duplicateBusiness.status, 409);

    const createStoreProfile = await requestJson(server.baseUrl, "/ops/store-profiles", {
      method: "POST",
      token: ownerToken,
      body: {
        businessId,
        displayName: "Avalon Downtown",
        city: "Edmonton",
        pickupEnabled: true,
        deliveryEnabled: false,
      },
    });
    assert.equal(createStoreProfile.status, 201);
    const storeProfileId = createStoreProfile.body.id as string;

    const createInventory = await requestJson(server.baseUrl, "/ops/inventory-items", {
      method: "POST",
      token: ownerToken,
      body: {
        businessId,
        sku: "AVALON-CHOC-1L",
        name: "Avalon Chocolate Milk",
        priceCents: 799,
        quantityOnHand: 20,
      },
    });
    assert.equal(createInventory.status, 201);
    const inventoryId = createInventory.body.id as string;

    const invalidPricingRule = await requestJson(server.baseUrl, "/ops/pricing-rules", {
      method: "POST",
      token: ownerToken,
      body: {
        businessId,
        inventoryItemId: inventoryId,
        name: "Bad Rule",
        ruleType: "INVALID",
      },
    });
    assert.equal(invalidPricingRule.status, 400);

    const createPricingRule = await requestJson(server.baseUrl, "/ops/pricing-rules", {
      method: "POST",
      token: ownerToken,
      body: {
        businessId,
        inventoryItemId: inventoryId,
        name: "10% Off",
        ruleType: "PERCENT_OFF",
        percentOff: 10,
      },
    });
    assert.equal(createPricingRule.status, 201);
    const pricingRuleId = createPricingRule.body.id as string;

    const createCampaign = await requestJson(server.baseUrl, "/ops/campaigns", {
      method: "POST",
      token: ownerToken,
      body: {
        businessId,
        name: "Chocolate Launch",
        type: "PROMOTION",
        status: "SCHEDULED",
      },
    });
    assert.equal(createCampaign.status, 201);
    const campaignId = createCampaign.body.id as string;

    const createOffer = await requestJson(server.baseUrl, "/ops/offers", {
      method: "POST",
      token: ownerToken,
      body: {
        businessId,
        inventoryItemId: inventoryId,
        pricingRuleId,
        campaignId,
        title: "Launch Deal",
        couponCode: "AVALON10",
        status: "DRAFT",
      },
    });
    assert.equal(createOffer.status, 201);
    const offerId = createOffer.body.id as string;

    const createRecipient = await requestJson(
      server.baseUrl,
      "/ops/notification-recipients",
      {
        method: "POST",
        token: ownerToken,
        body: {
          businessId,
          name: "Tony",
          email: "tony@example.com",
          preferredChannel: "EMAIL",
        },
      },
    );
    assert.equal(createRecipient.status, 201);
    const recipientId = createRecipient.body.id as string;

    const createLead = await requestJson(server.baseUrl, "/ops/delivery-leads", {
      method: "POST",
      token: ownerToken,
      body: {
        businessId,
        inventoryItemId: inventoryId,
        offerId,
        recipientId,
        requestedQty: 2,
        status: "NEW",
      },
    });
    assert.equal(createLead.status, 201);
    const deliveryLeadId = createLead.body.id as string;

    const createClick = await requestJson(server.baseUrl, "/ops/affiliate-clicks", {
      method: "POST",
      token: ownerToken,
      body: {
        businessId,
        campaignId,
        network: "TOKENTAP",
        destinationUrl: "https://tokentap.ca",
      },
    });
    assert.equal(createClick.status, 201);
    const clickId = createClick.body.id as string;

    const createRewardEntry = await requestJson(server.baseUrl, "/ops/reward-ledger", {
      method: "POST",
      token: ownerToken,
      body: {
        businessId,
        campaignId,
        token: "WHEAT",
        direction: "CREDIT",
        amount: 15,
        reason: "Contributor bonus",
        externalRef: "bonus-1",
      },
    });
    assert.equal(createRewardEntry.status, 201);
    const rewardId = createRewardEntry.body.id as string;

    const patchBusiness = await requestJson(
      server.baseUrl,
      `/ops/businesses/${encodeURIComponent(businessId)}`,
      {
        method: "PATCH",
        token: ownerToken,
        body: { status: "PAUSED", isVerified: true },
      },
    );
    assert.equal(patchBusiness.status, 200);
    assert.equal(patchBusiness.body.status, "PAUSED");

    const patchStoreProfile = await requestJson(
      server.baseUrl,
      `/ops/store-profiles/${encodeURIComponent(storeProfileId)}`,
      {
        method: "PATCH",
        token: ownerToken,
        body: { deliveryEnabled: true },
      },
    );
    assert.equal(patchStoreProfile.status, 200);
    assert.equal(patchStoreProfile.body.deliveryEnabled, true);

    const patchInventory = await requestJson(
      server.baseUrl,
      `/ops/inventory-items/${encodeURIComponent(inventoryId)}`,
      {
        method: "PATCH",
        token: ownerToken,
        body: { quantityOnHand: 18 },
      },
    );
    assert.equal(patchInventory.status, 200);
    assert.equal(patchInventory.body.quantityOnHand, 18);

    const patchRule = await requestJson(
      server.baseUrl,
      `/ops/pricing-rules/${encodeURIComponent(pricingRuleId)}`,
      {
        method: "PATCH",
        token: ownerToken,
        body: { isActive: false },
      },
    );
    assert.equal(patchRule.status, 200);
    assert.equal(patchRule.body.isActive, false);

    const patchOffer = await requestJson(
      server.baseUrl,
      `/ops/offers/${encodeURIComponent(offerId)}`,
      {
        method: "PATCH",
        token: ownerToken,
        body: { status: "LIVE", featured: true },
      },
    );
    assert.equal(patchOffer.status, 200);
    assert.equal(patchOffer.body.status, "LIVE");

    const patchCampaign = await requestJson(
      server.baseUrl,
      `/ops/campaigns/${encodeURIComponent(campaignId)}`,
      {
        method: "PATCH",
        token: ownerToken,
        body: { status: "LIVE" },
      },
    );
    assert.equal(patchCampaign.status, 200);
    assert.equal(patchCampaign.body.status, "LIVE");

    const patchRecipient = await requestJson(
      server.baseUrl,
      `/ops/notification-recipients/${encodeURIComponent(recipientId)}`,
      {
        method: "PATCH",
        token: ownerToken,
        body: { preferredChannel: "SMS", smsOptIn: true },
      },
    );
    assert.equal(patchRecipient.status, 200);
    assert.equal(patchRecipient.body.preferredChannel, "SMS");

    const patchLead = await requestJson(
      server.baseUrl,
      `/ops/delivery-leads/${encodeURIComponent(deliveryLeadId)}`,
      {
        method: "PATCH",
        token: ownerToken,
        body: { status: "CONTACTED" },
      },
    );
    assert.equal(patchLead.status, 200);
    assert.equal(patchLead.body.status, "CONTACTED");

    const patchClick = await requestJson(
      server.baseUrl,
      `/ops/affiliate-clicks/${encodeURIComponent(clickId)}`,
      {
        method: "PATCH",
        token: ownerToken,
        body: { sourceContext: "article_footer" },
      },
    );
    assert.equal(patchClick.status, 200);
    assert.equal(patchClick.body.sourceContext, "article_footer");

    const patchReward = await requestJson(
      server.baseUrl,
      `/ops/reward-ledger/${encodeURIComponent(rewardId)}`,
      {
        method: "PATCH",
        token: ownerToken,
        body: { direction: "DEBIT", amount: -5 },
      },
    );
    assert.equal(patchReward.status, 200);
    assert.equal(patchReward.body.direction, "DEBIT");
    assert.equal(patchReward.body.amount, -5);

    const counts = await requestJson(server.baseUrl, "/ops/counts", {
      token: ownerToken,
    });
    assert.equal(counts.status, 200);
    assert.equal(counts.body.businesses, 1);
    assert.equal(counts.body.storeProfiles, 1);
    assert.equal(counts.body.inventoryItems, 1);
    assert.equal(counts.body.pricingRules, 1);
    assert.equal(counts.body.offers, 1);
    assert.equal(counts.body.campaigns, 1);
    assert.equal(counts.body.notificationRecipients, 1);
    assert.equal(counts.body.deliveryLeads, 1);
    assert.equal(counts.body.affiliateClicks, 1);
    assert.equal(counts.body.rewardLedger, 1);

    const deletes = [
      ["reward-ledger", rewardId],
      ["affiliate-clicks", clickId],
      ["delivery-leads", deliveryLeadId],
      ["notification-recipients", recipientId],
      ["offers", offerId],
      ["pricing-rules", pricingRuleId],
      ["inventory-items", inventoryId],
      ["campaigns", campaignId],
      ["store-profiles", storeProfileId],
      ["businesses", businessId],
    ] as const;

    for (const [resource, id] of deletes) {
      const response = await requestJson(
        server.baseUrl,
        `/ops/${resource}/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          token: ownerToken,
        },
      );
      assert.equal(response.status, 200);
      assert.equal(response.body?.deleted, true);
    }

    const deletedGet = await requestJson(
      server.baseUrl,
      `/ops/businesses/${encodeURIComponent(businessId)}`,
      { token: ownerToken },
    );
    assert.equal(deletedGet.status, 404);
  } finally {
    await server.close();
  }
});
