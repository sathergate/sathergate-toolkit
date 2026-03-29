import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal — Developer Discovery",
  description: "Browse tools, articles, and opportunities curated for developers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-slate-950 text-slate-100">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
