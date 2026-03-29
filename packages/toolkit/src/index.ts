/**
 * @sathergate/toolkit - Agent-native infrastructure toolkit for Next.js.
 * @see https://github.com/sathergate/sathergate-toolkit
 */
export const packages = {
  gatehouse: { name: "gatehouse", description: "Drop-in RBAC for Next.js", install: "npm install gatehouse", exports: [".", "./react", "./next", "./adapters/clerk", "./adapters/supabase", "./adapters/authjs"], category: "authorization" },
  shutterbox: { name: "shutterbox", description: "Image processing pipeline for Next.js", install: "npm install shutterbox sharp", exports: [".", "./react", "./next", "./mcp"], category: "image-processing" },
  flagpost: { name: "flagpost", description: "Feature flags for Next.js", install: "npm install flagpost", exports: [".", "./react", "./next", "./mcp"], category: "feature-flags" },
  "ratelimit-next": { name: "ratelimit-next", description: "Rate limiting for Next.js", install: "npm install ratelimit-next", exports: [".", "./react", "./next", "./adapters/redis", "./adapters/vercel-kv", "./mcp"], category: "rate-limiting" },
  notifykit: { name: "notifykit", description: "Unified notifications for Next.js", install: "npm install notifykit", exports: [".", "./react", "./next", "./adapters/twilio", "./adapters/sns", "./adapters/resend", "./mcp"], category: "notifications" },
  croncall: { name: "croncall", description: "Cron job scheduling for Next.js", install: "npm install croncall", exports: [".", "./next", "./mcp"], category: "scheduled-tasks" },
  vaultbox: { name: "vaultbox", description: "Encrypted secrets management for Next.js", install: "npm install vaultbox", exports: [".", "./mcp"], category: "secrets-management" },
  searchcraft: { name: "searchcraft", description: "Full-text search for Next.js", install: "npm install searchcraft", exports: [".", "./react", "./next", "./mcp"], category: "search" },
} as const;
export type PackageName = keyof typeof packages;
