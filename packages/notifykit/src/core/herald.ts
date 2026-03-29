import type {
  Herald,
  HeraldConfig,
  Notification,
  NotificationProvider,
  NotifyOptions,
  SendResult,
  Channel,
} from "./types.js";
import { resolveTemplate } from "./template.js";

/**
 * Create a Herald instance for sending notifications across channels.
 */
export function createHerald(config: HeraldConfig): Herald {
  const providers = new Map<Channel, NotificationProvider>();
  const templates = config.templates ?? {};

  for (const provider of config.providers) {
    providers.set(provider.channel, provider);
  }

  function getProvider(channel: Channel): NotificationProvider {
    const provider = providers.get(channel);
    if (!provider) {
      throw new Error(
        `No provider registered for channel "${channel}". ` +
          `Register one with addProvider() or pass it in the config.`,
      );
    }
    return provider;
  }

  async function send(notification: Notification): Promise<SendResult> {
    const provider = getProvider(notification.channel);
    try {
      return await provider.send(notification);
    } catch (err) {
      return {
        success: false,
        channel: notification.channel,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async function sendBatch(
    notifications: Notification[],
  ): Promise<SendResult[]> {
    const settled = await Promise.allSettled(notifications.map(send));
    return settled.map((result, i) =>
      result.status === "fulfilled"
        ? result.value
        : {
            success: false as const,
            channel: notifications[i]!.channel,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          },
    );
  }

  async function notify(
    templateName: string,
    options: NotifyOptions,
  ): Promise<SendResult> {
    const data = options.data ?? {};
    const resolved = resolveTemplate(templates, templateName, data);

    return send({
      to: options.to,
      channel: resolved.channel,
      subject: resolved.subject,
      body: resolved.body,
    });
  }

  function addProvider(provider: NotificationProvider): void {
    providers.set(provider.channel, provider);
  }

  return { send, sendBatch, notify, addProvider };
}
