import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

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
    <html lang="en" className={`bg-slate-950 text-slate-100 ${geist.className}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
