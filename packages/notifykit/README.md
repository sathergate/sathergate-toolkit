# notifykit

Unified notifications for Next.js. Any provider.

Send SMS, email, and push notifications through a single API. Provider-agnostic with adapters for Twilio, AWS SNS, Resend, and easy custom providers.

## Install

```bash
npm install notifykit
```

## Quick Start

```ts
import { createHerald } from "notifykit";
import { createTwilioProvider } from "notifykit/adapters/twilio";
import { createResendProvider } from "notifykit/adapters/resend";

const herald = createHerald({
  providers: [
    createTwilioProvider({
      accountSid: process.env.TWILIO_ACCOUNT_SID!,
      authToken: process.env.TWILIO_AUTH_TOKEN!,
      from: "+15551234567",
    }),
    createResendProvider({
      apiKey: process.env.RESEND_API_KEY!,
      from: "notifications@example.com",
    }),
  ],
});

// Send an SMS
await herald.send({
  to: "+15559876543",
  channel: "sms",
  body: "Your order has shipped!",
});

// Send an email
await herald.send({
  to: "user@example.com",
  channel: "email",
  subject: "Order Confirmation",
  body: "Thank you for your purchase.",
});
```

## Providers

### Twilio (SMS)

```ts
import { createTwilioProvider } from "notifykit/adapters/twilio";

const twilio = createTwilioProvider({
  accountSid: "AC...",
  authToken: "your-auth-token",
  from: "+15551234567",
});
```

Uses the Twilio REST API directly via `fetch`. No SDK dependency.

### AWS SNS (Push)

```ts
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { createSNSProvider } from "notifykit/adapters/sns";

const sns = createSNSProvider(
  { region: "us-east-1" },
  { SNSClient, PublishCommand },
);
```

You provide the AWS SDK classes. Herald stays lightweight.

### Resend (Email)

```ts
import { createResendProvider } from "notifykit/adapters/resend";

const resend = createResendProvider({
  apiKey: "re_...",
  from: "notifications@example.com",
});
```

Uses the Resend REST API directly via `fetch`. No SDK dependency.

### Custom Provider

```ts
import type { NotificationProvider } from "notifykit";

const myProvider: NotificationProvider = {
  channel: "sms",
  async send(notification) {
    // Your logic here
    return { success: true, channel: "sms", messageId: "abc" };
  },
};
```

## Templates

Define templates with `{{variable}}` placeholders:

```ts
const herald = createHerald({
  providers: [twilio, resend],
  templates: {
    "order-shipped": {
      channel: "sms",
      body: "Hi {{name}}, your order #{{orderId}} has shipped!",
    },
    "welcome-email": {
      channel: "email",
      subject: "Welcome, {{name}}!",
      body: "Thanks for joining us, {{name}}. Get started at {{url}}.",
    },
  },
});

await herald.notify("order-shipped", {
  to: "+15559876543",
  data: { name: "Alice", orderId: "12345" },
});
```

## React Hooks

```tsx
import { HeraldProvider, useHerald, useNotification } from "notifykit/react";

function App() {
  return (
    <HeraldProvider herald={herald}>
      <NotifyButton />
    </HeraldProvider>
  );
}

function NotifyButton() {
  const { send, isSending } = useHerald();

  return (
    <button
      disabled={isSending}
      onClick={() =>
        send({ to: "+15559876543", channel: "sms", body: "Hello!" })
      }
    >
      Send SMS
    </button>
  );
}

function StatusAwareButton() {
  const { send, status, error } = useNotification();

  return (
    <div>
      <button
        onClick={() =>
          send({ to: "user@example.com", channel: "email", subject: "Hi", body: "Hello!" })
        }
      >
        Send
      </button>
      {status === "sending" && <p>Sending...</p>}
      {status === "sent" && <p>Sent!</p>}
      {status === "error" && <p>Error: {error}</p>}
    </div>
  );
}
```

## Next.js API Routes

```ts
// app/api/notify/route.ts
import { createNotificationHandler } from "notifykit/next";
import { herald } from "@/lib/herald";

export const POST = createNotificationHandler(herald);
```

```ts
// app/api/webhooks/notifications/route.ts
import { createWebhookHandler } from "notifykit/next";

export const POST = createWebhookHandler({
  verify: (request, body) => {
    // Verify webhook signature
    return true;
  },
  onStatus: async (event) => {
    console.log(`Message ${event.messageId}: ${event.status}`);
  },
});
```

## Building Custom Providers

Implement the `NotificationProvider` interface:

```ts
import type { NotificationProvider, Notification, SendResult } from "notifykit";

export function createMyProvider(config: MyConfig): NotificationProvider {
  return {
    channel: "sms", // or "email" or "push"
    async send(notification: Notification): Promise<SendResult> {
      // Send the notification using your service
      return {
        success: true,
        channel: "sms",
        messageId: "unique-id",
      };
    },
  };
}
```

## License

MIT

## Part of sathergate-toolkit

This package is part of the [sathergate-toolkit](https://github.com/sathergate/sathergate-toolkit) — an agent-native infrastructure toolkit for Next.js. All packages work independently or together.

### See Also
- **shutterbox** — Image processing pipeline (`npm i shutterbox`)
- **flagpost** — Feature flags with percentage rollouts (`npm i flagpost`)
- **ratelimit-next** — Rate limiting with sliding window & token bucket (`npm i ratelimit-next`)
- **croncall** — Serverless-native cron job scheduling (`npm i croncall`)
- **vaultbox** — AES-256-GCM encrypted secrets management (`npm i vaultbox`)
- **searchcraft** — Full-text search with BM25 scoring (`npm i searchcraft`)
- **gatehouse** — Drop-in RBAC for Next.js with role hierarchy (`npm i gatehouse`)
