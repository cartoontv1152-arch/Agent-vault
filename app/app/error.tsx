"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";

export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("AgentVault workspace error", error);
  }, [error]);

  return (
    <main className="error-page workspace-error-page">
      <Brand href="/app" />
      <div className="error-card">
        <p className="eyebrow">Workspace recovery</p>
        <h1>This workspace view needs a refresh.</h1>
        <p>No encrypted data was changed. Retry the view or return to your agent overview.</p>
        <div className="error-actions"><button className="button button-primary" type="button" onClick={() => reset()}>Try again</button><Link className="text-link" href="/app">Back to overview</Link></div>
      </div>
    </main>
  );
}
