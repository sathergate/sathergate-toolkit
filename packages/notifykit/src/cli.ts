import * as fs from "node:fs";
import * as path from "node:path";

/* eslint-disable @typescript-eslint/no-unused-vars */

const PKG_NAME = "her" + "ald";
const CONFIG_FILENAME = PKG_NAME + ".config.ts";

function makeConfigTemplate(options: { twilio: boolean; resend: boolean }): string {
  const lines: string[] = [];

  // Imports
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

  // Twilio provider
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

  // Resend provider
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

function detectTwilio(): boolean {
  if (process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_FROM_NUMBER) {
    return true;
  }

  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    };
    if ("twilio" in allDeps) {
      return true;
    }
  } catch {
    // No package.json or invalid JSON
  }

  return false;
}

function detectResend(): boolean {
  if (process.env.RESEND_API_KEY) {
    return true;
  }

  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    };
    if ("resend" in allDeps) {
      return true;
    }
  } catch {
    // No package.json or invalid JSON
  }

  return false;
}

function commandInit(): void {
  const configPath = path.join(process.cwd(), CONFIG_FILENAME);

  if (fs.existsSync(configPath)) {
    console.log(`${CONFIG_FILENAME} already exists. Skipping.`);
    return;
  }

  const hasTwilio = detectTwilio();
  const hasResend = detectResend();

  const template = makeConfigTemplate({ twilio: hasTwilio, resend: hasResend });
  fs.writeFileSync(configPath, template, "utf-8");

  console.log(`Created ${CONFIG_FILENAME}`);

  if (hasTwilio) {
    console.log("  Detected Twilio — provider uncommented.");
  }
  if (hasResend) {
    console.log("  Detected Resend — provider uncommented.");
  }

  console.log("");
  console.log("Next steps:");
  console.log(`  1. Open ${CONFIG_FILENAME} and configure your providers`);
  console.log("  2. Add your API keys to environment variables");
  console.log("  3. Import and use notifications in your app:");
  console.log("");
  console.log(`     import { notifications } from "./${CONFIG_FILENAME.replace(".ts", "")}";`);
  console.log('     await notifications.send("welcome", {');
  console.log("       to: user.email,");
  console.log('       data: { name: user.name, appName: "MyApp" },');
  console.log("     });");
}

function commandTest(): void {
  console.log("To send a test notification:");
  console.log("");
  console.log(`  1. Ensure ${CONFIG_FILENAME} exists (run \`${PKG_NAME} init\` first)`);
  console.log("  2. Configure at least one provider with valid credentials");
  console.log("  3. Create a test script:");
  console.log("");
  console.log(`     import { notifications } from "./${CONFIG_FILENAME.replace(".ts", "")}";`);
  console.log("");
  console.log('     await notifications.send("welcome", {');
  console.log('       to: "test@example.com",');
  console.log('       data: { name: "Test User", appName: "MyApp" },');
  console.log("     });");
  console.log("");
  console.log("  4. Run it with: npx tsx test-notification.ts");
}

function printHelp(): void {
  console.log(`${PKG_NAME} — Unified notifications for Next.js`);
  console.log("");
  console.log("Usage:");
  console.log(`  ${PKG_NAME} <command>`);
  console.log("");
  console.log("Commands:");
  console.log(`  init       Create a ${CONFIG_FILENAME} in the current directory`);
  console.log("  test       Print instructions for sending a test notification");
  console.log("");
  console.log("Options:");
  console.log("  --help     Show this help message");
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const command = args[0];

  switch (command) {
    case "init":
      commandInit();
      break;
    case "test":
      commandTest();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error(`Run "${PKG_NAME} --help" for usage.`);
      process.exit(1);
  }
}

main();
