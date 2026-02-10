import type { AppEnv } from "../../../config/env.js";
import { logEvent } from "../../../shared/logger.js";
import type { NotificationChannel } from "../../../shared/models.js";
import { DevEmailNotificationProvider } from "./dev-email.provider.js";
import { NoopNotificationProvider } from "./noop.provider.js";
import type { NotificationProvider } from "./provider.types.js";
import { ResendEmailNotificationProvider } from "./resend-email.provider.js";

export type NotificationProviderRegistry = Record<NotificationChannel, NotificationProvider>;

export function buildNotificationProviderRegistry(env: AppEnv): NotificationProviderRegistry {
  let emailProvider: NotificationProvider;
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

  return {
    email: emailProvider,
    sms: new NoopNotificationProvider("sms"),
    push: new NoopNotificationProvider("push"),
  };
}

