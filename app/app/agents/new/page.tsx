"use client";

import { ArrowLeft, Check, Fingerprint } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { keccak256, parseEventLogs, stringToHex, toBytes } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import { apiFetch } from "@/lib/client";
import {
  identityRegistryAbi,
  PURPOSE_HASH_KEY,
  VAULT_ID_KEY,
} from "@/lib/contracts";
import { publicConfig } from "@/lib/network";

function dataUri(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:application/json;base64,${btoa(binary)}`;
}

export default function CreateAgentPage() {
  const router = useRouter();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [personality, setPersonality] = useState("");
  const [rememberConversations, setRememberConversations] = useState(true);
  const [rememberPreferences, setRememberPreferences] = useState(true);
  const [rememberProjects, setRememberProjects] = useState(true);
  const [stage, setStage] = useState<"idle" | "wallet" | "chain" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!publicClient) return;
    setError(null);
    const id = crypto.randomUUID();
    const agentUri = dataUri({
      type: "AgentVault Agent Card",
      version: "1.0",
      name: name.trim(),
      description: purpose.trim(),
      capabilities: ["portable-memory", "encrypted-context"],
      agentVault: {
        vaultId: id,
        network: `eip155:${publicConfig.chainId}`,
        memoryRootKey: "agentvault.memoryRoot",
      },
    });

    try {
      setStage("wallet");
      const transactionHash = await writeContractAsync({
        address: publicConfig.identityRegistry,
        abi: identityRegistryAbi,
        functionName: "register",
        args: [
          agentUri,
          [
            { metadataKey: VAULT_ID_KEY, metadataValue: stringToHex(id) },
            {
              metadataKey: PURPOSE_HASH_KEY,
              metadataValue: keccak256(toBytes(purpose.trim())),
            },
          ],
        ],
      });
      setStage("chain");
      const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
      const eventLog = parseEventLogs({
        abi: identityRegistryAbi,
        logs: receipt.logs,
        eventName: "Registered",
      })[0];
      if (!eventLog) throw new Error("The registry did not emit an Agent ID.");
      setStage("saving");
      await apiFetch<{ id: string }>("/api/agents", {
        method: "POST",
        body: JSON.stringify({
          id,
          agentId: eventLog.args.agentId.toString(),
          agentUri,
          name,
          purpose,
          personality,
          rememberConversations,
          rememberPreferences,
          rememberProjects,
          transactionHash,
        }),
      });
      router.push(`/app/agents/${id}/chat`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Agent creation failed.");
      setStage("idle");
    }
  }

  const working = stage !== "idle";
  const buttonLabel = {
    idle: "Create on 0G",
    wallet: "Confirm in wallet…",
    chain: "Minting Agent ID…",
    saving: "Opening vault…",
  }[stage];

  return (
    <main className="workspace-page create-page">
      <Link className="back-link" href="/app"><ArrowLeft weight="bold" /> Back to agents</Link>
      <div className="create-layout">
        <section className="create-intro">
          <span className="create-icon"><Fingerprint weight="fill" /></span>
          <p className="eyebrow">New on-chain identity</p>
          <h1>Create an agent.</h1>
          <p>
            Define how it should help and what it may retain. Your wallet will mint its
            ERC-8004 identity on 0G Galileo.
          </p>
          <div className="create-assurance">
            <span><Check weight="bold" /> Owned by your wallet</span>
            <span><Check weight="bold" /> Private memory encryption</span>
            <span><Check weight="bold" /> Inspectable memory controls</span>
          </div>
        </section>

        <form className="surface agent-form" onSubmit={(event) => void submit(event)}>
          <div className="field">
            <label htmlFor="name">Agent name</label>
            <input className="input" id="name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={48} placeholder="Atlas" required />
            <small>A short name you will recognize.</small>
          </div>
          <div className="field">
            <label htmlFor="purpose">Purpose</label>
            <textarea className="textarea" id="purpose" value={purpose} onChange={(event) => setPurpose(event.target.value)} minLength={8} maxLength={240} placeholder="A coding partner for architecture, TypeScript, and product decisions." required />
          </div>
          <div className="field">
            <label htmlFor="personality">Communication style</label>
            <textarea className="textarea" id="personality" value={personality} onChange={(event) => setPersonality(event.target.value)} minLength={8} maxLength={280} placeholder="Concise, technical, candid about tradeoffs, and practical." required />
          </div>
          <fieldset className="memory-options">
            <legend>Memory permissions</legend>
            <label className="checkbox-row">
              <input type="checkbox" checked={rememberConversations} onChange={(event) => setRememberConversations(event.target.checked)} />
              <div><strong>Conversation history</strong><span>Keep encrypted messages across sessions.</span></div>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={rememberPreferences} onChange={(event) => setRememberPreferences(event.target.checked)} />
              <div><strong>Preferences and tools</strong><span>Remember stable ways you like to work.</span></div>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={rememberProjects} onChange={(event) => setRememberProjects(event.target.checked)} />
              <div><strong>Projects and decisions</strong><span>Keep durable project context.</span></div>
            </label>
          </fieldset>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary button-large form-submit" disabled={working} type="submit">
            <Fingerprint weight="bold" /> {buttonLabel}
          </button>
          <p className="gas-note">This writes a real registration transaction and requires Galileo testnet 0G.</p>
        </form>
      </div>
    </main>
  );
}
