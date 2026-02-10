import { logEvent, type LogLevel } from "../../../shared/logger.js";
import type {
  NotificationDispatchInput,
  NotificationProvider,
  NotificationProviderResult,
} from "./provider.types.js";

export class DevEmailNotificationProvider implements NotificationProvider {
  readonly name = "email-dev";
  readonly channel = "email" as const;

  constructor(private readonly logLevel: LogLevel) {}

  async send(input: NotificationDispatchInput): Promise<NotificationProviderResult> {
    logEvent("info", this.logLevel, "notification_email_dev_send", {
      jobId: input.jobId,
      businessId: input.businessId,
      audience: input.audience,
      subject: input.subject,
      attempt: input.attempt,
    });

    return {
      accepted: true,
      externalId: `dev-${input.jobId}-${input.attempt}`,
      detail: "Delivered by dev email adapter",
    };
  }
}

