import type { NotificationProvider, Notification, SendResult } from "../core/types.js";

/** Type-only import -- the actual client is injected at runtime. */
import type { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

export interface SNSProviderConfig {
  /** AWS region. */
  region: string;
  /** AWS access key ID (optional if using instance roles). */
  accessKeyId?: string;
  /** AWS secret access key (optional if using instance roles). */
  secretAccessKey?: string;
}

/**
 * Create a push notification provider backed by AWS SNS.
 *
 * Accepts a factory so that the @aws-sdk/client-sns dependency is provided
 * by the consumer, keeping it out of the herald bundle.
 *
 * Usage:
 * ```ts
 * import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
 * import { createSNSProvider } from "notifykit/adapters/sns";
 *
 * const provider = createSNSProvider(
 *   { region: "us-east-1" },
 *   { SNSClient, PublishCommand },
 * );
 * ```
 */
export function createSNSProvider(
  config: SNSProviderConfig,
  aws: {
    SNSClient: new (config: {
      region: string;
      credentials?: { accessKeyId: string; secretAccessKey: string };
    }) => SNSClient;
    PublishCommand: new (input: {
      TargetArn: string;
      Message: string;
      Subject?: string;
    }) => PublishCommand;
  },
): NotificationProvider {
  const clientConfig: {
    region: string;
    credentials?: { accessKeyId: string; secretAccessKey: string };
  } = { region: config.region };

  if (config.accessKeyId && config.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    };
  }

  const client = new aws.SNSClient(clientConfig);

  return {
    channel: "push",

    async send(notification: Notification): Promise<SendResult> {
      try {
        const command = new aws.PublishCommand({
          TargetArn: notification.to,
          Message: notification.body,
          ...(notification.subject && { Subject: notification.subject }),
        });

        const result = await (client as any).send(command);
        return {
          success: true,
          channel: "push",
          messageId: result.MessageId,
        };
      } catch (err) {
        return {
          success: false,
          channel: "push",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}
