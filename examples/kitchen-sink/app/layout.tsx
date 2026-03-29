import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "sathergate-toolkit Kitchen Sink",
  description:
    "Example Next.js app demonstrating flagpost, ratelimit-next, searchcraft, croncall, and vaultbox working together.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
