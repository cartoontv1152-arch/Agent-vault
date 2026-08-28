"use client";

import {
  ArrowClockwise,
  Brain,
  CheckCircle,
  DownloadSimple,
  FloppyDisk,
  LockKey,
  MagnifyingGlass,
  Plus,
  PencilSimple,
  ShieldCheck,
  Trash,
  UploadSimple,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useParams } from "next/navigation";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentPageHeading } from "@/components/agent-page-heading";
import { AnchorButton } from "@/components/anchor-button";
import { useAuth } from "@/components/auth-provider";
import { useAgent } from "@/hooks/use-agent";
import { apiFetch } from "@/lib/client";
import { memoryTypes, type Memory, type MemoryType } from "@/lib/types";

const typeLabels: Record<MemoryType, string> = {
  preference: "Preference",
  project: "Project",
  technology: "Technology",
  decision: "Decision",
  fact: "Fact",
  knowledge: "Knowledge",
};

type DraftMemory = { content: string; type: MemoryType; importance: number };

function isMemoryType(value: unknown): value is MemoryType {
  return typeof value === "string" && memoryTypes.includes(value as MemoryType);
}

export default function MemoryPage() {
  const { id } = useParams<{ id: string }>();
  const auth = useAuth();
  const { agent, loading, error, refresh } = useAgent(id);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemoryType | "all">("all");
  const [editing, setEditing] = useState<Memory | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<{ memories: DraftMemory[]; skipped: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Memory | null>(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [verification, setVerification] = useState<{ verified: boolean; anchored: boolean; backend: "og" | "local" } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const loadMemories = useCallback(async () => {
    if (!auth.vaultKey) return;
    setLoadError(null);
    try {
      const result = await apiFetch<{ memories: Memory[] }>(`/api/agents/${id}/memories`, {
        method: "POST",
        body: JSON.stringify({ vaultKey: auth.vaultKey }),
      });
      setMemories(result.memories);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Memories could not be loaded.");
      throw cause;
    }
  }, [auth.vaultKey, id]);

  useEffect(() => {
    void loadMemories().catch(() => undefined);
  }, [loadMemories]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return memories.filter((memory) =>
      (filter === "all" || memory.type === filter) &&
      (!term || memory.content.toLocaleLowerCase().includes(term)),
    );
  }, [filter, memories, query]);

  const grouped = useMemo(() => {
    return filtered.reduce<Partial<Record<MemoryType, Memory[]>>>((groups, memory) => {
      (groups[memory.type] ||= []).push(memory);
      return groups;
    }, {});
  }, [filtered]);

  async function saveMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !auth.vaultKey) return;
    const data = new FormData(event.currentTarget);
    setWorking(true);
    setActionError(null);
    try {
      await apiFetch(`/api/agents/${id}/memories/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          vaultKey: auth.vaultKey,
          content: data.get("content"),
          type: data.get("type"),
          importance: Number(data.get("importance")),
        }),
      });
      setEditing(null);
      setNotice("Memory updated. The new encrypted root is ready to anchor.");
      await Promise.all([loadMemories(), refresh()]);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Memory could not be updated.");
    } finally {
      setWorking(false);
    }
  }

  async function removeMemory() {
    if (!auth.vaultKey || !deleteTarget) return;
    setWorking(true);
    setActionError(null);
    try {
      await apiFetch(`/api/agents/${id}/memories/${deleteTarget.id}`, {
        method: "DELETE",
        body: JSON.stringify({ vaultKey: auth.vaultKey }),
      });
      setNotice("Memory removed. The new encrypted root is ready to anchor.");
      setDeleteTarget(null);
      await Promise.all([loadMemories(), refresh()]);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Memory could not be removed.");
    } finally {
      setWorking(false);
    }
  }

  async function createMemories(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.vaultKey) return;
    const data = new FormData(event.currentTarget);
    setWorking(true);
    setActionError(null);
    try {
      const result = await apiFetch<{ created: DraftMemory[]; skipped: number }>(`/api/agents/${id}/memories`, {
        method: "PUT",
        body: JSON.stringify({
          vaultKey: auth.vaultKey,
          memories: [{
            content: data.get("content"),
            type: data.get("type"),
            importance: Number(data.get("importance")),
          }],
        }),
      });
      setComposerOpen(false);
      setNotice(result.created.length ? "Memory added and encrypted. The new root is ready to anchor." : "That memory already exists, so nothing was added.");
      await Promise.all([loadMemories(), refresh()]);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Memory could not be added.");
    } finally {
      setWorking(false);
    }
  }

  async function importMemories() {
    if (!auth.vaultKey || !importPreview) return;
    setWorking(true);
    setActionError(null);
    try {
      const result = await apiFetch<{ created: DraftMemory[]; skipped: number }>(`/api/agents/${id}/memories`, {
        method: "PUT",
        body: JSON.stringify({ vaultKey: auth.vaultKey, memories: importPreview.memories }),
      });
      setImportPreview(null);
      setNotice(`${result.created.length} memories imported${result.skipped ? `; ${result.skipped} duplicates skipped` : ""}.`);
      await Promise.all([loadMemories(), refresh()]);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Memories could not be imported.");
    } finally {
      setWorking(false);
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setActionError(null);
    if (file.size > 2 * 1024 * 1024) {
      setActionError("Import files must be smaller than 2 MB.");
      return;
    }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const source = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && "memories" in parsed && Array.isArray(parsed.memories)
          ? parsed.memories
          : null;
      if (!source) throw new Error("Choose a JSON export containing a memories array.");
      const memories: DraftMemory[] = [];
      let skipped = 0;
      for (const value of source) {
        if (!value || typeof value !== "object") { skipped += 1; continue; }
        const item = value as { content?: unknown; type?: unknown; importance?: unknown };
        const content = typeof item.content === "string" ? item.content.trim() : "";
        if (content.length < 3 || content.length > 500 || !isMemoryType(item.type)) { skipped += 1; continue; }
        const importance = typeof item.importance === "number" && Number.isFinite(item.importance)
          ? Math.min(1, Math.max(0, item.importance))
          : 0.65;
        memories.push({ content, type: item.type, importance });
        if (memories.length >= 100) break;
      }
      if (!memories.length) throw new Error("No valid memories were found in that file.");
      setImportPreview({ memories, skipped: skipped + Math.max(0, source.length - memories.length - skipped) });
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "The memory export could not be read.");
    }
  }

  function exportMemories() {
    if (!agent) return;
    const payload = {
      format: "agentvault/memory-export@1",
      agent: { id: agent.id, name: agent.name, agentId: agent.agentId },
      exportedAt: new Date().toISOString(),
      memories: memories.map(({ type, content, importance }) => ({ type, content, importance })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "agent"}-memories.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice(`${memories.length} memories exported as JSON.`);
  }

  async function verify() {
    setWorking(true);
    setActionError(null);
    try {
      const result = await apiFetch<{ verified: boolean; anchored: boolean; backend: "og" | "local" }>(`/api/agents/${id}/verify`, { method: "POST" });
      setVerification(result);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Verification failed.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <main className="workspace-page"><div className="skeleton" /></main>;
  if (error || !agent) return <main className="workspace-page"><p className="form-error" role="alert"><WarningCircle weight="fill" /> {error || "Agent not found."}</p><button className="button" type="button" onClick={() => void refresh()}><ArrowClockwise weight="bold" /> Try again</button></main>;

  return (
    <main className="workspace-page memory-page">
      <AgentPageHeading
        agent={agent}
        section="Memory"
        description={`Review exactly what ${agent.name} can carry into future models and sessions.`}
        actions={<><button className="button" onClick={() => void verify()} disabled={working || !agent.latestRoot}><ShieldCheck weight="bold" /> Verify snapshot</button><AnchorButton agent={agent} onSynced={refresh} /></>}
      />

      {!auth.vaultKey ? (
        <section className="surface vault-locked-panel">
          <LockKey weight="fill" /><h2>Memory is encrypted</h2><p>Only the owner wallet can derive the key used to open this vault.</p>
          <button className="button button-primary" onClick={() => void auth.unlockVault().catch(() => undefined)}>Unlock memory</button>
        </section>
      ) : (
        <>
          <section className="memory-toolbar">
            <label className="memory-search"><MagnifyingGlass weight="bold" /><span className="sr-only">Search memories</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search private memory…" /></label>
            <label className="memory-filter"><span className="sr-only">Filter memory type</span><select value={filter} onChange={(event) => setFilter(event.target.value as MemoryType | "all")}><option value="all">All types</option>{memoryTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></label>
            <div className="memory-toolbar-actions">
              <button className="button button-small" type="button" onClick={() => { setActionError(null); setComposerOpen(true); }}><Plus weight="bold" /> Add</button>
              <button className="button button-small" type="button" onClick={() => importInputRef.current?.click()}><UploadSimple weight="bold" /> Import</button>
              <button className="button button-small" type="button" onClick={exportMemories} disabled={!memories.length}><DownloadSimple weight="bold" /> Export</button>
              <input ref={importInputRef} className="sr-only" type="file" accept="application/json,.json" onChange={(event) => void handleImportFile(event)} />
            </div>
          </section>

          {loadError && <div className="memory-notices"><p className="form-error" role="alert"><WarningCircle weight="fill" /> {loadError} <button className="text-link" type="button" onClick={() => void loadMemories()}>Retry</button></p></div>}

          {(notice || actionError || verification) && (
            <div className="memory-notices">
              {notice && <p className="inline-notice"><CheckCircle weight="fill" /> {notice}</p>}
              {actionError && <p className="form-error"><WarningCircle weight="fill" /> {actionError}</p>}
              {verification && <p className={verification.verified ? "inline-notice" : "form-error"}>{verification.verified ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />} {verification.verified ? `${verification.backend === "og" ? "0G Storage proof" : "Local content hash"} verified${verification.anchored ? " and matches the on-chain root." : "; the latest root is not anchored yet."}` : "The snapshot did not pass integrity verification."}</p>}
            </div>
          )}

          {memories.length === 0 ? (
            <section className="surface empty-state"><span className="empty-state-icon"><Brain weight="fill" /></span><h2>No saved memories</h2><p>Useful preferences, project context, and decisions will appear here after a conversation.</p></section>
          ) : filtered.length === 0 ? (
            <section className="surface empty-state compact-empty"><MagnifyingGlass weight="bold" /><h2>No matching memory</h2><p>Try a different word or type filter.</p></section>
          ) : (
            <div className="memory-groups">
              {memoryTypes.map((type) => grouped[type]?.length ? (
                <section className="memory-group" key={type}>
                  <header><div><span className="memory-type-mark"><Brain weight="fill" /></span><h2>{typeLabels[type]}</h2></div><span>{grouped[type]?.length}</span></header>
                  <div className="memory-list">
                    {grouped[type]?.map((memory) => (
                      <article className="memory-row" key={memory.id}>
                        <div className="memory-content"><p>{memory.content}</p><div><span>Importance {Math.round(memory.importance * 100)}%</span><span>Confidence {Math.round(memory.confidence * 100)}%</span><span>Used {memory.usageCount}×</span></div></div>
                        <div className="memory-actions"><button className="icon-button" aria-label="Edit memory" onClick={() => setEditing(memory)}><PencilSimple weight="bold" /></button><button className="icon-button danger-icon" aria-label={`Delete ${memory.content}`} onClick={() => setDeleteTarget(memory)} disabled={working}><Trash weight="bold" /></button></div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null)}
            </div>
          )}
        </>
      )}

      {editing && (
        <div className="modal-backdrop" role="presentation">
          <form className="memory-modal" role="dialog" aria-modal="true" aria-labelledby="edit-memory-title" onSubmit={(event) => void saveMemory(event)}>
            <header><div><p className="eyebrow">User-controlled memory</p><h2 id="edit-memory-title">Edit memory</h2></div><button className="icon-button" type="button" aria-label="Close editor" onClick={() => setEditing(null)}><X weight="bold" /></button></header>
            <div className="field"><label htmlFor="memory-content">Memory</label><textarea className="textarea" id="memory-content" name="content" defaultValue={editing.content} minLength={3} maxLength={500} required /></div>
            <div className="modal-grid"><div className="field"><label htmlFor="memory-type">Type</label><select className="select" id="memory-type" name="type" defaultValue={editing.type}>{memoryTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></div><div className="field"><label htmlFor="memory-importance">Importance</label><input className="input" id="memory-importance" name="importance" type="number" min="0" max="1" step="0.01" defaultValue={editing.importance} /></div></div>
            <div className="modal-actions"><button className="button" type="button" onClick={() => setEditing(null)}>Cancel</button><button className="button button-primary" type="submit" disabled={working}><FloppyDisk weight="bold" /> {working ? "Saving…" : "Save memory"}</button></div>
          </form>
        </div>
      )}

      {composerOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="memory-modal" role="dialog" aria-modal="true" aria-labelledby="add-memory-title" onSubmit={(event) => void createMemories(event)}>
            <header><div><p className="eyebrow">User-controlled memory</p><h2 id="add-memory-title">Add memory</h2></div><button className="icon-button" type="button" aria-label="Close memory form" onClick={() => setComposerOpen(false)}><X weight="bold" /></button></header>
            <div className="field"><label htmlFor="new-memory-content">Memory</label><textarea className="textarea" id="new-memory-content" name="content" minLength={3} maxLength={500} placeholder="e.g. Prefers concise release notes" required /></div>
            <div className="modal-grid"><div className="field"><label htmlFor="new-memory-type">Type</label><select className="select" id="new-memory-type" name="type" defaultValue="preference">{memoryTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></div><div className="field"><label htmlFor="new-memory-importance">Importance</label><input className="input" id="new-memory-importance" name="importance" type="number" min="0" max="1" step="0.01" defaultValue="0.65" /></div></div>
            <div className="modal-actions"><button className="button" type="button" onClick={() => setComposerOpen(false)}>Cancel</button><button className="button button-primary" type="submit" disabled={working}><FloppyDisk weight="bold" /> {working ? "Adding…" : "Add memory"}</button></div>
          </form>
        </div>
      )}

      {importPreview && (
        <div className="modal-backdrop" role="presentation">
          <div className="memory-modal" role="dialog" aria-modal="true" aria-labelledby="import-memory-title">
            <header><div><p className="eyebrow">Review before writing</p><h2 id="import-memory-title">Import memories</h2></div><button className="icon-button" type="button" aria-label="Close import preview" onClick={() => setImportPreview(null)}><X weight="bold" /></button></header>
            <p className="modal-lede">{importPreview.memories.length} valid memories are ready to encrypt into this vault{importPreview.skipped ? `; ${importPreview.skipped} rows will be skipped.` : "."}</p>
            <ul className="import-preview-list">{importPreview.memories.slice(0, 5).map((memory, index) => <li key={`${memory.content}-${index}`}><span>{typeLabels[memory.type]}</span>{memory.content}</li>)}</ul>
            {importPreview.memories.length > 5 && <p className="modal-hint">Showing the first 5 memories.</p>}
            <div className="modal-actions"><button className="button" type="button" onClick={() => setImportPreview(null)}>Cancel</button><button className="button button-primary" type="button" onClick={() => void importMemories()} disabled={working}><UploadSimple weight="bold" /> {working ? "Importing…" : "Encrypt and import"}</button></div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-memory-title">
            <WarningCircle weight="fill" />
            <h2 id="delete-memory-title">Delete this memory?</h2>
            <p>This removes it from future model context and writes a new encrypted root. The action cannot be undone.</p>
            <div className="modal-actions"><button className="button" type="button" onClick={() => setDeleteTarget(null)}>Keep memory</button><button className="button button-danger" type="button" onClick={() => void removeMemory()} disabled={working}>{working ? "Deleting…" : "Delete memory"}</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
