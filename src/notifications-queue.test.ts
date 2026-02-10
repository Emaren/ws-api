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

async function startTestServer(
  overrides?: Partial<Pick<AppEnv, "notificationEmailProvider">>,
) {
  const env: AppEnv = {
    nodeEnv: "test",
    serviceName: "ws-api-notifications-test",
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
    notificationEmailProvider: overrides?.notificationEmailProvider ?? "dev",
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

async function loginOwner(baseUrl: string): Promise<string> {
  const login = await requestJson(baseUrl, "/auth/login", {
    method: "POST",
    body: { email: "owner@test.local", password: "ownerpass123" },
  });

  assert.equal(login.status, 200);
  assert.equal(typeof login.body?.accessToken, "string");
  return login.body.accessToken;
}

test("notifications queue processes email job and writes audit trail", async () => {
  const server = await startTestServer();

  try {
    const ownerToken = await loginOwner(server.baseUrl);

    const enqueue = await requestJson(server.baseUrl, "/notifications/jobs", {
      method: "POST",
      token: ownerToken,
      body: {
        businessId: "biz-avalon",
        channel: "email",
        audience: "alerts@example.com",
        subject: "Flash Offer",
        message: "Avalon chocolate milk now on discount",
      },
    });
    assert.equal(enqueue.status, 201);
    assert.equal(enqueue.body?.status, "queued");
    assert.equal(enqueue.body?.attempts, 0);

    const processQueue = await requestJson(server.baseUrl, "/notifications/jobs/process", {
      method: "POST",
      token: ownerToken,
      body: { limit: 10 },
    });
    assert.equal(processQueue.status, 200);
    assert.equal(processQueue.body?.processed, 1);
    assert.equal(processQueue.body?.sent, 1);

    const sentJobs = await requestJson(
      server.baseUrl,
      "/notifications/jobs?status=sent&channel=email",
      {
        token: ownerToken,
      },
    );
    assert.equal(sentJobs.status, 200);
    assert.equal(Array.isArray(sentJobs.body), true);
    assert.equal(sentJobs.body.length, 1);
    assert.equal(sentJobs.body[0]?.status, "sent");
    assert.equal(sentJobs.body[0]?.provider, "email-dev");
    assert.equal(sentJobs.body[0]?.attempts, 1);

    const jobId = sentJobs.body[0]?.id as string;
    const audit = await requestJson(
      server.baseUrl,
      `/notifications/jobs/${encodeURIComponent(jobId)}/audit`,
      {
        token: ownerToken,
      },
    );
    assert.equal(audit.status, 200);
    assert.equal(Array.isArray(audit.body), true);

    const events = audit.body.map((entry: { event: string }) => entry.event);
    assert.ok(events.includes("queued"));
    assert.ok(events.includes("attempt_started"));
    assert.ok(events.includes("attempt_succeeded"));
  } finally {
    await server.close();
  }
});

test("notifications queue retries and fails permanently when provider stays unavailable", async () => {
  const server = await startTestServer();

  try {
    const ownerToken = await loginOwner(server.baseUrl);

    const enqueue = await requestJson(server.baseUrl, "/notifications/jobs", {
      method: "POST",
      token: ownerToken,
      body: {
        businessId: "biz-avalon",
        channel: "sms",
        audience: "+17801230000",
        message: "Limited stock available",
        maxAttempts: 2,
      },
    });
    assert.equal(enqueue.status, 201);
    const jobId = enqueue.body?.id as string;

    const firstProcess = await requestJson(server.baseUrl, "/notifications/jobs/process", {
      method: "POST",
      token: ownerToken,
      body: { limit: 10 },
    });
    assert.equal(firstProcess.status, 200);
    assert.equal(firstProcess.body?.processed, 1);
    assert.equal(firstProcess.body?.retried, 1);
    assert.equal(firstProcess.body?.failed, 0);

    const retryNow = await requestJson(
      server.baseUrl,
      `/notifications/jobs/${encodeURIComponent(jobId)}/retry`,
      {
        method: "POST",
        token: ownerToken,
      },
    );
    assert.equal(retryNow.status, 200);
    assert.equal(retryNow.body?.status, "retrying");

    const secondProcess = await requestJson(server.baseUrl, "/notifications/jobs/process", {
      method: "POST",
      token: ownerToken,
      body: { limit: 10 },
    });
    assert.equal(secondProcess.status, 200);
    assert.equal(secondProcess.body?.processed, 1);
    assert.equal(secondProcess.body?.failed, 1);

    const failedJobs = await requestJson(
      server.baseUrl,
      "/notifications/jobs?status=failed&channel=sms",
      {
        token: ownerToken,
      },
    );
    assert.equal(failedJobs.status, 200);
    assert.equal(failedJobs.body.length, 1);
    assert.equal(failedJobs.body[0]?.id, jobId);
    assert.equal(failedJobs.body[0]?.attempts, 2);
    assert.equal(typeof failedJobs.body[0]?.lastError, "string");

    const globalAudit = await requestJson(
      server.baseUrl,
      `/notifications/audit?jobId=${encodeURIComponent(jobId)}`,
      {
        token: ownerToken,
      },
    );
    assert.equal(globalAudit.status, 200);
    const events = globalAudit.body.map((entry: { event: string }) => entry.event);
    assert.ok(events.includes("attempt_failed"));
    assert.ok(events.includes("retry_scheduled"));
    assert.ok(events.includes("retry_requested"));
    assert.ok(events.includes("failed_final"));
  } finally {
    await server.close();
  }
});

test("push delivery queues graceful email/sms fallback jobs when push fails", async () => {
  const server = await startTestServer();

  try {
    const ownerToken = await loginOwner(server.baseUrl);

    const enqueue = await requestJson(server.baseUrl, "/notifications/jobs", {
      method: "POST",
      token: ownerToken,
      body: {
        businessId: "biz-avalon",
        channel: "push",
        audience: "webpush:not-a-valid-subscription",
        subject: "Push Launch",
        message: "Fresh store offers are now live.",
        metadata: {
          campaignName: "Push Launch",
          fallback: {
            emailAudience: "alerts@example.com",
            smsAudience: "+17801230000",
          },
        },
      },
    });
    assert.equal(enqueue.status, 201);
    const pushJobId = enqueue.body?.id as string;

    const firstRun = await requestJson(server.baseUrl, "/notifications/jobs/process", {
      method: "POST",
      token: ownerToken,
      body: { limit: 10 },
    });
    assert.equal(firstRun.status, 200);
    assert.equal(firstRun.body?.processed, 1);
    assert.equal(firstRun.body?.failed, 1);

    const pushJobs = await requestJson(
      server.baseUrl,
      "/notifications/jobs?status=failed&channel=push",
      {
        token: ownerToken,
      },
    );
    assert.equal(pushJobs.status, 200);
    assert.equal(pushJobs.body.length, 1);
    assert.equal(pushJobs.body[0]?.id, pushJobId);
    assert.match(
      String(pushJobs.body[0]?.lastError),
      /Fallback queued/i,
    );

    const queuedEmail = await requestJson(
      server.baseUrl,
      "/notifications/jobs?status=queued&channel=email",
      {
        token: ownerToken,
      },
    );
    assert.equal(queuedEmail.status, 200);
    assert.equal(queuedEmail.body.length, 1);
    assert.equal(
      queuedEmail.body[0]?.metadata?.fallbackFromJobId,
      pushJobId,
    );

    const queuedSms = await requestJson(
      server.baseUrl,
      "/notifications/jobs?status=queued&channel=sms",
      {
        token: ownerToken,
      },
    );
    assert.equal(queuedSms.status, 200);
    assert.equal(queuedSms.body.length, 1);
    assert.equal(
      queuedSms.body[0]?.metadata?.fallbackFromJobId,
      pushJobId,
    );

    const pushAudit = await requestJson(
      server.baseUrl,
      `/notifications/jobs/${encodeURIComponent(pushJobId)}/audit`,
      {
        token: ownerToken,
      },
    );
    assert.equal(pushAudit.status, 200);
    const pushEvents = pushAudit.body.map((entry: { event: string }) => entry.event);
    assert.ok(pushEvents.includes("fallback_queued"));

    const secondRun = await requestJson(server.baseUrl, "/notifications/jobs/process", {
      method: "POST",
      token: ownerToken,
      body: { limit: 10 },
    });
    assert.equal(secondRun.status, 200);
    assert.equal(secondRun.body?.processed, 2);
    assert.equal(secondRun.body?.sent, 1);
    assert.equal(secondRun.body?.retried, 1);
  } finally {
    await server.close();
  }
});
