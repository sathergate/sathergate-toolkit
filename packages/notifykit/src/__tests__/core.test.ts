import { describe, it, expect, vi } from "vitest";
import { createHerald } from "../core/herald.js";
import { renderTemplate, resolveTemplate } from "../core/template.js";
import type { NotificationProvider, SendResult } from "../core/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockProvider(
  channel: "email" | "sms" | "push",
  result?: Partial<SendResult>,
): NotificationProvider {
  return {
    channel,
    send: vi.fn().mockResolvedValue({
      success: true,
      channel,
      messageId: `msg-${channel}-${Date.now()}`,
      ...result,
    }),
  };
}

// ---------------------------------------------------------------------------
// renderTemplate
// ---------------------------------------------------------------------------

describe("renderTemplate", () => {
  it("replaces {{key}} placeholders", () => {
    expect(renderTemplate("Hello {{name}}", { name: "Alice" })).toBe(
      "Hello Alice",
    );
  });

  it("replaces multiple placeholders", () => {
    const result = renderTemplate("Hi {{first}} {{last}}", {
      first: "John",
      last: "Doe",
    });
    expect(result).toBe("Hi John Doe");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(renderTemplate("Hello {{unknown}}", {})).toBe("Hello {{unknown}}");
  });

  it("handles empty data", () => {
    expect(renderTemplate("No vars here", {})).toBe("No vars here");
  });

  it("handles empty template", () => {
    expect(renderTemplate("", { name: "Alice" })).toBe("");
  });
});

// ---------------------------------------------------------------------------
// resolveTemplate
// ---------------------------------------------------------------------------

describe("resolveTemplate", () => {
  const templates = {
    welcome: {
      channel: "email" as const,
      subject: "Welcome {{name}}",
      body: "Thanks for joining, {{name}}!",
    },
    alert: {
      channel: "sms" as const,
      body: "Alert: {{message}}",
    },
  };

  it("resolves a template with subject and body", () => {
    const result = resolveTemplate(templates, "welcome", { name: "Alice" });
    expect(result).toEqual({
      channel: "email",
      subject: "Welcome Alice",
      body: "Thanks for joining, Alice!",
    });
  });

  it("resolves a template without subject", () => {
    const result = resolveTemplate(templates, "alert", {
      message: "Server down",
    });
    expect(result).toEqual({
      channel: "sms",
      subject: undefined,
      body: "Alert: Server down",
    });
  });

  it("throws on unknown template name", () => {
    expect(() =>
      resolveTemplate(templates, "nonexistent", {}),
    ).toThrowError('Template "nonexistent" not found');
  });
});

// ---------------------------------------------------------------------------
// createHerald
// ---------------------------------------------------------------------------

describe("createHerald", () => {
  it("sends a notification via the correct provider", async () => {
    const emailProvider = mockProvider("email");
    const herald = createHerald({ providers: [emailProvider] });

    const result = await herald.send({
      to: "user@example.com",
      channel: "email",
      body: "Hello!",
    });

    expect(result.success).toBe(true);
    expect(result.channel).toBe("email");
    expect(emailProvider.send).toHaveBeenCalledOnce();
  });

  it("throws when no provider exists for the channel", async () => {
    const herald = createHerald({ providers: [] });

    await expect(
      herald.send({ to: "+1234567890", channel: "sms", body: "Hi" }),
    ).rejects.toThrowError('No provider registered for channel "sms"');
  });

  it("catches provider errors and returns failure result", async () => {
    const failingProvider: NotificationProvider = {
      channel: "email",
      send: vi.fn().mockRejectedValue(new Error("Network error")),
    };
    const herald = createHerald({ providers: [failingProvider] });

    const result = await herald.send({
      to: "user@example.com",
      channel: "email",
      body: "Hello!",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network error");
    expect(result.channel).toBe("email");
  });

  it("sends batch notifications in parallel", async () => {
    const emailProvider = mockProvider("email");
    const smsProvider = mockProvider("sms");
    const herald = createHerald({
      providers: [emailProvider, smsProvider],
    });

    const results = await herald.sendBatch([
      { to: "user@example.com", channel: "email", body: "Email!" },
      { to: "+1234567890", channel: "sms", body: "SMS!" },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
    expect(emailProvider.send).toHaveBeenCalledOnce();
    expect(smsProvider.send).toHaveBeenCalledOnce();
  });

  it("sends notification using a template", async () => {
    const emailProvider = mockProvider("email");
    const herald = createHerald({
      providers: [emailProvider],
      templates: {
        welcome: {
          channel: "email",
          subject: "Welcome {{name}}",
          body: "Hello {{name}}, thanks for signing up!",
        },
      },
    });

    const result = await herald.notify("welcome", {
      to: "alice@example.com",
      data: { name: "Alice" },
    });

    expect(result.success).toBe(true);
    const call = (emailProvider.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.to).toBe("alice@example.com");
    expect(call.subject).toBe("Welcome Alice");
    expect(call.body).toBe("Hello Alice, thanks for signing up!");
  });

  it("throws on unknown template name in notify", async () => {
    const herald = createHerald({ providers: [mockProvider("email")] });

    await expect(
      herald.notify("nonexistent", { to: "user@example.com" }),
    ).rejects.toThrowError('Template "nonexistent" not found');
  });

  it("adds a provider at runtime", async () => {
    const herald = createHerald({ providers: [] });
    const pushProvider = mockProvider("push");

    herald.addProvider(pushProvider);

    const result = await herald.send({
      to: "device-token-123",
      channel: "push",
      body: "New message!",
    });

    expect(result.success).toBe(true);
    expect(pushProvider.send).toHaveBeenCalledOnce();
  });

  it("later provider replaces earlier one for same channel", async () => {
    const provider1 = mockProvider("email", { messageId: "first" });
    const provider2 = mockProvider("email", { messageId: "second" });

    const herald = createHerald({ providers: [provider1] });
    herald.addProvider(provider2);

    const result = await herald.send({
      to: "user@example.com",
      channel: "email",
      body: "Test",
    });

    expect(result.messageId).toBe("second");
    expect(provider1.send).not.toHaveBeenCalled();
    expect(provider2.send).toHaveBeenCalledOnce();
  });
});
