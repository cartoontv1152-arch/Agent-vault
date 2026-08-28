"use client";

import {
  ArrowClockwise,
  ArrowUp,
  Brain,
  CheckCircle,
  Cpu,
  LockKey,
  WarningCircle,
} from "@phosphor-icons/react";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { AgentPageHeading } from "@/components/agent-page-heading";
import { AnchorButton } from "@/components/anchor-button";
import { useAuth } from "@/components/auth-provider";
import { useAgent } from "@/hooks/use-agent";
import { apiFetch } from "@/lib/client";
import type { ChatMessage, MemoryType } from "@/lib/types";

type Model = { id: string; ownedBy?: string };

type ChatResult = {
  message: ChatMessage;
  userMessageId: string;
  memory: {
    saved: Array<{
      id: string;
      type: MemoryType;
      content: string;
      importance: number;
      confidence: number;
    }>;
    used: string[];
    warning: string | null;
  };
  snapshot: {
    rootHash: string;
    transactionHash: string | null;
    backend: "og" | "local";
  } | null;
};

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const auth = useAuth();
  const { agent, loading, error, refresh } = useAgent(id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const [memoryNotice, setMemoryNotice] = useState<ChatResult["memory"] | null>(null);
  const [storageNotice, setStorageNotice] = useState<ChatResult["snapshot"]>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auth.vaultKey || !agent) return;
    let cancelled = false;
    setHistoryLoading(true);
    void Promise.allSettled([
      apiFetch<{ messages: ChatMessage[] }>(`/api/agents/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ vaultKey: auth.vaultKey }),
      }),
      apiFetch<{ models: Model[] }>("/api/models"),
    ]).then(([historyResult, modelResult]) => {
      if (cancelled) return;
      const errors: string[] = [];
      if (historyResult.status === "fulfilled") {
        setMessages(historyResult.value.messages);
      } else {
        errors.push(
          historyResult.reason instanceof Error
            ? historyResult.reason.message
            : "Conversation history could not be loaded.",
        );
      }
      if (modelResult.status === "fulfilled") {
        setModels(modelResult.value.models);
        setSelectedModel((current) => {
          if (
            current &&
            modelResult.value.models.some((model) => model.id === current)
          ) {
            return current;
          }
          return modelResult.value.models[0]?.id || "";
        });
      } else {
        setModels([]);
        errors.push(
          modelResult.reason instanceof Error
            ? modelResult.reason.message
            : "0G Compute models could not be loaded.",
        );
      }
      setChatError(errors[0] || null);
      setHistoryLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [agent, auth.vaultKey, id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, sending]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const content = prompt.trim();
    if (!content || !auth.vaultKey || !agent || sending) return;
    const optimistic: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      model: selectedModel || null,
      computeVerified: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    setPrompt("");
    setSending(true);
    setChatError(null);
    setMemoryNotice(null);
    try {
      const result = await apiFetch<ChatResult>(`/api/agents/${id}/chat`, {
        method: "POST",
        body: JSON.stringify({
          content,
          vaultKey: auth.vaultKey,
          ...(selectedModel ? { model: selectedModel } : {}),
        }),
      });
      setMessages((current) => [...current, result.message]);
      setMemoryNotice(result.memory);
      setStorageNotice(result.snapshot);
      await refresh();
    } catch (cause) {
      setMessages((current) =>
        current.filter((message) => message.id !== optimistic.id),
      );
      setPrompt(content);
      setChatError(cause instanceof Error ? cause.message : "The message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <main className="workspace-page"><div className="skeleton" /></main>;
  if (error || !agent) return <main className="workspace-page"><p className="form-error" role="alert"><WarningCircle weight="fill" /> {error || "Agent not found."}</p><button className="button" type="button" onClick={() => void refresh()}><ArrowClockwise weight="bold" /> Try again</button></main>;

  return (
    <main className="workspace-page chat-page">
      <AgentPageHeading
        agent={agent}
        section={`Chat with ${agent.name}`}
        description="The selected model receives only the relevant memories retrieved from this vault."
        actions={<AnchorButton agent={agent} onSynced={refresh} />}
      />

      {!auth.vaultKey ? (
        <section className="surface vault-locked-panel">
          <LockKey weight="fill" />
          <h2>Memory is locked</h2>
          <p>Sign the fixed unlock message to derive this wallet’s private vault key.</p>
          <button className="button button-primary" onClick={() => void auth.unlockVault().catch(() => undefined)} type="button">Unlock memory</button>
        </section>
      ) : (
        <section className="chat-layout">
          <div className="chat-main surface">
            <header className="chat-toolbar">
              <div className="chat-agent-identity">
                <span>{agent.name.slice(0, 2).toUpperCase()}</span>
                <div><strong>{agent.name}</strong><small>Agent #{agent.agentId}</small></div>
              </div>
              <label className="model-select">
                <Cpu weight="bold" />
                <span className="sr-only">0G Compute model</span>
                <select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} disabled={!models.length}>
                  {models.length ? models.map((model) => <option key={model.id} value={model.id}>{model.id}</option>) : <option value="">Compute not configured</option>}
                </select>
              </label>
            </header>

            <div className="message-list" aria-live="polite">
              {historyLoading ? (
                <div className="message-loading"><span className="loader-mark" />Decrypting conversation…</div>
              ) : messages.length === 0 ? (
                <div className="chat-welcome">
                  <span>{agent.name.slice(0, 2).toUpperCase()}</span>
                  <h2>What are we working on?</h2>
                  <p>{agent.purpose}</p>
                </div>
              ) : (
                messages.map((message) => (
                  <article className={`message message-${message.role}`} key={message.id}>
                    <div className="message-author">{message.role === "user" ? "You" : agent.name}</div>
                    <p>{message.content}</p>
                    <small>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
                  </article>
                ))
              )}
              {sending && <div className="assistant-thinking"><span /><span /><span /> {agent.name} is thinking</div>}
              <div ref={endRef} />
            </div>

            <div className="chat-feedback">
              {memoryNotice && memoryNotice.saved.length > 0 && (
                <div className="memory-saved-note">
                  <Brain weight="fill" />
                  <span><strong>{memoryNotice.saved.length} {memoryNotice.saved.length === 1 ? "memory" : "memories"} saved</strong><small>{memoryNotice.saved.map((memory) => memory.content).join(" · ")}</small></span>
                </div>
              )}
              {memoryNotice?.used.length ? <div className="memory-used-note"><CheckCircle weight="fill" /> {memoryNotice.used.length} memories used</div> : null}
              {memoryNotice?.warning && <div className="memory-warning"><WarningCircle weight="fill" /> {memoryNotice.warning}</div>}
              {storageNotice && (
                <div className={storageNotice.backend === "og" ? "storage-note" : "storage-note storage-note-local"}>
                  {storageNotice.backend === "og" ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}
                  {storageNotice.backend === "og" ? "Encrypted snapshot stored on 0G" : "Encrypted snapshot stored locally; add the 0G Storage service key for decentralized persistence"}
                </div>
              )}
              {chatError && <p className="form-error" role="alert">{chatError}</p>}
            </div>

            <form className="composer" onSubmit={(event) => void send(event)}>
              <textarea
                aria-label="Message"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={models.length ? `Message ${agent.name}…` : "Configure 0G Compute to begin…"}
                disabled={!models.length || sending}
                maxLength={8000}
              />
              <button type="submit" aria-label="Send message" disabled={!prompt.trim() || !models.length || sending}>
                <ArrowUp weight="bold" />
              </button>
            </form>
          </div>

          <aside className="chat-context">
            <div className="context-panel surface">
              <p className="context-title">Current session</p>
              <dl>
                <div><dt>Model</dt><dd>{selectedModel || "Not configured"}</dd></div>
                <div><dt>Saved memory</dt><dd>{agent.memoryCount || 0}</dd></div>
                <div><dt>Storage</dt><dd>{agent.storageBackend === "og" ? "0G Storage" : agent.storageBackend === "local" ? "Local encrypted" : "No snapshot"}</dd></div>
              </dl>
            </div>
            {!models.length && (
              <div className="compute-setup surface">
                <Cpu weight="fill" />
                <h3>Connect 0G Compute</h3>
                <p>Add a funded testnet Router key to <code>OG_COMPUTE_API_KEY</code>, then restart the app.</p>
                <a className="text-link" href="https://pc.testnet.0g.ai" target="_blank" rel="noreferrer">Open 0G Compute</a>
              </div>
            )}
          </aside>
        </section>
      )}
    </main>
  );
}
