"use client";

import { CheckCircle, LinkSimple } from "@phosphor-icons/react";
import { useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { apiFetch } from "@/lib/client";
import { identityRegistryAbi, MEMORY_ROOT_KEY } from "@/lib/contracts";
import { publicConfig } from "@/lib/network";
import type { Agent } from "@/lib/types";

export function AnchorButton({
  agent,
  onSynced,
}: {
  agent: Agent;
  onSynced?: () => void | Promise<void>;
}) {
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const synced = Boolean(
    agent.latestRoot &&
      agent.anchoredRoot?.toLowerCase() === agent.latestRoot.toLowerCase(),
  );

  async function anchor() {
    if (!agent.latestRoot || !client) return;
    setWorking(true);
    setError(null);
    try {
      const hash = await writeContractAsync({
        address: publicConfig.identityRegistry,
        abi: identityRegistryAbi,
        functionName: "setMetadata",
        args: [
          BigInt(agent.agentId),
          MEMORY_ROOT_KEY,
          agent.latestRoot as `0x${string}`,
        ],
      });
      await client.waitForTransactionReceipt({ hash });
      await apiFetch(`/api/agents/${agent.id}/sync`, {
        method: "POST",
        body: JSON.stringify({ rootHash: agent.latestRoot, transactionHash: hash }),
      });
      await onSynced?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The root could not be anchored.");
    } finally {
      setWorking(false);
    }
  }

  if (!agent.latestRoot) return null;
  if (synced) {
    return <span className="status-chip"><CheckCircle weight="fill" /> Root anchored</span>;
  }

  return (
    <div className="anchor-action">
      <button className="button button-accent" type="button" onClick={() => void anchor()} disabled={working}>
        <LinkSimple weight="bold" /> {working ? "Confirming…" : "Anchor latest root"}
      </button>
      {error && <span className="anchor-error" role="alert">{error}</span>}
    </div>
  );
}
