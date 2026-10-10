import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProofLink: check before you trust",
  description:
    "Paste a suspicious message, link, or screenshot. ProofLink shows what looks risky, why, and what to do next.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
