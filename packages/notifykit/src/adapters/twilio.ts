import type { NotificationProvider, Notification, SendResult } from "../core/types.js";

export interface TwilioProviderConfig {
  /** Twilio Account SID. */
  accountSid: string;
  /** Twilio Auth Token. */
  authToken: string;
  /** Sender phone number (E.164 format). */
  from: string;
}

/**
 * Create an SMS provider backed by the Twilio REST API.
 * Uses fetch directly -- no twilio SDK dependency.
 */
export function createTwilioProvider(
  config: TwilioProviderConfig,
): NotificationProvider {
  const { accountSid, authToken, from } = config;
  const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const authHeader =
    "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  return {
    channel: "sms",

    async send(notification: Notification): Promise<SendResult> {
      const params = new URLSearchParams({
        To: notification.to,
        From: from,
        Body: notification.body,
      });

      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          channel: "sms",
          error: `Twilio API error (${response.status}): ${error}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        channel: "sms",
        messageId: data.sid,
      };
    },
  };
}
