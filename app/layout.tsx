import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/newsreader";
import "./globals.css";
import { Providers } from "@/app/providers";
import { publicConfig } from "@/lib/network";

export const metadata: Metadata = {
  metadataBase: new URL(publicConfig.appUrl),
  title: {
    default: "AgentVault — Your AI memory, owned by you",
    template: "%s · AgentVault",
  },
  description:
    "Portable, encrypted memory and on-chain identity for AI agents, built on 0G.",
  applicationName: "AgentVault",
  keywords: ["AI agents", "encrypted memory", "ERC-8004", "0G", "Galileo"],
  openGraph: {
    type: "website",
    siteName: "AgentVault",
    title: "AgentVault — Your AI memory, owned by you",
    description: "Portable, encrypted memory and on-chain identity for AI agents, built on 0G.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentVault — Your AI memory, owned by you",
    description: "Portable, encrypted memory and on-chain identity for AI agents, built on 0G.",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
