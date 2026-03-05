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

async function startTestServer(overrides?: Partial<AppEnv>) {
  const env: AppEnv = {
    nodeEnv: "test",
    serviceName: "ws-api-auth-bridge-test",
    port: 0,
    bindHost: "127.0.0.1",
    storePath: "",
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
    ...overrides,
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
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  },
): Promise<JsonResponse> {
  const init: RequestInit = {
    method: options?.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...(options?.headers ?? {}),
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

test("auth bridge password reset requires shared secret", async () => {
  const server = await startTestServer();
  try {
    const response = await requestJson(server.baseUrl, "/auth/password/reset", {
      method: "POST",
      body: {
        email: "owner@test.local",
        password: "newpass123",
      },
      headers: {
        "x-ws-bridge-key": "wrong-key",
      },
    });

    assert.equal(response.status, 503);
    assert.equal(
      response.body?.error?.message,
      "Password bridge is not configured",
    );
  } finally {
    await server.close();
  }
});

test("auth bridge password reset rotates credentials and revokes old sessions", async () => {
  const sharedSecret = "bridge-secret-test";
  const server = await startTestServer({
    authBridgeSharedSecret: sharedSecret,
  });

  try {
    const register = await requestJson(server.baseUrl, "/auth/register", {
      method: "POST",
      body: {
        email: "person@test.local",
        password: "personpass123",
        name: "Person",
      },
    });
    assert.equal(register.status, 201);

    const denied = await requestJson(server.baseUrl, "/auth/password/reset", {
      method: "POST",
      body: {
        email: "person@test.local",
        password: "newpersonpass123",
      },
      headers: {
        "x-ws-bridge-key": "not-correct",
      },
    });
    assert.equal(denied.status, 401);

    const bridgeReset = await requestJson(server.baseUrl, "/auth/password/reset", {
      method: "POST",
      body: {
        email: "person@test.local",
        password: "newpersonpass123",
      },
      headers: {
        "x-ws-bridge-key": sharedSecret,
      },
    });
    assert.equal(bridgeReset.status, 200);
    assert.equal(bridgeReset.body?.message, "Password updated");

    const oldLogin = await requestJson(server.baseUrl, "/auth/login", {
      method: "POST",
      body: {
        email: "person@test.local",
        password: "personpass123",
      },
    });
    assert.equal(oldLogin.status, 401);

    const newLogin = await requestJson(server.baseUrl, "/auth/login", {
      method: "POST",
      body: {
        email: "person@test.local",
        password: "newpersonpass123",
      },
    });
    assert.equal(newLogin.status, 200);
    assert.equal(typeof newLogin.body?.accessToken, "string");
  } finally {
    await server.close();
  }
});
