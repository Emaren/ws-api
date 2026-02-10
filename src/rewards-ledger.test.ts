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
    serviceName: "ws-api-rewards-test",
    port: 0,
    logLevel: "error",
    corsOrigins: [],
    allowWildcardCorsInProduction: true,
    authSessionTtlSeconds: 3600,
    bootstrapAdminEmail: "owner@test.local",
    bootstrapAdminPassword: "ownerpass123",
    bootstrapAdminName: "Owner",
    notificationMaxAttempts: 3,
    notificationRetryBaseMs: 5,
    notificationRetryMaxMs: 50,
    notificationDefaultSubject: "Test Notification",
    notificationEmailProvider: "dev",
    notificationEmailApiKey: undefined,
    notificationEmailFrom: undefined,
    notificationEmailApiBaseUrl: "https://api.resend.com",
    notificationPushProvider: "noop",
    notificationPushVapidSubject: "mailto:notifications@wheatandstone.ca",
    notificationPushVapidPublicKey: undefined,
    notificationPushVapidPrivateKey: undefined,
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

async function registerAndLogin(
  baseUrl: string,
  email: string,
  password: string,
  name: string,
): Promise<{ userId: string; token: string }> {
  const register = await requestJson(baseUrl, "/auth/register", {
    method: "POST",
    body: { email, password, name },
  });

  assert.equal(register.status, 201);

  const login = await requestJson(baseUrl, "/auth/login", {
    method: "POST",
    body: { email, password },
  });

  assert.equal(login.status, 200);

  return {
    userId: register.body.user.id as string,
    token: login.body.accessToken as string,
  };
}

async function loginOwner(baseUrl: string): Promise<string> {
  const login = await requestJson(baseUrl, "/auth/login", {
    method: "POST",
    body: { email: "owner@test.local", password: "ownerpass123" },
  });

  assert.equal(login.status, 200);
  return login.body.accessToken as string;
}

test("rewards rule accrual applies anti-abuse constraints", async () => {
  const server = await startTestServer();

  try {
    const account = await registerAndLogin(
      server.baseUrl,
      "reward-user@test.local",
      "rewardpass123",
      "Reward User",
    );

    const first = await requestJson(server.baseUrl, "/rewards/accrual", {
      method: "POST",
      token: account.token,
      body: {
        ruleId: "ARTICLE_VIEW_STONE",
        sourceType: "article",
        sourceId: "avalon-article",
      },
    });

    assert.equal(first.status, 201);
    assert.equal(first.body.token, "STONE");
    assert.equal(first.body.amount, 1);

    const duplicateSource = await requestJson(server.baseUrl, "/rewards/accrual", {
      method: "POST",
      token: account.token,
      body: {
        ruleId: "ARTICLE_VIEW_STONE",
        sourceType: "article",
        sourceId: "avalon-article",
      },
    });

    assert.equal(duplicateSource.status, 409);

    const cooldownHit = await requestJson(server.baseUrl, "/rewards/accrual", {
      method: "POST",
      token: account.token,
      body: {
        ruleId: "ARTICLE_VIEW_STONE",
        sourceType: "article",
        sourceId: "avalon-article-2",
      },
    });

    assert.equal(cooldownHit.status, 429);

    const publish = await requestJson(server.baseUrl, "/rewards/accrual", {
      method: "POST",
      token: account.token,
      body: {
        ruleId: "ARTICLE_PUBLISH_WHEAT",
        sourceType: "article",
        sourceId: "publish-1",
      },
    });

    assert.equal(publish.status, 201);
    assert.equal(publish.body.token, "WHEAT");
    assert.equal(publish.body.amount, 50);

    const duplicatePublish = await requestJson(server.baseUrl, "/rewards/accrual", {
      method: "POST",
      token: account.token,
      body: {
        ruleId: "ARTICLE_PUBLISH_WHEAT",
        sourceType: "article",
        sourceId: "publish-1",
      },
    });

    assert.equal(duplicatePublish.status, 409);

    const ledger = await requestJson(server.baseUrl, "/rewards/ledger", {
      method: "GET",
      token: account.token,
    });

    assert.equal(ledger.status, 200);
    assert.equal(Array.isArray(ledger.body), true);
    assert.equal(ledger.body.length, 2);
    assert.equal(ledger.body[0].payoutStatus, "PENDING");
  } finally {
    await server.close();
  }
});

test("owner/admin can report, export, and settle payout batches", async () => {
  const server = await startTestServer();

  try {
    const ownerToken = await loginOwner(server.baseUrl);
    const account = await registerAndLogin(
      server.baseUrl,
      "payout-user@test.local",
      "payoutpass123",
      "Payout User",
    );

    const userAccrual = await requestJson(server.baseUrl, "/rewards/accrual", {
      method: "POST",
      token: account.token,
      body: {
        ruleId: "NOTIFICATION_OPT_IN_STONE",
        sourceType: "notification",
        sourceId: "notif-opt-1",
      },
    });
    assert.equal(userAccrual.status, 201);

    const ownerAccrualForUser = await requestJson(server.baseUrl, "/rewards/accrual", {
      method: "POST",
      token: ownerToken,
      body: {
        ruleId: "DELIVERY_LEAD_WHEAT",
        sourceType: "deliveryLead",
        sourceId: "lead-123",
        targetUserId: account.userId,
        quantity: 2,
      },
    });
    assert.equal(ownerAccrualForUser.status, 201);
    assert.equal(ownerAccrualForUser.body.amount, 20);

    const manualGrant = await requestJson(server.baseUrl, "/rewards/ledger", {
      method: "POST",
      token: ownerToken,
      body: {
        userId: account.userId,
        token: "WHEAT",
        amount: 100,
        reason: "Manual bridge allocation",
      },
    });
    assert.equal(manualGrant.status, 201);

    const forbiddenReport = await requestJson(server.baseUrl, "/rewards/report", {
      method: "GET",
      token: account.token,
    });
    assert.equal(forbiddenReport.status, 403);

    const report = await requestJson(server.baseUrl, "/rewards/report", {
      method: "GET",
      token: ownerToken,
    });
    assert.equal(report.status, 200);
    assert.equal(report.body.summary.entries, 3);
    assert.equal(report.body.summary.totalByToken.WHEAT, 120);
    assert.equal(report.body.summary.totalByToken.STONE, 5);

    const exportPreview = await requestJson(
      server.baseUrl,
      "/rewards/export?format=json&payoutStatus=PENDING",
      {
        method: "GET",
        token: ownerToken,
      },
    );

    assert.equal(exportPreview.status, 200);
    assert.equal(exportPreview.body.format, "json");
    assert.equal(exportPreview.body.count, 3);

    const ids = (exportPreview.body.entries as Array<{ id: string }>).map((entry) => entry.id);

    const markExport = await requestJson(server.baseUrl, "/rewards/export/mark", {
      method: "POST",
      token: ownerToken,
      body: {
        entryIds: ids,
      },
    });

    assert.equal(markExport.status, 200);
    assert.equal(markExport.body.exported, 3);
    assert.equal(typeof markExport.body.payoutBatchId, "string");

    const batchId = markExport.body.payoutBatchId as string;

    const settle = await requestJson(server.baseUrl, "/rewards/export/settle", {
      method: "POST",
      token: ownerToken,
      body: {
        payoutBatchId: batchId,
        payoutTxHash: "0xabc123",
      },
    });

    assert.equal(settle.status, 200);
    assert.equal(settle.body.settled, 3);

    const paidReport = await requestJson(server.baseUrl, "/rewards/report?payoutStatus=PAID", {
      method: "GET",
      token: ownerToken,
    });

    assert.equal(paidReport.status, 200);
    assert.equal(paidReport.body.summary.entries, 3);
    assert.equal(paidReport.body.summary.paidByToken.WHEAT, 120);
    assert.equal(paidReport.body.summary.paidByToken.STONE, 5);
  } finally {
    await server.close();
  }
});
