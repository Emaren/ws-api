import type { MemoryStore } from "../../infrastructure/memory/memory-store.js";
import { createId, nowIso } from "../../shared/ids.js";
import type {
  NotificationChannel,
  NotificationJobRecord,
  NotificationStatus,
} from "../../shared/models.js";

export interface CreateNotificationJobParams {
  businessId: string;
  channel: NotificationChannel;
  audience: string;
  message: string;
  status: NotificationStatus;
}

export interface NotificationsRepository {
  list(): NotificationJobRecord[];
  create(params: CreateNotificationJobParams): NotificationJobRecord;
}

export class InMemoryNotificationsRepository implements NotificationsRepository {
  constructor(private readonly store: MemoryStore) {}

  list(): NotificationJobRecord[] {
    return [...this.store.notifications];
  }

  create(params: CreateNotificationJobParams): NotificationJobRecord {
    const job: NotificationJobRecord = {
      id: createId("ntf"),
      businessId: params.businessId,
      channel: params.channel,
      audience: params.audience,
      message: params.message,
      status: params.status,
      createdAt: nowIso(),
    };

    this.store.notifications.push(job);
    return job;
  }
}
