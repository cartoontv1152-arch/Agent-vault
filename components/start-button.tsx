"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";

export function StartButton() {
  const auth = useAuth();
  const router = useRouter();
  const [working, setWorking] = useState(false);

  async function start() {
    setWorking(true);
    try {
      if (!auth.authenticated || !auth.vaultKey) await auth.unlock();
      router.push("/app");
    } catch {
      // AuthProvider presents the wallet error beside the relevant control.
    } finally {
      setWorking(false);
    }
  }

  return (
    <button className="button button-primary button-large" onClick={() => void start()} disabled={working}>
      {working ? "Opening vault…" : "Create your agent"}
      {!working && <ArrowRight weight="bold" aria-hidden="true" />}
    </button>
  );
}
