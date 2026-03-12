import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ws-api-health-"));
  const env: AppEnv = {
    nodeEnv: "test",
    serviceName: "ws-api-health-contract-test",
    port: 0,
    bindHost: "127.0.0.1",
    storePath: path.join(tmpDir, "store.json"),
    storeFlushIntervalMs: 5_000,
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
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

async function requestJson(baseUrl: string, routePath: string): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${routePath}`, {
    headers: {
      Accept: "application/json",
    },
  });
  const body = await response.json().catch(() => ({}));
  return {
    status: response.status,
    body,
  };
}

test("health exposes durability details and contract summary", async () => {
  const server = await startTestServer();

  try {
    const health = await requestJson(server.baseUrl, "/health");
    const contract = await requestJson(server.baseUrl, "/api/contract");

    assert.equal(health.status, 200);
    assert.equal(contract.status, 200);

    assert.equal(health.body?.storage?.users, "file-journal");
    assert.equal(health.body?.storage?.authSessions, "file-journal");
    assert.equal(health.body?.storage?.businessOps, "file-journal");
    assert.equal(health.body?.durability?.journalConfigured, true);
    assert.equal(health.body?.durability?.flushIntervalMs, 5_000);
    assert.equal(health.body?.durability?.durableModules, 12);
    assert.equal(health.body?.durability?.volatileModules, 0);
    assert.equal(health.body?.durability?.totalModules, 12);
    assert.equal(health.body?.contract?.version, contract.body?.version);
    assert.equal(health.body?.contract?.routeCount, contract.body?.routes?.length);
    assert.equal(typeof health.body?.contract?.generatedAt, "string");
  } finally {
    await server.close();
  }
});
