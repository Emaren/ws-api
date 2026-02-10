import * as webpush from "web-push";
import { HttpError } from "../../../shared/http-error.js";
import type {
  NotificationDispatchInput,
  NotificationProvider,
  NotificationProviderResult,
} from "./provider.types.js";

interface EncodedWebPushSubscription {
  endpoint?: unknown;
  expirationTime?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
}

interface WebPushSubscriptionShape {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface WebPushProviderConfig {
  vapidSubject: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  defaultTitle: string;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded = padding === 0 ? normalized : `${normalized}${"=".repeat(4 - padding)}`;
  return Buffer.from(padded, "base64").toString("utf8");
}

function parsePushAudience(audienceRaw: string): WebPushSubscriptionShape {
  const audience = audienceRaw.trim();
  if (!audience) {
    throw new HttpError(
      400,
      "Push notifications require a direct web push subscription audience",
    );
  }

  let payloadText = audience;
  if (audience.startsWith("webpush:")) {
    const encoded = audience.slice("webpush:".length).trim();
    if (!encoded) {
      throw new HttpError(400, "Invalid webpush audience token");
    }
    payloadText = decodeBase64Url(encoded);
  }

  let parsed: EncodedWebPushSubscription;
  try {
    parsed = JSON.parse(payloadText) as EncodedWebPushSubscription;
  } catch {
    throw new HttpError(
      400,
      "Push audience must be a webpush:<base64url(json)> token or raw subscription JSON",
    );
  }

  const endpoint = typeof parsed.endpoint === "string" ? parsed.endpoint.trim() : "";
  const p256dh =
    typeof parsed.keys?.p256dh === "string" ? parsed.keys.p256dh.trim() : "";
  const auth = typeof parsed.keys?.auth === "string" ? parsed.keys.auth.trim() : "";

  if (!endpoint || !p256dh || !auth) {
    throw new HttpError(
      400,
      "Push subscription must include endpoint and keys.p256dh/auth",
    );
  }

  const expirationTime =
    typeof parsed.expirationTime === "number" && Number.isFinite(parsed.expirationTime)
      ? parsed.expirationTime
      : null;

  return {
    endpoint,
    expirationTime,
    keys: {
      p256dh,
      auth,
    },
  };
}

export class WebPushNotificationProvider implements NotificationProvider {
  readonly name = "push-webpush";
  readonly channel = "push" as const;

  constructor(private readonly config: WebPushProviderConfig) {
    webpush.setVapidDetails(
      this.config.vapidSubject,
      this.config.vapidPublicKey,
      this.config.vapidPrivateKey,
    );
  }

  async send(input: NotificationDispatchInput): Promise<NotificationProviderResult> {
    const subscription = parsePushAudience(input.audience);

    const payload = {
      title: input.subject?.trim() || this.config.defaultTitle,
      body: input.message,
      data: {
        ...(input.metadata ?? {}),
        jobId: input.jobId,
        businessId: input.businessId,
      },
    };

    try {
      const result = await webpush.sendNotification(
        subscription,
        JSON.stringify(payload),
        {
          TTL: 60,
          urgency: "normal",
          topic: `ws-${input.jobId}`,
        },
      );

      const externalId =
        result.headers?.location ||
        result.headers?.["x-message-id"] ||
        result.headers?.["x-request-id"] ||
        null;

      return {
        accepted: result.statusCode >= 200 && result.statusCode < 300,
        externalId,
        detail: `Delivered by web-push (${result.statusCode})`,
      };
    } catch (error) {
      if (error instanceof Error) {
        const maybeBody = (error as { body?: unknown }).body;
        const detail = typeof maybeBody === "string" ? maybeBody : error.message;
        throw new HttpError(502, `Web push delivery failed: ${detail}`);
      }
      throw new HttpError(502, "Web push delivery failed");
    }
  }
}
