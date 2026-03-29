import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import * as fs from "node:fs";
import * as path from "node:path";

const PKG_NAME = "notifykit";
const CONFIG_FILENAME = "herald.config.ts";

function readPackageJson(cwd: string): Record<string, unknown> | null {
  const pkgPath = path.join(cwd, "package.json");
  if (!fs.existsSync(pkgPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  } catch {
    return null;
  }
}

function hasDependency(
  pkg: Record<string, unknown>,
  name: string,
): boolean {
  const deps = pkg.dependencies as Record<string, string> | undefined;
  const devDeps = pkg.devDependencies as Record<string, string> | undefined;
  const peerDeps = pkg.peerDependencies as Record<string, string> | undefined;
  return !!(deps?.[name] || devDeps?.[name] || peerDeps?.[name]);
}

function detectTwilio(projectDir: string, pkg: Record<string, unknown> | null): boolean {
  if (process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_FROM_NUMBER) {
    return true;
  }
  if (pkg && hasDependency(pkg, "twilio")) {
    return true;
  }
  return false;
}

function detectResend(projectDir: string, pkg: Record<string, unknown> | null): boolean {
  if (process.env.RESEND_API_KEY) {
    return true;
  }
  if (pkg && hasDependency(pkg, "resend")) {
    return true;
  }
  return false;
}

function makeConfigTemplate(options: { twilio: boolean; resend: boolean }): string {
  const lines: string[] = [];

  lines.push(`import { createHerald } from "${PKG_NAME}";`);
  if (options.twilio) {
    lines.push(`import { createTwilioProvider } from "${PKG_NAME}/adapters/twilio";`);
  } else {
    lines.push(`// import { createTwilioProvider } from "${PKG_NAME}/adapters/twilio";`);
  }
  if (options.resend) {
    lines.push(`import { createResendProvider } from "${PKG_NAME}/adapters/resend";`);
  } else {
    lines.push(`// import { createResendProvider } from "${PKG_NAME}/adapters/resend";`);
  }

  lines.push("");
  lines.push("export const notifications = createHerald({");
  lines.push("  providers: [");

  if (!options.twilio && !options.resend) {
    lines.push("    // Uncomment and configure your providers:");
  }

  if (options.twilio) {
    lines.push("    createTwilioProvider({");
    lines.push("      accountSid: process.env.TWILIO_ACCOUNT_SID!,");
    lines.push("      authToken: process.env.TWILIO_AUTH_TOKEN!,");
    lines.push("      from: process.env.TWILIO_FROM_NUMBER!,");
    lines.push("    }),");
  } else {
    lines.push("    // createTwilioProvider({");
    lines.push("    //   accountSid: process.env.TWILIO_ACCOUNT_SID!,");
    lines.push("    //   authToken: process.env.TWILIO_AUTH_TOKEN!,");
    lines.push("    //   from: process.env.TWILIO_FROM_NUMBER!,");
    lines.push("    // }),");
  }

  if (options.resend) {
    lines.push("    createResendProvider({");
    lines.push('      apiKey: process.env.RESEND_API_KEY!,');
    lines.push('      from: "noreply@yourdomain.com",');
    lines.push("    }),");
  } else {
    lines.push("    // createResendProvider({");
    lines.push("    //   apiKey: process.env.RESEND_API_KEY!,");
    lines.push('    //   from: "noreply@yourdomain.com",');
    lines.push("    // }),");
  }

  lines.push("  ],");
  lines.push("  templates: {");
  lines.push("    welcome: {");
  lines.push('      channel: "email",');
  lines.push('      subject: "Welcome to {{appName}}",');
  lines.push('      body: "Hi {{name}}, thanks for signing up!",');
  lines.push("    },");
  lines.push("  },");
  lines.push("});");
  lines.push("");

  return lines.join("\n");
}

const server = new McpServer({
  name: "notifykit",
  version: "0.1.0",
});

server.tool(
  "herald_init",
  "Scaffolds a herald.config.ts in a project directory with provider configuration. Auto-detects Twilio and Resend if installed or env vars are set.",
  { projectDir: z.string().describe("Absolute path to the project directory") },
  async ({ projectDir }) => {
    const configPath = path.resolve(projectDir, CONFIG_FILENAME);

    if (fs.existsSync(configPath)) {
      return {
        content: [
          {
            type: "text" as const,
            text: `${CONFIG_FILENAME} already exists at ${configPath}. Skipping.`,
          },
        ],
      };
    }

    const pkg = readPackageJson(projectDir);
    const warnings: string[] = [];

    if (pkg === null) {
      warnings.push(
        "No package.json found in the directory. Make sure you are in a project root.",
      );
    } else if (!hasDependency(pkg, PKG_NAME)) {
      warnings.push(
        `"${PKG_NAME}" is not listed in your package.json dependencies. Run: npm install ${PKG_NAME}`,
      );
    }

    const hasTwilio = detectTwilio(projectDir, pkg);
    const hasResend = detectResend(projectDir, pkg);

    const template = makeConfigTemplate({ twilio: hasTwilio, resend: hasResend });
    fs.writeFileSync(configPath, template, "utf-8");

    const detections: string[] = [];
    if (hasTwilio) detections.push("Detected Twilio — provider uncommented.");
    if (hasResend) detections.push("Detected Resend — provider uncommented.");

    const message = [
      `Created ${CONFIG_FILENAME} at ${configPath}`,
      ...detections,
      ...warnings.map((w) => `Warning: ${w}`),
      "",
      "Next steps:",
      `  1. Open ${CONFIG_FILENAME} and configure your providers`,
      "  2. Add your API keys to environment variables",
      `  3. Import { notifications } from './${CONFIG_FILENAME.replace(".ts", "")}' in your app`,
      "  4. Call notifications.send() or notifications.notify() to send messages",
    ].join("\n");

    return {
      content: [{ type: "text" as const, text: message }],
    };
  },
);

server.tool(
  "herald_send",
  "Send a notification via notifykit. Returns instructions for configuring providers if the project is not yet set up.",
  {
    to: z.string().describe("Recipient address (email, phone number, or device token)"),
    channel: z.enum(["sms", "email", "push"]).describe("Notification channel"),
    body: z.string().describe("Notification body text"),
    subject: z.string().optional().describe("Email subject line (required for email channel)"),
  },
  async ({ to, channel, body, subject }) => {
    // Since providers require API keys and runtime configuration,
    // this tool returns guidance on how to send the notification
    // using the notifykit API in the user's project.

    const lines: string[] = [];
    lines.push(`To send this ${channel} notification, add the following to your code:`);
    lines.push("");
    lines.push('import { notifications } from "./herald.config";');
    lines.push("");

    if (channel === "email") {
      lines.push("await notifications.send({");
      lines.push(`  to: "${to}",`);
      lines.push(`  channel: "email",`);
      if (subject) {
        lines.push(`  subject: "${subject}",`);
      }
      lines.push(`  body: ${JSON.stringify(body)},`);
      lines.push("});");
      lines.push("");
      lines.push("Required provider: Resend (npm install resend)");
      lines.push("Required env var: RESEND_API_KEY");
    } else if (channel === "sms") {
      lines.push("await notifications.send({");
      lines.push(`  to: "${to}",`);
      lines.push(`  channel: "sms",`);
      lines.push(`  body: ${JSON.stringify(body)},`);
      lines.push("});");
      lines.push("");
      lines.push("Required provider: Twilio (npm install twilio)");
      lines.push("Required env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER");
    } else if (channel === "push") {
      lines.push("await notifications.send({");
      lines.push(`  to: "${to}",`);
      lines.push(`  channel: "push",`);
      lines.push(`  body: ${JSON.stringify(body)},`);
      lines.push("});");
      lines.push("");
      lines.push("Required provider: SNS adapter (npm install @aws-sdk/client-sns)");
      lines.push("Required env vars: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION");
    }

    lines.push("");
    lines.push("If you haven't set up notifykit yet, run: npx notifykit init");

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  },
);

server.tool(
  "herald_test",
  "Generate a test notification code snippet for a specific channel. Returns ready-to-run code for testing your notifykit setup.",
  {
    channel: z.enum(["sms", "email", "push"]).describe("Notification channel to test"),
  },
  async ({ channel }) => {
    const lines: string[] = [];
    lines.push("// Test notification script");
    lines.push("// Run with: npx tsx test-notification.ts");
    lines.push("");
    lines.push('import { notifications } from "./herald.config";');
    lines.push("");

    if (channel === "email") {
      lines.push("async function main() {");
      lines.push("  const result = await notifications.send({");
      lines.push('    to: "test@example.com",');
      lines.push('    channel: "email",');
      lines.push('    subject: "Test from notifykit",');
      lines.push('    body: "If you received this, notifykit is working!",');
      lines.push("  });");
      lines.push('  console.log("Send result:", result);');
      lines.push("}");
      lines.push("");
      lines.push("main().catch(console.error);");
      lines.push("");
      lines.push("// Prerequisites:");
      lines.push("//   1. herald.config.ts exists with Resend provider configured");
      lines.push("//   2. RESEND_API_KEY is set in your environment");
      lines.push('//   3. Replace "test@example.com" with a real email address');
    } else if (channel === "sms") {
      lines.push("async function main() {");
      lines.push("  const result = await notifications.send({");
      lines.push('    to: "+15551234567",');
      lines.push('    channel: "sms",');
      lines.push('    body: "Test from notifykit - if you received this, SMS is working!",');
      lines.push("  });");
      lines.push('  console.log("Send result:", result);');
      lines.push("}");
      lines.push("");
      lines.push("main().catch(console.error);");
      lines.push("");
      lines.push("// Prerequisites:");
      lines.push("//   1. herald.config.ts exists with Twilio provider configured");
      lines.push("//   2. TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER are set");
      lines.push('//   3. Replace "+15551234567" with a real phone number');
    } else if (channel === "push") {
      lines.push("async function main() {");
      lines.push("  const result = await notifications.send({");
      lines.push('    to: "device-token-here",');
      lines.push('    channel: "push",');
      lines.push('    body: "Test push from notifykit!",');
      lines.push("  });");
      lines.push('  console.log("Send result:", result);');
      lines.push("}");
      lines.push("");
      lines.push("main().catch(console.error);");
      lines.push("");
      lines.push("// Prerequisites:");
      lines.push("//   1. herald.config.ts exists with SNS provider configured");
      lines.push("//   2. AWS credentials are set (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)");
      lines.push('//   3. Replace "device-token-here" with a real device/endpoint ARN');
    }

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  },
);

export { server };
