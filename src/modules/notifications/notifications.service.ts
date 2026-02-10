import { HttpError } from "../../shared/http-error.js";
import type {
  NotificationChannel,
  NotificationJobRecord,
  NotificationStatus,
} from "../../shared/models.js";
import type { NotificationsRepository } from "./notifications.repository.js";

const CHANNELS: NotificationChannel[] = ["email", "sms", "push"];
const DEFAULT_STATUS: NotificationStatus = "queued";

interface QueueNotificationInput {
  businessId: string;
  channel: string;
  audience: string;
  message: string;
}

export class NotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository) {}

  listJobs(): NotificationJobRecord[] {
    return this.notificationsRepository.list();
  }

  queueNotification(input: QueueNotificationInput): NotificationJobRecord {
    if (!input.businessId.trim() || !input.message.trim()) {
      throw new HttpError(400, "Missing businessId or message");
    }

    if (!CHANNELS.includes(input.channel as NotificationChannel)) {
      throw new HttpError(400, "Invalid notification channel");
    }

    return this.notificationsRepository.create({
      businessId: input.businessId.trim(),
      channel: input.channel as NotificationChannel,
      audience: input.audience.trim() || "all",
      message: input.message.trim(),
      status: DEFAULT_STATUS,
    });
  }
}
