import type { MemoryStore } from "../../infrastructure/memory/memory-store.js";
import { createId, nowIso } from "../../shared/ids.js";
import type {
  NotificationAuditEvent,
  NotificationAuditLogRecord,
  NotificationChannel,
  NotificationJobRecord,
  NotificationStatus,
} from "../../shared/models.js";

export interface CreateNotificationJobParams {
  businessId: string;
  channel: NotificationChannel;
  audience: string;
  subject: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  status: NotificationStatus;
  maxAttempts: number;
  nextAttemptAt: string;
}

export interface UpdateNotificationJobParams {
  status?: NotificationStatus;
  provider?: string | null;
  attempts?: number;
  nextAttemptAt?: string;
  lastAttemptAt?: string | null;
  sentAt?: string | null;
  failedAt?: string | null;
  lastError?: string | null;
}

export interface CreateNotificationAuditLogParams {
  jobId: string;
  event: NotificationAuditEvent;
  channel: NotificationChannel;
  provider: string | null;
  attempt: number | null;
  message: string;
  detail: Record<string, unknown> | null;
}

export interface NotificationJobsFilter {
  status?: NotificationStatus;
  channel?: NotificationChannel;
  businessId?: string;
}

export interface NotificationsRepository {
  list(filter?: NotificationJobsFilter): NotificationJobRecord[];
  listDue(nowIsoDate: string, limit: number): NotificationJobRecord[];
  getById(id: string): NotificationJobRecord | undefined;
  create(params: CreateNotificationJobParams): NotificationJobRecord;
  update(id: string, patch: UpdateNotificationJobParams): NotificationJobRecord | undefined;
  createAuditLog(params: CreateNotificationAuditLogParams): NotificationAuditLogRecord;
  listAuditLogs(jobId?: string): NotificationAuditLogRecord[];
}

export class InMemoryNotificationsRepository implements NotificationsRepository {
  constructor(private readonly store: MemoryStore) {}

  list(filter?: NotificationJobsFilter): NotificationJobRecord[] {
    return this.store.notifications
      .filter((job) => {
        if (filter?.status && job.status !== filter.status) return false;
        if (filter?.channel && job.channel !== filter.channel) return false;
        if (filter?.businessId && job.businessId !== filter.businessId) return false;
        return true;
      })
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  listDue(nowIsoDate: string, limit: number): NotificationJobRecord[] {
    const max = Math.max(1, Math.trunc(limit));
    return this.store.notifications
      .filter((job) => {
        if (job.status !== "queued" && job.status !== "retrying") return false;
        if (job.nextAttemptAt > nowIsoDate) return false;
        if (job.attempts >= job.maxAttempts) return false;
        return true;
      })
      .slice()
      .sort((a, b) => a.nextAttemptAt.localeCompare(b.nextAttemptAt))
      .slice(0, max);
  }

  getById(id: string): NotificationJobRecord | undefined {
    return this.store.notifications.find((job) => job.id === id);
  }

  create(params: CreateNotificationJobParams): NotificationJobRecord {
    const now = nowIso();
    const job: NotificationJobRecord = {
      id: createId("ntf"),
      businessId: params.businessId,
      channel: params.channel,
      audience: params.audience,
      subject: params.subject,
      message: params.message,
      metadata: params.metadata,
      status: params.status,
      provider: null,
      attempts: 0,
      maxAttempts: params.maxAttempts,
      nextAttemptAt: params.nextAttemptAt,
      lastAttemptAt: null,
      sentAt: null,
      failedAt: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };

    this.store.notifications.push(job);
    return job;
  }

  update(id: string, patch: UpdateNotificationJobParams): NotificationJobRecord | undefined {
    const index = this.store.notifications.findIndex((job) => job.id === id);
    if (index < 0) {
      return undefined;
    }

    const current = this.store.notifications[index];
    if (!current) {
      return undefined;
    }

    const next: NotificationJobRecord = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
    };

    this.store.notifications[index] = next;
    return next;
  }

  createAuditLog(params: CreateNotificationAuditLogParams): NotificationAuditLogRecord {
    const entry: NotificationAuditLogRecord = {
      id: createId("ntf_audit"),
      jobId: params.jobId,
      event: params.event,
      channel: params.channel,
      provider: params.provider,
      attempt: params.attempt,
      message: params.message,
      detail: params.detail,
      createdAt: nowIso(),
    };

    this.store.notificationAuditLogs.push(entry);
    return entry;
  }

  listAuditLogs(jobId?: string): NotificationAuditLogRecord[] {
    return this.store.notificationAuditLogs
      .filter((entry) => (jobId ? entry.jobId === jobId : true))
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
