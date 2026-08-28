"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("AgentVault route error", error);
  }, [error]);

  return (
    <main id="main-content" className="error-page">
      <Brand />
      <div className="error-card">
        <p className="eyebrow">Something went wrong</p>
        <h1>That view could not load.</h1>
        <p>Your vault is unchanged. Try the request again, or return to the AgentVault home page.</p>
        <div className="error-actions"><button className="button button-primary" type="button" onClick={() => reset()}>Try again</button><Link className="text-link" href="/">Back home</Link></div>
      </div>
    </main>
  );
}
