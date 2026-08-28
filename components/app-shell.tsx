"use client";

import {
  Brain,
  ChatCircle,
  Fingerprint,
  House,
  Plus,
  SidebarSimple,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Brand } from "@/components/brand";
import { WalletButton } from "@/components/wallet-button";
import { apiFetch } from "@/lib/client";
import { publicConfig } from "@/lib/network";
import type { Agent } from "@/lib/types";

function navClass(active: boolean) {
  return active ? "shell-link shell-link-active" : "shell-link";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    if (!auth.authenticated) {
      setAgents([]);
      setAgentsError(null);
      return;
    }
    setAgentsError(null);
    try {
      const { agents: data } = await apiFetch<{ agents: Agent[] }>("/api/agents");
      setAgents(data);
    } catch (cause) {
      setAgentsError(cause instanceof Error ? cause.message : "Agents could not be loaded.");
    }
  }, [auth.authenticated]);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents, pathname]);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem("agentvault:sidebar-collapsed") === "true");
    } catch {
      // Private browsing can disable localStorage; the sidebar remains usable.
    }
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (auth.loading) {
    return <div className="route-loader"><span className="loader-mark" />Opening AgentVault…</div>;
  }

  if (!auth.authenticated) {
    return (
      <main className="auth-gate">
        <Brand />
        <div>
          <p className="eyebrow">Private by default</p>
          <h1>Open your vault.</h1>
          <p>Connect the owner wallet to view agents and decrypt their memory.</p>
          <WalletButton />
          {auth.error && <p className="form-error" role="alert">{auth.error}</p>}
        </div>
        <Link href="/" className="text-link">Back to AgentVault</Link>
      </main>
    );
  }

  const activeAgent = agents.find((agent) => agent.id === params.id);
  const agentBase = activeAgent ? `/app/agents/${activeAgent.id}` : null;

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      try {
        window.localStorage.setItem("agentvault:sidebar-collapsed", String(next));
      } catch {
        // Ignore storage failures; this is only a preference.
      }
      return next;
    });
  }

  return (
    <div className={collapsed ? "app-frame sidebar-collapsed" : "app-frame"}>
      <header className="mobile-shell-header">
        <Brand href="/app" />
        <button className="icon-button" onClick={() => setMenuOpen((value) => !value)} aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="app-sidebar">
          {menuOpen ? <X weight="bold" /> : <SidebarSimple weight="bold" />}
        </button>
      </header>
      <aside id="app-sidebar" className={menuOpen ? "sidebar sidebar-open" : "sidebar"}>
        <div className="sidebar-top">
          <div className="sidebar-brand-row">
            <Brand href="/app" />
            <button
              className="sidebar-collapse-toggle"
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-pressed={collapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <SidebarSimple weight="bold" />
            </button>
          </div>
          <WalletButton compact />
        </div>
        <nav className="primary-nav" aria-label="Workspace navigation">
          <Link className={navClass(pathname === "/app")} href="/app">
            <House weight="bold" /> Overview
          </Link>
          <Link className={navClass(pathname === "/app/agents/new")} href="/app/agents/new">
            <Plus weight="bold" /> New agent
          </Link>
        </nav>
        <div className="sidebar-agents">
          <p>Your agents</p>
          {agentsError ? (
            <div className="sidebar-load-error">
              <span>Could not load agents.</span>
              <button type="button" onClick={() => void loadAgents()}>Retry</button>
            </div>
          ) : agents.length === 0 ? (
            <span className="sidebar-empty">No agents yet</span>
          ) : (
            agents.map((agent) => (
              <Link
                className={agent.id === params.id ? "agent-mini agent-mini-active" : "agent-mini"}
                href={`/app/agents/${agent.id}/chat`}
                key={agent.id}
              >
                <span>{agent.name.slice(0, 2).toUpperCase()}</span>
                <div><strong>{agent.name}</strong><small>Agent #{agent.agentId}</small></div>
              </Link>
            ))
          )}
        </div>
        {agentBase && (
          <nav className="agent-nav" aria-label={`${activeAgent?.name} navigation`}>
            <p>Agent workspace</p>
            <Link className={navClass(pathname.endsWith("/chat"))} href={`${agentBase}/chat`}>
              <ChatCircle weight="bold" /> Chat
            </Link>
            <Link className={navClass(pathname.endsWith("/memory"))} href={`${agentBase}/memory`}>
              <Brain weight="bold" /> Memory
            </Link>
            <Link className={navClass(pathname.endsWith("/identity"))} href={`${agentBase}/identity`}>
              <Fingerprint weight="bold" /> Identity
            </Link>
          </nav>
        )}
        <div className="sidebar-foot">
          <span className="status-dot" />
          <span>0G Galileo</span>
          <small>Testnet · {publicConfig.chainId}</small>
        </div>
      </aside>
      <div id="main-content" className="shell-content">{children}</div>
      {menuOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    </div>
  );
}
