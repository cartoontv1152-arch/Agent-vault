"use client";

import {
  ArrowClockwise,
  ArrowUpRight,
  CheckCircle,
  Copy,
  Fingerprint,
  LinkSimple,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useReadContract } from "wagmi";
import { AgentPageHeading } from "@/components/agent-page-heading";
import { AnchorButton } from "@/components/anchor-button";
import { useAgent } from "@/hooks/use-agent";
import { shortAddress, shortHash } from "@/lib/client";
import { identityRegistryAbi, MEMORY_ROOT_KEY } from "@/lib/contracts";
import { explorerAddress, explorerTransaction, publicConfig } from "@/lib/network";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFailed(false);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setFailed(true);
      window.setTimeout(() => setFailed(false), 1800);
    }
  }
  return <button className="copy-button" type="button" onClick={() => void copy()} aria-label={failed ? "Copy failed" : copied ? "Copied" : "Copy value"}><Copy weight="bold" /> {failed ? "Copy failed" : copied ? "Copied" : "Copy"}</button>;
}

export default function IdentityPage() {
  const { id } = useParams<{ id: string }>();
  const { agent, loading, error, refresh } = useAgent(id);
  const enabled = Boolean(agent?.agentId);
  const agentId = BigInt(agent?.agentId || "0");
  const ownerQuery = useReadContract({ address: publicConfig.identityRegistry, abi: identityRegistryAbi, functionName: "ownerOf", args: [agentId], query: { enabled } });
  const uriQuery = useReadContract({ address: publicConfig.identityRegistry, abi: identityRegistryAbi, functionName: "tokenURI", args: [agentId], query: { enabled } });
  const rootQuery = useReadContract({ address: publicConfig.identityRegistry, abi: identityRegistryAbi, functionName: "getMetadata", args: [agentId, MEMORY_ROOT_KEY], query: { enabled } });

  if (loading) return <main className="workspace-page"><div className="skeleton" /></main>;
  if (error || !agent) return <main className="workspace-page"><p className="form-error" role="alert"><WarningCircle weight="fill" /> {error || "Agent not found."}</p><button className="button" type="button" onClick={() => void refresh()}><ArrowClockwise weight="bold" /> Try again</button></main>;

  const onchainRoot = typeof rootQuery.data === "string" && rootQuery.data !== "0x" ? rootQuery.data : null;
  const verifiedOwner = typeof ownerQuery.data === "string" && ownerQuery.data.toLowerCase() === agent.owner.toLowerCase();
  const rootMatches = Boolean(agent.latestRoot && onchainRoot?.toLowerCase() === agent.latestRoot.toLowerCase());

  return (
    <main className="workspace-page identity-page">
      <AgentPageHeading agent={agent} section="Identity" description="Live ownership, registration, storage, and integrity state read from 0G Galileo." actions={<AnchorButton agent={agent} onSynced={async () => { await refresh(); await rootQuery.refetch(); }} />} />

      {(ownerQuery.isError || uriQuery.isError || rootQuery.isError) && <p className="form-error" role="alert"><WarningCircle weight="fill" /> Some on-chain details could not be read. Check the Galileo RPC connection and try again.</p>}

      <section className="identity-hero surface">
        <div className="identity-avatar"><Fingerprint weight="fill" /></div>
        <div><p className="eyebrow">ERC-8004 agent identity</p><h2>{agent.name}</h2><p>{agent.purpose}</p></div>
        <span className={verifiedOwner ? "status-chip" : "status-chip status-chip-danger"}>{verifiedOwner ? <CheckCircle weight="fill" /> : <ShieldCheck weight="fill" />}{verifiedOwner ? "Owner verified" : "Checking owner"}</span>
      </section>

      <div className="identity-grid">
        <section className="identity-details surface">
          <header><h2>On-chain record</h2><a href={explorerAddress(publicConfig.identityRegistry)} target="_blank" rel="noreferrer">Registry <ArrowUpRight weight="bold" /></a></header>
          <dl>
            <div><dt>Agent ID</dt><dd><strong>#{agent.agentId}</strong></dd></div>
            <div><dt>Owner</dt><dd className="mono">{ownerQuery.data ? shortAddress(ownerQuery.data) : "Reading chain…"}<CopyButton value={ownerQuery.data || agent.owner} /></dd></div>
            <div><dt>Network</dt><dd>0G Galileo <span className="status-chip">Testnet</span></dd></div>
            <div><dt>Identity registry</dt><dd className="mono">{shortAddress(publicConfig.identityRegistry)}<CopyButton value={publicConfig.identityRegistry} /></dd></div>
            <div><dt>Registration</dt><dd><a className="record-link" href={explorerTransaction(agent.registrationTxHash)} target="_blank" rel="noreferrer">{shortHash(agent.registrationTxHash)} <ArrowUpRight weight="bold" /></a></dd></div>
          </dl>
        </section>

        <section className="integrity-panel surface">
          <header><div><h2>Memory integrity</h2><p>Latest encrypted snapshot compared with ERC-8004 metadata.</p></div>{rootMatches ? <CheckCircle weight="fill" /> : <LinkSimple weight="bold" />}</header>
          <div className="root-comparison">
            <div><span>Latest storage root</span><code>{agent.latestRoot ? shortHash(agent.latestRoot) : "No snapshot yet"}</code></div>
            <span className={rootMatches ? "root-connector root-connector-match" : "root-connector"}>{rootMatches ? "Matches" : "Not anchored"}</span>
            <div><span>On-chain memory root</span><code>{onchainRoot ? shortHash(onchainRoot) : "No root anchored"}</code></div>
          </div>
          <div className="integrity-meta"><span>Storage <strong>{agent.storageBackend === "og" ? "0G Storage Turbo" : agent.storageBackend === "local" ? "Encrypted local mode" : "Not used"}</strong></span><span>Agent card <strong>{uriQuery.data ? "Available on-chain" : "Reading…"}</strong></span></div>
          {agent.anchorTxHash && <a className="button" href={explorerTransaction(agent.anchorTxHash)} target="_blank" rel="noreferrer">View latest anchor <ArrowUpRight weight="bold" /></a>}
        </section>
      </div>

      <section className="identity-explanation">
        <Fingerprint weight="fill" /><div><h2>What this proves</h2><p>The registry proves who owns this agent identity. The memory root proves which encrypted snapshot was approved by that owner. The memory itself remains private and is never written directly to the chain.</p></div>
      </section>
    </main>
  );
}
