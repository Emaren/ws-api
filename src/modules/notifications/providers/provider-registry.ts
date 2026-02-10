import type { AppEnv } from "../../../config/env.js";
import { logEvent } from "../../../shared/logger.js";
import type { NotificationChannel } from "../../../shared/models.js";
import { DevEmailNotificationProvider } from "./dev-email.provider.js";
import { NoopNotificationProvider } from "./noop.provider.js";
import type { NotificationProvider } from "./provider.types.js";
import { ResendEmailNotificationProvider } from "./resend-email.provider.js";
import { WebPushNotificationProvider } from "./web-push.provider.js";

export type NotificationProviderRegistry = Record<NotificationChannel, NotificationProvider>;

export function buildNotificationProviderRegistry(env: AppEnv): NotificationProviderRegistry {
  let emailProvider: NotificationProvider;
  let pushProvider: NotificationProvider;
  if (
    env.notificationEmailProvider === "resend" &&
    env.notificationEmailApiKey &&
    env.notificationEmailFrom
  ) {
    emailProvider = new ResendEmailNotificationProvider({
      apiKey: env.notificationEmailApiKey,
      fromEmail: env.notificationEmailFrom,
      apiBaseUrl: env.notificationEmailApiBaseUrl,
      defaultSubject: env.notificationDefaultSubject,
    });
  } else {
    emailProvider = new DevEmailNotificationProvider(env.logLevel);
    logEvent("warn", env.logLevel, "notification_email_provider_fallback", {
      configuredProvider: env.notificationEmailProvider,
      reason:
        env.notificationEmailProvider === "resend"
          ? "missing_notification_email_api_key_or_from"
          : "notification_email_provider_not_resend",
    });
  }

  if (
    env.notificationPushProvider === "webpush" &&
    env.notificationPushVapidPublicKey &&
    env.notificationPushVapidPrivateKey
  ) {
    pushProvider = new WebPushNotificationProvider({
      vapidSubject: env.notificationPushVapidSubject,
      vapidPublicKey: env.notificationPushVapidPublicKey,
      vapidPrivateKey: env.notificationPushVapidPrivateKey,
      defaultTitle: env.notificationDefaultSubject,
    });
  } else {
    pushProvider = new NoopNotificationProvider("push");
    logEvent("warn", env.logLevel, "notification_push_provider_fallback", {
      configuredProvider: env.notificationPushProvider,
      reason:
        env.notificationPushProvider === "webpush"
          ? "missing_notification_push_vapid_keys"
          : "notification_push_provider_not_webpush",
    });
  }

  return {
    email: emailProvider,
    sms: new NoopNotificationProvider("sms"),
    push: pushProvider,
  };
}
