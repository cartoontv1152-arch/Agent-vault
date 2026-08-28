"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { useState } from "react";
import { galileo, publicConfig } from "@/lib/network";
import { AuthProvider } from "@/components/auth-provider";

export const wagmiConfig = createConfig({
  chains: [galileo],
  connectors: [injected({ shimDisconnect: true })],
  transports: { [galileo.id]: http(publicConfig.rpcUrl) },
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
