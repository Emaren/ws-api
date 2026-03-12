import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { createApp } from "./app.js";
import type { AppEnv } from "./config/env.js";

interface JsonResponse {
  status: number;
  body: any;
}

function createTestEnv(storePath: string): AppEnv {
  return {
    nodeEnv: "test",
    serviceName: "ws-api-business-ops-persistence-test",
    port: 0,
    bindHost: "127.0.0.1",
    storePath,
    storeFlushIntervalMs: 1_000,
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
}

async function startTestServer(env: AppEnv) {
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
  routePath: string,
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

  const response = await fetch(`${baseUrl}${routePath}`, init);
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

test("business-ops data survives restart when the shared journal is configured", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ws-api-business-ops-"));
  const storePath = path.join(tmpDir, "store.json");
  const env = createTestEnv(storePath);

  const firstServer = await startTestServer(env);
  try {
    const ownerToken = await loginOwner(firstServer.baseUrl);

    const createBusiness = await requestJson(firstServer.baseUrl, "/ops/businesses", {
      method: "POST",
      token: ownerToken,
      body: {
        slug: "restart-proof-market",
        name: "Restart Proof Market",
        status: "ACTIVE",
        timezone: "America/Edmonton",
      },
    });
    assert.equal(createBusiness.status, 201);

    const createCampaign = await requestJson(firstServer.baseUrl, "/ops/campaigns", {
      method: "POST",
      token: ownerToken,
      body: {
        businessId: createBusiness.body.id,
        name: "Restart Proof Launch",
        type: "PROMOTION",
        status: "SCHEDULED",
      },
    });
    assert.equal(createCampaign.status, 201);

    await delay(1_100);
  } finally {
    await firstServer.close();
  }

  const secondServer = await startTestServer(env);
  try {
    const ownerToken = await loginOwner(secondServer.baseUrl);

    const counts = await requestJson(secondServer.baseUrl, "/ops/counts", {
      token: ownerToken,
    });
    assert.equal(counts.status, 200);
    assert.equal(counts.body?.businesses, 1);
    assert.equal(counts.body?.campaigns, 1);

    const businesses = await requestJson(secondServer.baseUrl, "/ops/businesses", {
      token: ownerToken,
    });
    assert.equal(businesses.status, 200);
    assert.equal(Array.isArray(businesses.body), true);
    assert.equal(businesses.body[0]?.slug, "restart-proof-market");

    const health = await requestJson(secondServer.baseUrl, "/health");
    assert.equal(health.status, 200);
    assert.equal(health.body?.storage?.businessOps, "file-journal");
  } finally {
    await secondServer.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
