import { HttpError } from "../../../shared/http-error.js";
import type { NotificationChannel } from "../../../shared/models.js";
import type {
  NotificationDispatchInput,
  NotificationProvider,
  NotificationProviderResult,
} from "./provider.types.js";

export class NoopNotificationProvider implements NotificationProvider {
  readonly name: string;

  constructor(public readonly channel: NotificationChannel) {
    this.name = `${channel}-noop`;
  }

  async send(_input: NotificationDispatchInput): Promise<NotificationProviderResult> {
    throw new HttpError(
      503,
      `${this.channel.toUpperCase()} provider is not configured yet`,
    );
  }
}

