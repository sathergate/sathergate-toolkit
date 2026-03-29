import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "sathergate-toolkit — Agent-native infrastructure for Next.js",
  description:
    "8 packages. Zero dependencies. MCP in every one. Authorization, feature flags, rate limiting, image processing, notifications, cron jobs, secrets, and search.",
  keywords: [
    "nextjs", "react", "mcp", "claude-code", "agent-native", "toolkit",
    "rbac", "feature-flags", "rate-limiting", "image-processing",
    "notifications", "cron", "secrets", "search",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
