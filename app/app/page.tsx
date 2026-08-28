"use client";

import {
  ArrowRight,
  ArrowClockwise,
  Brain,
  CheckCircle,
  Fingerprint,
  Plus,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/client";
import type { Agent } from "@/lib/types";

type Health = {
  chain: { connected: boolean; registryAvailable: boolean };
  storage: { backend: "og" | "local"; configured: boolean; required: boolean };
  compute: { configured: boolean };
  persistence: { backend: "postgres" | "sqlite"; durable: boolean };
};

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [agentResult, healthResult] = await Promise.all([
        apiFetch<{ agents: Agent[] }>("/api/agents"),
        apiFetch<Health>("/api/health"),
      ]);
      setAgents(agentResult.agents);
      setHealth(healthResult);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "The workspace could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const memoryCount = useMemo(
    () => agents.reduce((sum, agent) => sum + (agent.memoryCount || 0), 0),
    [agents],
  );
  const anchoredCount = agents.filter(
    (agent) => agent.latestRoot && agent.latestRoot === agent.anchoredRoot,
  ).length;

  return (
    <main className="workspace-page dashboard-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Owner workspace</p>
          <h1>Your agents</h1>
          <p>Portable identities and the private memories attached to them.</p>
        </div>
        <Link className="button button-primary" href="/app/agents/new">
          <Plus weight="bold" /> Create agent
        </Link>
      </header>

      {loadError && (
        <div className="load-error" role="alert">
          <p className="form-error"><WarningCircle weight="fill" /> {loadError}</p>
          <button className="button button-small" type="button" onClick={() => void loadData()}><ArrowClockwise weight="bold" /> Retry</button>
        </div>
      )}

      {health && (
        <section className="health-strip" aria-label="Integration status">
          <div>
            {health.chain.connected && health.chain.registryAvailable ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}
            <span><strong>0G Chain</strong><small>{health.chain.connected ? "Galileo connected" : "Connection issue"}</small></span>
          </div>
          <div>
            {health.compute.configured ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}
            <span><strong>0G Compute</strong><small>{health.compute.configured ? "Router configured" : "API key required"}</small></span>
          </div>
          <div>
            {health.storage.backend === "og" ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}
            <span><strong>Memory storage</strong><small>{health.storage.backend === "og" ? "0G Turbo" : "Encrypted local mode"}</small></span>
          </div>
          <div>
            {health.persistence.durable ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}
            <span><strong>Application data</strong><small>{health.persistence.backend === "postgres" ? "Serverless Postgres" : "Local SQLite"}</small></span>
          </div>
        </section>
      )}

      {agents.length > 0 && (
        <section className="dashboard-stats" aria-label="Vault totals">
          <div><span>Agents</span><strong>{agents.length}</strong></div>
          <div><span>Memories</span><strong>{memoryCount}</strong></div>
          <div><span>Roots anchored</span><strong>{anchoredCount}</strong></div>
        </section>
      )}

      {loading ? (
        <div className="agent-grid"><div className="skeleton" /><div className="skeleton" /></div>
      ) : agents.length === 0 ? (
        <section className="surface empty-state">
          <span className="empty-state-icon"><Fingerprint weight="fill" /></span>
          <h2>Create your first portable agent</h2>
          <p>Mint an on-chain identity, choose what it should remember, then begin a private conversation.</p>
          <Link className="button button-primary" href="/app/agents/new">
            Create agent <ArrowRight weight="bold" />
          </Link>
        </section>
      ) : (
        <section className="agent-grid" aria-label="Agents">
          {agents.map((agent) => {
            const synced = Boolean(agent.latestRoot && agent.latestRoot === agent.anchoredRoot);
            return (
              <Link className="agent-card" href={`/app/agents/${agent.id}/chat`} key={agent.id}>
                <div className="agent-card-top">
                  <span className="agent-avatar">{agent.name.slice(0, 2).toUpperCase()}</span>
                  <span className={synced ? "status-chip" : "status-chip status-chip-neutral"}>
                    {synced ? <CheckCircle weight="fill" /> : <Brain weight="fill" />}
                    {synced ? "Anchored" : agent.latestRoot ? "Root pending" : "New vault"}
                  </span>
                </div>
                <div className="agent-card-copy">
                  <h2>{agent.name}</h2>
                  <p>{agent.purpose}</p>
                </div>
                <div className="agent-card-meta">
                  <span><strong>{agent.memoryCount || 0}</strong> memories</span>
                  <span className="mono">Agent #{agent.agentId}</span>
                  <ArrowRight weight="bold" />
                </div>
              </Link>
            );
          })}
          <Link className="new-agent-card" href="/app/agents/new">
            <Plus weight="bold" /><span><strong>New agent</strong><small>Create another identity</small></span>
          </Link>
        </section>
      )}
    </main>
  );
}
