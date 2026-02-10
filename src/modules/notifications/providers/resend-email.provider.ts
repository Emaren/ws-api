import { HttpError } from "../../../shared/http-error.js";
import type {
  NotificationDispatchInput,
  NotificationProvider,
  NotificationProviderResult,
} from "./provider.types.js";

export interface ResendEmailProviderConfig {
  apiKey: string;
  fromEmail: string;
  apiBaseUrl: string;
  defaultSubject: string;
}

interface ResendSuccessResponse {
  id?: string;
}

interface ResendErrorResponse {
  message?: string;
  error?: string;
}

export class ResendEmailNotificationProvider implements NotificationProvider {
  readonly name = "email-resend";
  readonly channel = "email" as const;

  constructor(private readonly config: ResendEmailProviderConfig) {}

  async send(input: NotificationDispatchInput): Promise<NotificationProviderResult> {
    if (!input.audience.includes("@")) {
      throw new HttpError(400, "Email notifications require an email audience target");
    }

    const response = await fetch(`${this.config.apiBaseUrl}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        from: this.config.fromEmail,
        to: [input.audience],
        subject: input.subject?.trim() || this.config.defaultSubject,
        text: input.message,
      }),
    });

    if (!response.ok) {
      const payload = (await response
        .json()
        .catch(() => ({}))) as ResendErrorResponse;
      const detail = payload.message ?? payload.error ?? `HTTP ${response.status}`;
      throw new HttpError(502, `Resend send failed: ${detail}`);
    }

    const payload = (await response.json().catch(() => ({}))) as ResendSuccessResponse;
    return {
      accepted: true,
      externalId: typeof payload.id === "string" ? payload.id : null,
      detail: "Delivered by Resend",
    };
  }
}

