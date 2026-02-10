import { HttpError } from "../../shared/http-error.js";
import { nowIso } from "../../shared/ids.js";
import { logEvent, type LogLevel } from "../../shared/logger.js";
import type {
  NotificationChannel,
  NotificationJobRecord,
  NotificationStatus,
} from "../../shared/models.js";
import type {
  NotificationProvider,
  NotificationProviderResult,
} from "./providers/provider.types.js";
import type {
  NotificationJobsFilter,
  NotificationsRepository,
} from "./notifications.repository.js";

const CHANNELS: NotificationChannel[] = ["email", "sms", "push"];

export interface QueueNotificationInput {
  businessId: string;
  channel: string;
  audience: string;
  subject?: string;
  message: string;
  metadata?: Record<string, unknown>;
  maxAttempts?: number;
}

export interface ProcessQueueResult {
  processed: number;
  sent: number;
  retried: number;
  failed: number;
  jobIds: string[];
}

export interface NotificationsServiceOptions {
  providers: Record<NotificationChannel, NotificationProvider>;
  defaultMaxAttempts: number;
  retryBaseMs: number;
  retryMaxMs: number;
  logLevel: LogLevel;
}

interface NotificationFallbackTargets {
  emailAudience: string | null;
  smsAudience: string | null;
}

export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly options: NotificationsServiceOptions,
  ) {}

  listJobs(filter?: NotificationJobsFilter): NotificationJobRecord[] {
    return this.notificationsRepository.list(filter);
  }

  listAuditLogs(jobId?: string) {
    return this.notificationsRepository.listAuditLogs(jobId);
  }

  queueNotification(input: QueueNotificationInput): NotificationJobRecord {
    const businessId = input.businessId.trim();
    const channel = input.channel.trim().toLowerCase();
    const message = input.message.trim();
    const audience = input.audience.trim() || "all";
    const subject = input.subject?.trim() || null;
    const metadata = input.metadata ?? null;

    if (!businessId || !message) {
      throw new HttpError(400, "Missing businessId or message");
    }

    if (!CHANNELS.includes(channel as NotificationChannel)) {
      throw new HttpError(400, "Invalid notification channel");
    }

    const maxAttempts =
      input.maxAttempts && Number.isFinite(input.maxAttempts)
        ? Math.trunc(input.maxAttempts)
        : this.options.defaultMaxAttempts;
    if (maxAttempts < 1 || maxAttempts > 10) {
      throw new HttpError(400, "maxAttempts must be between 1 and 10");
    }

    if (metadata && Array.isArray(metadata)) {
      throw new HttpError(400, "metadata must be an object");
    }

    const scheduledFor = this.readScheduledFor(metadata);
    const nextAttemptAt =
      scheduledFor && scheduledFor > nowIso() ? scheduledFor : nowIso();

    const job = this.notificationsRepository.create({
      businessId,
      channel: channel as NotificationChannel,
      audience,
      subject,
      message,
      metadata,
      status: "queued",
      maxAttempts,
      nextAttemptAt,
    });

    this.notificationsRepository.createAuditLog({
      jobId: job.id,
      event: "queued",
      channel: job.channel,
      provider: null,
      attempt: 0,
      message: "Notification queued",
      detail: {
        audience: job.audience,
        maxAttempts: job.maxAttempts,
        scheduledFor,
      },
    });

    logEvent("info", this.options.logLevel, "notification_job_queued", {
      jobId: job.id,
      businessId: job.businessId,
      channel: job.channel,
      audience: job.audience,
      maxAttempts: job.maxAttempts,
      scheduledFor,
    });

    return job;
  }

  async processDueJobs(limit = 20): Promise<ProcessQueueResult> {
    const max = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 20;
    const dueJobs = this.notificationsRepository.listDue(nowIso(), max);

    let sent = 0;
    let retried = 0;
    let failed = 0;
    const jobIds: string[] = [];

    for (const job of dueJobs) {
      const result = await this.processJob(job.id);
      jobIds.push(result.job.id);
      if (result.outcome === "sent") sent += 1;
      if (result.outcome === "retrying") retried += 1;
      if (result.outcome === "failed") failed += 1;
    }

    return {
      processed: dueJobs.length,
      sent,
      retried,
      failed,
      jobIds,
    };
  }

  retryJob(jobId: string): NotificationJobRecord {
    const id = jobId.trim();
    const existing = this.notificationsRepository.getById(id);
    if (!existing) {
      throw new HttpError(404, "Notification job not found");
    }

    if (existing.status === "sent") {
      throw new HttpError(409, "Sent jobs cannot be retried");
    }

    if (existing.attempts >= existing.maxAttempts) {
      throw new HttpError(409, "Retry budget exhausted for this job");
    }

    const updated = this.requireUpdated(
      this.notificationsRepository.update(existing.id, {
        status: "retrying",
        nextAttemptAt: nowIso(),
        failedAt: null,
        lastError: null,
      }),
    );

    this.notificationsRepository.createAuditLog({
      jobId: existing.id,
      event: "retry_requested",
      channel: existing.channel,
      provider: existing.provider,
      attempt: existing.attempts,
      message: "Manual retry requested",
      detail: null,
    });

    logEvent("info", this.options.logLevel, "notification_job_retry_requested", {
      jobId: existing.id,
      channel: existing.channel,
      attempts: existing.attempts,
    });

    return updated;
  }

  private requireUpdated(record: NotificationJobRecord | undefined): NotificationJobRecord {
    if (!record) {
      throw new HttpError(500, "Notification job update failed");
    }
    return record;
  }

  private computeRetryDelayMs(attempt: number): number {
    const exp = Math.max(0, attempt - 1);
    const candidate = this.options.retryBaseMs * 2 ** exp;
    return Math.min(this.options.retryMaxMs, candidate);
  }

  private getProvider(channel: NotificationChannel): NotificationProvider {
    const provider = this.options.providers[channel];
    if (!provider) {
      throw new HttpError(503, `No provider configured for ${channel}`);
    }
    return provider;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private normalizeAudience(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private readScheduledFor(metadata: Record<string, unknown> | null): string | null {
    const scheduledValue = metadata?.scheduledFor;
    if (typeof scheduledValue !== "string") {
      return null;
    }

    const normalized = scheduledValue.trim();
    if (!normalized) {
      return null;
    }

    const scheduledMs = Date.parse(normalized);
    if (!Number.isFinite(scheduledMs)) {
      return null;
    }

    return new Date(scheduledMs).toISOString();
  }

  private readFallbackTargets(metadata: Record<string, unknown> | null): NotificationFallbackTargets {
    const fallbackMetadata =
      metadata &&
      typeof metadata.fallback === "object" &&
      !Array.isArray(metadata.fallback)
        ? (metadata.fallback as Record<string, unknown>)
        : null;

    const emailAudience =
      this.normalizeAudience(fallbackMetadata?.emailAudience) ??
      this.normalizeAudience(metadata?.fallbackEmailAudience);
    const smsAudience =
      this.normalizeAudience(fallbackMetadata?.smsAudience) ??
      this.normalizeAudience(metadata?.fallbackSmsAudience);

    return {
      emailAudience,
      smsAudience,
    };
  }

  private fallbackMetadata(
    job: NotificationJobRecord,
    reason: string,
    fallbackChannel: NotificationChannel,
  ): Record<string, unknown> {
    const source = job.metadata && !Array.isArray(job.metadata) ? { ...job.metadata } : {};
    delete source.fallback;
    delete source.fallbackEmailAudience;
    delete source.fallbackSmsAudience;

    return {
      ...source,
      source: "push-fallback",
      fallbackFromJobId: job.id,
      fallbackFromChannel: job.channel,
      fallbackToChannel: fallbackChannel,
      fallbackReason: reason,
      fallbackQueuedAt: nowIso(),
    };
  }

  private queuePushFallbackJobs(
    job: NotificationJobRecord,
    provider: NotificationProvider,
    attempt: number,
    pushError: string,
  ): { queuedJobs: NotificationJobRecord[]; skippedChannels: NotificationChannel[] } {
    if (job.channel !== "push") {
      return { queuedJobs: [], skippedChannels: [] };
    }

    const targets = this.readFallbackTargets(job.metadata);
    const candidates: Array<{ channel: NotificationChannel; audience: string | null }> = [
      { channel: "email", audience: targets.emailAudience },
      { channel: "sms", audience: targets.smsAudience },
    ];

    const queuedJobs: NotificationJobRecord[] = [];
    const skippedChannels: NotificationChannel[] = [];

    for (const candidate of candidates) {
      if (!candidate.audience) {
        skippedChannels.push(candidate.channel);
        continue;
      }

      const fallbackInput: QueueNotificationInput = {
        businessId: job.businessId,
        channel: candidate.channel,
        audience: candidate.audience,
        message: job.message,
        maxAttempts: job.maxAttempts,
        metadata: this.fallbackMetadata(job, pushError, candidate.channel),
      };
      if (candidate.channel === "email" && job.subject) {
        fallbackInput.subject = job.subject;
      }

      const queued = this.queueNotification(fallbackInput);

      queuedJobs.push(queued);
    }

    if (queuedJobs.length > 0) {
      const fallbackDetail = {
        pushProvider: provider.name,
        pushAttempt: attempt,
        pushError,
        queuedFallbackJobIds: queuedJobs.map((entry) => entry.id),
        queuedFallbackChannels: queuedJobs.map((entry) => entry.channel),
      };

      this.notificationsRepository.createAuditLog({
        jobId: job.id,
        event: "fallback_queued",
        channel: job.channel,
        provider: provider.name,
        attempt,
        message: "Push delivery failed; queued fallback notifications",
        detail: fallbackDetail,
      });

      logEvent("warn", this.options.logLevel, "notification_push_fallback_queued", {
        jobId: job.id,
        pushProvider: provider.name,
        pushAttempt: attempt,
        queuedFallbackJobIds: queuedJobs.map((entry) => entry.id),
        queuedFallbackChannels: queuedJobs.map((entry) => entry.channel),
      });
    }

    return {
      queuedJobs,
      skippedChannels,
    };
  }

  private async processJob(jobId: string): Promise<{
    outcome: Extract<NotificationStatus, "sent" | "retrying" | "failed">;
    job: NotificationJobRecord;
  }> {
    const job = this.notificationsRepository.getById(jobId);
    if (!job) {
      throw new HttpError(404, "Notification job not found");
    }

    const provider = this.getProvider(job.channel);
    const attempt = job.attempts + 1;
    const attemptStartedAt = nowIso();

    this.requireUpdated(
      this.notificationsRepository.update(job.id, {
        status: "processing",
        provider: provider.name,
        attempts: attempt,
        lastAttemptAt: attemptStartedAt,
        lastError: null,
      }),
    );

    this.notificationsRepository.createAuditLog({
      jobId: job.id,
      event: "attempt_started",
      channel: job.channel,
      provider: provider.name,
      attempt,
      message: "Dispatch attempt started",
      detail: {
        audience: job.audience,
      },
    });

    try {
      const providerResult = await provider.send({
        jobId: job.id,
        businessId: job.businessId,
        channel: job.channel,
        audience: job.audience,
        subject: job.subject,
        message: job.message,
        metadata: job.metadata,
        attempt,
      });

      if (!providerResult.accepted) {
        throw new HttpError(
          502,
          providerResult.detail ?? `${provider.name} rejected notification dispatch`,
        );
      }

      const sentRecord = this.markSent(job.id, job.channel, provider.name, attempt, providerResult);
      return {
        outcome: "sent",
        job: sentRecord,
      };
    } catch (error) {
      return this.markAttemptFailure(job, provider, attempt, error);
    }
  }

  private markSent(
    jobId: string,
    channel: NotificationChannel,
    providerName: string,
    attempt: number,
    providerResult: NotificationProviderResult,
  ): NotificationJobRecord {
    const sentAt = nowIso();

    const updated = this.requireUpdated(
      this.notificationsRepository.update(jobId, {
        status: "sent",
        provider: providerName,
        sentAt,
        failedAt: null,
        lastError: null,
      }),
    );

    this.notificationsRepository.createAuditLog({
      jobId,
      event: "attempt_succeeded",
      channel,
      provider: providerName,
      attempt,
      message: "Notification delivered",
      detail: {
        accepted: providerResult.accepted,
        externalId: providerResult.externalId,
        detail: providerResult.detail,
      },
    });

    logEvent("info", this.options.logLevel, "notification_job_sent", {
      jobId,
      channel,
      provider: providerName,
      attempt,
      externalId: providerResult.externalId,
    });

    return updated;
  }

  private markAttemptFailure(
    job: NotificationJobRecord,
    provider: NotificationProvider,
    attempt: number,
    error: unknown,
  ): {
    outcome: Extract<NotificationStatus, "retrying" | "failed">;
    job: NotificationJobRecord;
  } {
    const message = this.errorMessage(error);

    this.notificationsRepository.createAuditLog({
      jobId: job.id,
      event: "attempt_failed",
      channel: job.channel,
      provider: provider.name,
      attempt,
      message: "Dispatch attempt failed",
      detail: {
        error: message,
      },
    });

    const fallback = this.queuePushFallbackJobs(job, provider, attempt, message);
    if (fallback.queuedJobs.length > 0) {
      const failedRecord = this.requireUpdated(
        this.notificationsRepository.update(job.id, {
          status: "failed",
          provider: provider.name,
          failedAt: nowIso(),
          lastError:
            `Push delivery failed. Fallback queued: ${fallback.queuedJobs
              .map((entry) => entry.channel.toUpperCase())
              .join(", ")}`,
        }),
      );

      return {
        outcome: "failed",
        job: failedRecord,
      };
    }

    if (attempt >= job.maxAttempts) {
      const failedRecord = this.requireUpdated(
        this.notificationsRepository.update(job.id, {
          status: "failed",
          provider: provider.name,
          failedAt: nowIso(),
          lastError: message,
        }),
      );

      this.notificationsRepository.createAuditLog({
        jobId: job.id,
        event: "failed_final",
        channel: job.channel,
        provider: provider.name,
        attempt,
        message: "Retry budget exhausted",
        detail: {
          maxAttempts: job.maxAttempts,
          error: message,
        },
      });

      logEvent("error", this.options.logLevel, "notification_job_failed", {
        jobId: job.id,
        channel: job.channel,
        provider: provider.name,
        attempt,
        maxAttempts: job.maxAttempts,
        error: message,
      });

      return {
        outcome: "failed",
        job: failedRecord,
      };
    }

    const delayMs = this.computeRetryDelayMs(attempt);
    const nextAttemptAt = new Date(Date.now() + delayMs).toISOString();

    const retryRecord = this.requireUpdated(
      this.notificationsRepository.update(job.id, {
        status: "retrying",
        provider: provider.name,
        nextAttemptAt,
        failedAt: null,
        lastError: message,
      }),
    );

    this.notificationsRepository.createAuditLog({
      jobId: job.id,
      event: "retry_scheduled",
      channel: job.channel,
      provider: provider.name,
      attempt,
      message: "Retry scheduled",
      detail: {
        delayMs,
        nextAttemptAt,
      },
    });

    logEvent("warn", this.options.logLevel, "notification_job_retry_scheduled", {
      jobId: job.id,
      channel: job.channel,
      provider: provider.name,
      attempt,
      maxAttempts: job.maxAttempts,
      nextAttemptAt,
      error: message,
    });

    return {
      outcome: "retrying",
      job: retryRecord,
    };
  }
}
