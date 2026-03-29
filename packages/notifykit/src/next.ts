import type { Herald, Notification } from "./core/types.js";

/**
 * Create a Next.js Route Handler (POST) that sends notifications via Herald.
 *
 * Usage in app/api/notify/route.ts:
 * ```ts
 * import { createNotificationHandler } from "notifykit/next";
 * export const POST = createNotificationHandler(herald);
 * ```
 */
export function createNotificationHandler(herald: Herald) {
  return async (request: Request): Promise<Response> => {
    try {
      const body = await request.json();

      if (!body || typeof body !== "object") {
        return Response.json(
          { error: "Request body must be a JSON object" },
          { status: 400 },
        );
      }

      const { to, channel, subject, body: messageBody, template, data } = body;

      if (!to || typeof to !== "string") {
        return Response.json(
          { error: '"to" is required and must be a string' },
          { status: 400 },
        );
      }

      if (!channel || !["sms", "email", "push"].includes(channel)) {
        return Response.json(
          { error: '"channel" must be one of: sms, email, push' },
          { status: 400 },
        );
      }

      if (!messageBody && !template) {
        return Response.json(
          { error: 'Either "body" or "template" is required' },
          { status: 400 },
        );
      }

      if (template) {
        const result = await herald.notify(template, { to, data });
        return Response.json(result, { status: result.success ? 200 : 502 });
      }

      const notification: Notification = {
        to,
        channel,
        body: messageBody,
        ...(subject && { subject }),
        ...(data && { data }),
      };

      const result = await herald.send(notification);
      return Response.json(result, { status: result.success ? 200 : 502 });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

/** Options for the webhook handler. */
export interface WebhookHandlerOptions {
  /** Verify the webhook signature. Return true if valid. */
  verify?: (request: Request, body: string) => boolean | Promise<boolean>;
  /** Handle a delivery status update. */
  onStatus?: (event: WebhookEvent) => void | Promise<void>;
}

/** A normalized delivery status event from a provider webhook. */
export interface WebhookEvent {
  messageId: string;
  status: "delivered" | "failed" | "bounced" | "complained";
  timestamp: string;
  raw: unknown;
}

/**
 * Create a Next.js Route Handler (POST) for delivery status webhooks.
 *
 * Usage in app/api/webhooks/notifications/route.ts:
 * ```ts
 * import { createWebhookHandler } from "notifykit/next";
 * export const POST = createWebhookHandler({ onStatus: async (event) => { ... } });
 * ```
 */
export function createWebhookHandler(options: WebhookHandlerOptions) {
  return async (request: Request): Promise<Response> => {
    try {
      const rawBody = await request.text();

      if (options.verify) {
        const valid = await options.verify(request, rawBody);
        if (!valid) {
          return Response.json(
            { error: "Invalid webhook signature" },
            { status: 401 },
          );
        }
      }

      const payload = JSON.parse(rawBody);

      const event: WebhookEvent = {
        messageId: payload.messageId ?? payload.MessageId ?? payload.id ?? "",
        status: normalizeStatus(payload.status ?? payload.eventType ?? payload.event),
        timestamp:
          payload.timestamp ?? payload.Timestamp ?? new Date().toISOString(),
        raw: payload,
      };

      if (options.onStatus) {
        await options.onStatus(event);
      }

      return Response.json({ received: true }, { status: 200 });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

function normalizeStatus(
  status: string | undefined,
): WebhookEvent["status"] {
  if (!status) return "failed";
  const s = status.toLowerCase();
  if (s.includes("deliver")) return "delivered";
  if (s.includes("bounce")) return "bounced";
  if (s.includes("complain") || s.includes("spam")) return "complained";
  return "failed";
}
