import type { NotificationChannel } from "../../../shared/models.js";

export interface NotificationDispatchInput {
  jobId: string;
  businessId: string;
  channel: NotificationChannel;
  audience: string;
  subject: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  attempt: number;
}

export interface NotificationProviderResult {
  accepted: boolean;
  externalId: string | null;
  detail: string | null;
}

export interface NotificationProvider {
  readonly name: string;
  readonly channel: NotificationChannel;
  send(input: NotificationDispatchInput): Promise<NotificationProviderResult>;
}

