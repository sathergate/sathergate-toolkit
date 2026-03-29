import { CodeBlock } from "./code-block";

const combos = [
  {
    title: "RBAC + Rate Limiting",
    packages: ["gatehouse", "ratelimit-next"],
    tagline: "Secure APIs in 10 lines",
    code: `import { createServerGate } from "gatehouse/next";
import { withRateLimit } from "ratelimit-next/next";
import { gh } from "@/lib/gatehouse";
import { gate as limiter } from "@/lib/rate-limit";

const gate = createServerGate({ gatehouse: gh, resolve: ... });

export const POST = withRateLimit(limiter, "api", async (req) => {
  await gate("project:create");
  // User is authenticated, authorized, and rate-limited
  return Response.json({ ok: true });
});`,
  },
  {
    title: "Role-Gated Feature Flags",
    packages: ["gatehouse", "flagpost"],
    tagline: "Ship features to the right people",
    code: `import { Gate } from "gatehouse/react";
import { Flag } from "flagpost/react";

// Only admins see the new dashboard — and only 50% of them
<Gate role="admin">
  <Flag name="newDashboard" fallback={<OldDashboard />}>
    <NewDashboard />
  </Flag>
</Gate>`,
  },
  {
    title: "Encrypted Secrets + Cron Jobs",
    packages: ["vaultbox", "croncall"],
    tagline: "Scheduled tasks with secure credentials",
    code: `import { createClockTower } from "croncall";
import { createLockbox } from "vaultbox";

const box = createLockbox();

export const tower = createClockTower({
  jobs: {
    syncData: {
      schedule: "@hourly",
      handler: async () => {
        const apiKey = box.require("EXTERNAL_API_KEY");
        await fetch("https://api.example.com", {
          headers: { Authorization: \`Bearer \${apiKey}\` },
        });
      },
    },
  },
});`,
  },
];

export function ComboSection() {
  return (
    <section className="py-16 border-t border-zinc-800">
      <div className="max-w-4xl mx-auto px-6">
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Better Together</h2>
        <p className="text-zinc-400 mb-10">
          Every package works standalone, but they&apos;re designed to compose.
        </p>
        <div className="space-y-12">
          {combos.map((combo) => (
            <div key={combo.title}>
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-lg font-semibold text-zinc-100">{combo.title}</h3>
              </div>
              <p className="text-sm text-zinc-400 mb-4">
                <span className="font-mono text-cyan-400">{combo.packages.join(" + ")}</span>
                {" — "}{combo.tagline}
              </p>
              <CodeBlock code={combo.code} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
