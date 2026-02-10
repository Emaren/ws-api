import assert from "node:assert/strict";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { createApp } from "./app.js";
import type { AppEnv } from "./config/env.js";

interface JsonResponse {
  status: number;
  body: any;
}

async function startTestServer() {
  const env: AppEnv = {
    nodeEnv: "test",
    serviceName: "ws-api-rbac-test",
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
  assert.equal(typeof register.body?.user?.id, "string");

  const login = await requestJson(baseUrl, "/auth/login", {
    method: "POST",
    body: { email, password },
  });

  assert.equal(login.status, 200);
  assert.equal(typeof login.body?.accessToken, "string");

  return {
    userId: register.body.user.id,
    token: login.body.accessToken,
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

test("RBAC blocks protected routes for unauthenticated requests", async () => {
  const server = await startTestServer();
  try {
    const users = await requestJson(server.baseUrl, "/users");
    assert.equal(users.status, 401);

    const billing = await requestJson(server.baseUrl, "/billing/customers", {
      method: "POST",
      body: { userId: "x", plan: "FREE" },
    });
    assert.equal(billing.status, 401);
  } finally {
    await server.close();
  }
});

test("RBAC enforces OWNER/ADMIN for role management", async () => {
  const server = await startTestServer();
  try {
    const ownerToken = await loginOwner(server.baseUrl);

    const contributor = await registerAndLogin(
      server.baseUrl,
      "contributor@test.local",
      "contribpass123",
      "Contributor",
    );

    const target = await registerAndLogin(
      server.baseUrl,
      "target@test.local",
      "targetpass123",
      "Target",
    );

    const forbidden = await requestJson(
      server.baseUrl,
      `/users/${encodeURIComponent(target.userId)}/role`,
      {
        method: "PATCH",
        token: contributor.token,
        body: { role: "EDITOR" },
      },
    );
    assert.equal(forbidden.status, 403);

    const ownerUpdate = await requestJson(
      server.baseUrl,
      `/users/${encodeURIComponent(contributor.userId)}/role`,
      {
        method: "PATCH",
        token: ownerToken,
        body: { role: "ADMIN" },
      },
    );
    assert.equal(ownerUpdate.status, 200);
    assert.equal(ownerUpdate.body?.role, "ADMIN");

    const adminLogin = await requestJson(server.baseUrl, "/auth/login", {
      method: "POST",
      body: { email: "contributor@test.local", password: "contribpass123" },
    });
    assert.equal(adminLogin.status, 200);

    const adminToken = adminLogin.body.accessToken as string;
    const adminUpdate = await requestJson(
      server.baseUrl,
      `/users/${encodeURIComponent(target.userId)}/role`,
      {
        method: "PATCH",
        token: adminToken,
        body: { role: "USER" },
      },
    );
    assert.equal(adminUpdate.status, 200);
    assert.equal(adminUpdate.body?.role, "USER");
  } finally {
    await server.close();
  }
});

test("RBAC allows editorial roles to create content but blocks USER", async () => {
  const server = await startTestServer();
  try {
    const ownerToken = await loginOwner(server.baseUrl);

    const user = await registerAndLogin(
      server.baseUrl,
      "user@test.local",
      "userpass123",
      "User",
    );

    const contributor = await registerAndLogin(
      server.baseUrl,
      "writer@test.local",
      "writerpass123",
      "Writer",
    );

    const promote = await requestJson(
      server.baseUrl,
      `/users/${encodeURIComponent(contributor.userId)}/role`,
      {
        method: "PATCH",
        token: ownerToken,
        body: { role: "CONTRIBUTOR" },
      },
    );
    assert.equal(promote.status, 200);

    const userArticle = await requestJson(server.baseUrl, "/articles", {
      method: "POST",
      token: user.token,
      body: { title: "User article", content: "No access" },
    });
    assert.equal(userArticle.status, 403);

    const contributorArticle = await requestJson(server.baseUrl, "/articles", {
      method: "POST",
      token: contributor.token,
      body: { title: "Contributor article", content: "Allowed" },
    });
    assert.equal(contributorArticle.status, 201);

    const editor = await registerAndLogin(
      server.baseUrl,
      "editor@test.local",
      "editorpass123",
      "Editor",
    );
    const makeEditor = await requestJson(
      server.baseUrl,
      `/users/${encodeURIComponent(editor.userId)}/role`,
      {
        method: "PATCH",
        token: ownerToken,
        body: { role: "EDITOR" },
      },
    );
    assert.equal(makeEditor.status, 200);

    const businessCreate = await requestJson(server.baseUrl, "/businesses", {
      method: "POST",
      token: editor.token,
      body: {
        name: "Editor Business",
        ownerUserId: editor.userId,
        contactEmail: "editor@test.local",
      },
    });
    assert.equal(businessCreate.status, 201);

    const userBusiness = await requestJson(server.baseUrl, "/businesses", {
      method: "POST",
      token: user.token,
      body: {
        name: "User Business",
        ownerUserId: user.userId,
      },
    });
    assert.equal(userBusiness.status, 403);
  } finally {
    await server.close();
  }
});
