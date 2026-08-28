import "server-only";

import { ApiError } from "@/lib/api";
import { decryptText } from "@/lib/crypto";
import {
  queryAll,
  queryOne,
  serializeAgent,
  type AgentRow,
} from "@/lib/db";
import { serverConfig } from "@/lib/server-config";
import type { ChatMessage, Memory, MemoryType } from "@/lib/types";

export type MemoryRow = {
  id: string;
  agent_ref: string;
  type: MemoryType;
  cipher: string;
  importance: number;
  confidence: number;
  source_message_id: string | null;
  usage_count: number;
  last_accessed: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type MessageRow = {
  id: string;
  agent_ref: string;
  role: "user" | "assistant";
  cipher: string;
  model: string | null;
  compute_verified: number;
  created_at: string;
};

export async function findOwnedAgent(id: string, address: string) {
  const row = await queryOne<AgentRow>(
    "SELECT * FROM agents WHERE id = ? AND owner = ?",
    [id, address.toLowerCase()],
  );
  if (!row) throw new ApiError("Agent not found for this wallet.", 404, "NOT_FOUND");
  return row;
}

export async function listOwnedAgents(address: string) {
  const rows = await queryAll<AgentRow>(
    `SELECT a.*, COUNT(m.id) AS memory_count
     FROM agents a
     LEFT JOIN memories m ON m.agent_ref = a.id AND m.deleted_at IS NULL
     WHERE a.owner = ?
     GROUP BY a.id
     ORDER BY a.created_at DESC`,
    [address.toLowerCase()],
  );
  return rows.map(serializeAgent);
}

export async function decryptedMemories(
  agentId: string,
  vaultKey: `0x${string}`,
): Promise<Memory[]> {
  const rows = await queryAll<MemoryRow>(
    "SELECT * FROM memories WHERE agent_ref = ? AND deleted_at IS NULL ORDER BY created_at DESC",
    [agentId],
  );

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    content: decryptText(row.cipher, vaultKey, agentId),
    importance: row.importance,
    confidence: row.confidence,
    usageCount: row.usage_count,
    lastAccessed: row.last_accessed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function decryptedMessages(
  agentId: string,
  vaultKey: `0x${string}`,
  limit?: number,
): Promise<ChatMessage[]> {
  const rows = limit
    ? await queryAll<MessageRow>(
        `SELECT * FROM (
           SELECT * FROM messages WHERE agent_ref = ?
           ORDER BY created_at DESC LIMIT ?
         ) recent ORDER BY created_at ASC`,
        [agentId, limit],
      )
    : await queryAll<MessageRow>(
        "SELECT * FROM messages WHERE agent_ref = ? ORDER BY created_at ASC",
        [agentId],
      );
  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    content: decryptText(row.cipher, vaultKey, agentId),
    model: row.model,
    computeVerified: Boolean(row.compute_verified),
    createdAt: row.created_at,
  }));
}

export async function encryptedVaultPayload(agent: AgentRow) {
  const [memories, messages] = await Promise.all([
    queryAll(
      `SELECT id, type, cipher, importance, confidence, usage_count, last_accessed,
              created_at, updated_at
       FROM memories WHERE agent_ref = ? AND deleted_at IS NULL ORDER BY created_at`,
      [agent.id],
    ),
    queryAll(
      `SELECT id, role, cipher, model, compute_verified, created_at
       FROM messages WHERE agent_ref = ? ORDER BY created_at`,
      [agent.id],
    ),
  ]);

  return JSON.stringify({
    format: "agentvault/encrypted-vault@1",
    agent: {
      registry: `eip155:${serverConfig.chainId}:${serverConfig.identityRegistry}`,
      agentId: agent.agent_id,
      vaultId: agent.id,
      owner: agent.owner,
    },
    encryption: "aes-256-gcm",
    memories,
    messages,
    createdAt: new Date().toISOString(),
  });
}
