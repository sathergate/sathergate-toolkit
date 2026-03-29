/** Supported notification channels. */
export type Channel = "sms" | "email" | "push";

/** A notification to send. */
export interface Notification {
  /** Recipient address: phone number, email, or device token. */
  to: string;
  /** Delivery channel. */
  channel: Channel;
  /** Subject line (email). */
  subject?: string;
  /** Message body. */
  body: string;
  /** Template name to resolve instead of using body directly. */
  template?: string;
  /** Data for template variable substitution. */
  data?: Record<string, string>;
}

/** Result of sending a notification. */
export interface SendResult {
  success: boolean;
  messageId?: string;
  channel: Channel;
  error?: string;
}

/** A provider that can deliver notifications on a specific channel. */
export interface NotificationProvider {
  /** The channel this provider handles. */
  channel: Channel;
  /** Send a single notification. */
  send(notification: Notification): Promise<SendResult>;
}

/** Template definition with {{variable}} placeholders. */
export interface TemplateDefinition {
  /** Channel this template targets. */
  channel: Channel;
  /** Subject line template (email). */
  subject?: string;
  /** Body template with {{variable}} placeholders. */
  body: string;
}

/** Per-channel default values. */
export interface ChannelDefaults {
  /** Default sender/from for the channel. */
  from?: string;
  /** Default subject (email). */
  subject?: string;
}

/** Herald configuration. */
export interface HeraldConfig {
  /** Notification providers, one per channel. */
  providers: NotificationProvider[];
  /** Named templates. */
  templates?: Record<string, TemplateDefinition>;
  /** Per-channel defaults. */
  defaults?: Partial<Record<Channel, ChannelDefaults>>;
}

/** Options for template-based notifications. */
export interface NotifyOptions {
  /** Recipient address. */
  to: string;
  /** Data for template variable substitution. */
  data?: Record<string, string>;
}

/** The Herald instance returned by createHerald. */
export interface Herald {
  /** Send a single notification. */
  send(notification: Notification): Promise<SendResult>;
  /** Send multiple notifications in parallel. */
  sendBatch(notifications: Notification[]): Promise<SendResult[]>;
  /** Send a notification using a named template. */
  notify(templateName: string, options: NotifyOptions): Promise<SendResult>;
  /** Register an additional provider at runtime. */
  addProvider(provider: NotificationProvider): void;
}
