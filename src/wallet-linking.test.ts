import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { makeSignDoc, serializeSignDoc } from "@cosmjs/amino";
import { Secp256k1, ripemd160, sha256 } from "@cosmjs/crypto";
import { toBase64, toBech32, toUtf8 } from "@cosmjs/encoding";
import { createApp } from "./app.js";
import type { AppEnv } from "./config/env.js";

interface JsonResponse {
  status: number;
  body: any;
}

interface LinkedWallet {
  walletAddress: string;
}

async function startTestServer() {
  const env: AppEnv = {
    nodeEnv: "test",
    serviceName: "ws-api-wallet-test",
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

async function registerAndLogin(
  baseUrl: string,
  email: string,
  password: string,
  name: string,
): Promise<{ token: string }> {
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
  assert.equal(typeof login.body?.accessToken, "string");

  return {
    token: login.body.accessToken,
  };
}

function createCosmosWallet(prefix: string): {
  walletAddress: string;
  publicKeyBase64: string;
  signChallenge: (message: string) => string;
} {
  const privkey = randomBytes(32);
  const keypair = Secp256k1.makeKeypair(privkey);
  const compressedPubkey = Secp256k1.compressPubkey(keypair.pubkey);
  const walletAddress = toBech32(prefix, ripemd160(sha256(compressedPubkey)));

  const signChallenge = (message: string): string => {
    const signDoc = makeSignDoc(
      [
        {
          type: "sign/MsgSignData",
          value: {
            signer: walletAddress,
            data: toBase64(toUtf8(message)),
          },
        },
      ],
      {
        gas: "0",
        amount: [],
      },
      "",
      undefined,
      "0",
      "0",
    );

    const signBytes = serializeSignDoc(signDoc);
    const digest = sha256(signBytes);
    const signature = Secp256k1.createSignature(digest, privkey).toFixedLength().slice(0, 64);
    return toBase64(signature);
  };

  return {
    walletAddress,
    publicKeyBase64: toBase64(compressedPubkey),
    signChallenge,
  };
}

async function linkWallet(
  baseUrl: string,
  token: string,
  wallet: ReturnType<typeof createCosmosWallet>,
): Promise<LinkedWallet> {
  const challenge = await requestJson(baseUrl, "/auth/wallet/challenge", {
    method: "POST",
    token,
    body: {
      chainType: "COSMOS",
      walletAddress: wallet.walletAddress,
    },
  });

  assert.equal(challenge.status, 201);
  assert.equal(typeof challenge.body?.challengeId, "string");
  assert.equal(typeof challenge.body?.message, "string");

  const signature = wallet.signChallenge(challenge.body.message);

  const linked = await requestJson(baseUrl, "/auth/wallet/link", {
    method: "POST",
    token,
    body: {
      challengeId: challenge.body.challengeId,
      signature,
      publicKey: wallet.publicKeyBase64,
    },
  });

  assert.equal(linked.status, 200);
  assert.equal(linked.body?.wallet?.walletAddress, wallet.walletAddress);

  return linked.body.wallet;
}

test("wallet linking verifies signature and persists association", async () => {
  const server = await startTestServer();
  try {
    const account = await registerAndLogin(
      server.baseUrl,
      "wallet-user@test.local",
      "walletpass123",
      "Wallet User",
    );

    const wallet = createCosmosWallet("wheat");

    const linked = await linkWallet(server.baseUrl, account.token, wallet);
    assert.equal(linked.walletAddress, wallet.walletAddress);

    const fetchLinked = await requestJson(server.baseUrl, "/auth/wallet", {
      method: "GET",
      token: account.token,
    });

    assert.equal(fetchLinked.status, 200);
    assert.equal(fetchLinked.body?.wallet?.walletAddress, wallet.walletAddress);

    const challenge = await requestJson(server.baseUrl, "/auth/wallet/challenge", {
      method: "POST",
      token: account.token,
      body: {
        chainType: "COSMOS",
        walletAddress: wallet.walletAddress,
      },
    });

    assert.equal(challenge.status, 201);

    const linkOnce = await requestJson(server.baseUrl, "/auth/wallet/link", {
      method: "POST",
      token: account.token,
      body: {
        challengeId: challenge.body.challengeId,
        signature: wallet.signChallenge(challenge.body.message),
        publicKey: wallet.publicKeyBase64,
      },
    });

    assert.equal(linkOnce.status, 200);

    const replay = await requestJson(server.baseUrl, "/auth/wallet/link", {
      method: "POST",
      token: account.token,
      body: {
        challengeId: challenge.body.challengeId,
        signature: wallet.signChallenge(challenge.body.message),
        publicKey: wallet.publicKeyBase64,
      },
    });

    assert.equal(replay.status, 409);

    const unlink = await requestJson(server.baseUrl, "/auth/wallet", {
      method: "DELETE",
      token: account.token,
    });

    assert.equal(unlink.status, 200);
    assert.equal(unlink.body?.unlinked, true);

    const afterUnlink = await requestJson(server.baseUrl, "/auth/wallet", {
      method: "GET",
      token: account.token,
    });
    assert.equal(afterUnlink.status, 200);
    assert.equal(afterUnlink.body?.wallet, null);
  } finally {
    await server.close();
  }
});

test("wallet linking blocks signature mismatch and cross-user takeover", async () => {
  const server = await startTestServer();
  try {
    const first = await registerAndLogin(
      server.baseUrl,
      "first-wallet@test.local",
      "firstpass123",
      "First",
    );
    const second = await registerAndLogin(
      server.baseUrl,
      "second-wallet@test.local",
      "secondpass123",
      "Second",
    );

    const targetWallet = createCosmosWallet("wheat");
    const attackerWallet = createCosmosWallet("wheat");

    await linkWallet(server.baseUrl, first.token, targetWallet);

    const badChallenge = await requestJson(server.baseUrl, "/auth/wallet/challenge", {
      method: "POST",
      token: second.token,
      body: {
        chainType: "COSMOS",
        walletAddress: attackerWallet.walletAddress,
      },
    });
    assert.equal(badChallenge.status, 201);

    const badLink = await requestJson(server.baseUrl, "/auth/wallet/link", {
      method: "POST",
      token: second.token,
      body: {
        challengeId: badChallenge.body.challengeId,
        signature: attackerWallet.signChallenge(`${badChallenge.body.message} tampered`),
        publicKey: attackerWallet.publicKeyBase64,
      },
    });
    assert.equal(badLink.status, 401);

    const takeoverChallenge = await requestJson(server.baseUrl, "/auth/wallet/challenge", {
      method: "POST",
      token: second.token,
      body: {
        chainType: "COSMOS",
        walletAddress: targetWallet.walletAddress,
      },
    });
    assert.equal(takeoverChallenge.status, 201);

    const takeover = await requestJson(server.baseUrl, "/auth/wallet/link", {
      method: "POST",
      token: second.token,
      body: {
        challengeId: takeoverChallenge.body.challengeId,
        signature: targetWallet.signChallenge(takeoverChallenge.body.message),
        publicKey: targetWallet.publicKeyBase64,
      },
    });

    assert.equal(takeover.status, 409);
  } finally {
    await server.close();
  }
});
