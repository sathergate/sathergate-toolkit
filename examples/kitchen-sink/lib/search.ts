import { createSifter } from "searchcraft";

const articles = [
  {
    id: "1",
    title: "Getting Started with sathergate-toolkit",
    body: "Learn how to set up the agent-native infrastructure toolkit for your Next.js app.",
    tags: "tutorial getting-started nextjs",
  },
  {
    id: "2",
    title: "Rate Limiting Best Practices",
    body: "Protect your API routes with sliding window and token bucket algorithms.",
    tags: "security rate-limiting api",
  },
  {
    id: "3",
    title: "Feature Flags for Gradual Rollouts",
    body: "Use percentage-based rollouts and targeting rules to ship features safely.",
    tags: "feature-flags deployment rollout",
  },
  {
    id: "4",
    title: "Full-Text Search Without External Services",
    body: "Add BM25-powered search to your app with zero external dependencies.",
    tags: "search bm25 full-text",
  },
  {
    id: "5",
    title: "Scheduling Cron Jobs in Serverless",
    body: "Run recurring tasks on Vercel with declarative job definitions and retry support.",
    tags: "cron serverless vercel scheduling",
  },
];

export const sifter = createSifter({
  schema: {
    title: { weight: 2 },
    body: true,
    tags: { weight: 1.5 },
  },
  documents: articles,
});
