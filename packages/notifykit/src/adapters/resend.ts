import type { NotificationProvider, Notification, SendResult } from "../core/types.js";

export interface ResendProviderConfig {
  /** Resend API key. */
  apiKey: string;
  /** Default sender email address. */
  from: string;
}

/**
 * Create an email provider backed by the Resend API.
 * Uses fetch directly -- no resend SDK dependency.
 */
export function createResendProvider(
  config: ResendProviderConfig,
): NotificationProvider {
  const { apiKey, from } = config;
  const baseUrl = "https://api.resend.com/emails";

  return {
    channel: "email",

    async send(notification: Notification): Promise<SendResult> {
      const payload = {
        from,
        to: [notification.to],
        subject: notification.subject ?? "(No Subject)",
        text: notification.body,
      };

      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          channel: "email",
          error: `Resend API error (${response.status}): ${error}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        channel: "email",
        messageId: data.id,
      };
    },
  };
}
