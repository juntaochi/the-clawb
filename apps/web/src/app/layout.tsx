import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Clawb",
  description: "24/7 AI live coding club — Strudel + Hydra",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white min-h-screen font-mono">{children}</body>
    </html>
  );
}
