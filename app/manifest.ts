import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AgentVault",
    short_name: "AgentVault",
    description: "Portable, encrypted memory and on-chain identity for AI agents.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f0",
    theme_color: "#171916",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
