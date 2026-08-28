"use client";

import { Wallet } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth-provider";
import { shortAddress } from "@/lib/client";

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const auth = useAuth();

  if (auth.authenticated && auth.address) {
    return (
      <button className="wallet-connected" onClick={() => void auth.lock()} type="button">
        <span className="status-dot" />
        {compact ? shortAddress(auth.address) : `${shortAddress(auth.address)} · Lock`}
      </button>
    );
  }

  return (
    <button
      className="button button-primary"
      disabled={auth.loading}
      onClick={() => void auth.unlock().catch(() => undefined)}
      type="button"
    >
      <Wallet weight="bold" aria-hidden="true" />
      {auth.loading ? "Opening wallet…" : auth.connected ? "Unlock vault" : "Connect wallet"}
    </button>
  );
}
