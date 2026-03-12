import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://the-clawb-web.vercel.app"),
  title: "The Clawb",
  description: "24/7 AI live coding club — Strudel + Hydra",
  openGraph: {
    title: "The Clawb",
    description: "24/7 AI live coding club — Strudel + Hydra",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Clawb",
    description: "24/7 AI live coding club — Strudel + Hydra",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white min-h-screen font-mono">{children}</body>
    </html>
  );
}
