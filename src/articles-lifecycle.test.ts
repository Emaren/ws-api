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
    serviceName: "ws-api-article-lifecycle-test",
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

test("article lifecycle enforces draft/review/publish/archive transitions", async () => {
  const server = await startTestServer();

  try {
    const ownerToken = await loginOwner(server.baseUrl);
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

    const create = await requestJson(server.baseUrl, "/articles", {
      method: "POST",
      token: contributor.token,
      body: {
        title: "Lifecycle Article",
        content: "Starting draft content",
        status: "DRAFT",
      },
    });
    assert.equal(create.status, 201);
    assert.equal(create.body?.status, "DRAFT");
    const slug = create.body.slug as string;

    const invalidPublish = await requestJson(
      server.baseUrl,
      `/articles/${encodeURIComponent(slug)}`,
      {
        method: "PATCH",
        token: ownerToken,
        body: { status: "PUBLISHED" },
      },
    );
    assert.equal(invalidPublish.status, 409);

    const submitForReview = await requestJson(
      server.baseUrl,
      `/articles/${encodeURIComponent(slug)}`,
      {
        method: "PATCH",
        token: contributor.token,
        body: { status: "REVIEW" },
      },
    );
    assert.equal(submitForReview.status, 200);
    assert.equal(submitForReview.body?.status, "REVIEW");

    const contributorPublish = await requestJson(
      server.baseUrl,
      `/articles/${encodeURIComponent(slug)}`,
      {
        method: "PATCH",
        token: contributor.token,
        body: { status: "PUBLISHED" },
      },
    );
    assert.equal(contributorPublish.status, 403);

    const publish = await requestJson(server.baseUrl, `/articles/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      token: ownerToken,
      body: { status: "PUBLISHED" },
    });
    assert.equal(publish.status, 200);
    assert.equal(publish.body?.status, "PUBLISHED");
    assert.equal(typeof publish.body?.publishedAt, "string");

    const publicList = await requestJson(server.baseUrl, "/articles");
    assert.equal(publicList.status, 200);
    const listedSlugs = Array.isArray(publicList.body)
      ? publicList.body.map((article: { slug: string }) => article.slug)
      : [];
    assert.ok(listedSlugs.includes(slug));

    const archive = await requestJson(server.baseUrl, `/articles/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      token: ownerToken,
      body: { status: "ARCHIVED" },
    });
    assert.equal(archive.status, 200);
    assert.equal(archive.body?.status, "ARCHIVED");

    const publicArchived = await requestJson(server.baseUrl, `/articles/${encodeURIComponent(slug)}`);
    assert.equal(publicArchived.status, 404);
  } finally {
    await server.close();
  }
});

test("contributors can only edit their own drafts/reviews", async () => {
  const server = await startTestServer();

  try {
    const ownerToken = await loginOwner(server.baseUrl);
    const contributorA = await registerAndLogin(
      server.baseUrl,
      "contrib-a@test.local",
      "contribpass123",
      "Contrib A",
    );
    const contributorB = await registerAndLogin(
      server.baseUrl,
      "contrib-b@test.local",
      "contribpass123",
      "Contrib B",
    );

    for (const user of [contributorA, contributorB]) {
      const promote = await requestJson(
        server.baseUrl,
        `/users/${encodeURIComponent(user.userId)}/role`,
        {
          method: "PATCH",
          token: ownerToken,
          body: { role: "CONTRIBUTOR" },
        },
      );
      assert.equal(promote.status, 200);
    }

    const create = await requestJson(server.baseUrl, "/articles", {
      method: "POST",
      token: contributorA.token,
      body: {
        title: "Owned by A",
        content: "A writes this article",
      },
    });
    assert.equal(create.status, 201);

    const editByB = await requestJson(
      server.baseUrl,
      `/articles/${encodeURIComponent(create.body.slug as string)}`,
      {
        method: "PATCH",
        token: contributorB.token,
        body: { title: "Hijacked by B" },
      },
    );
    assert.equal(editByB.status, 403);
  } finally {
    await server.close();
  }
});
