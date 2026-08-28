import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, assertSameOrigin, readJson } from "@/lib/api";
import { answerWithMemory, extractMemories } from "@/lib/compute";
import { encryptText, validateVaultKey } from "@/lib/crypto";
import { transaction, type DatabaseStatement } from "@/lib/db";
import { normalizeMemory, rankMemories } from "@/lib/memory-engine";
import {
  decryptedMemories,
  decryptedMessages,
  findOwnedAgent,
} from "@/lib/repository";
import { assertRateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session";
import { persistVaultSnapshot } from "@/lib/snapshots";

export const maxDuration = 300;

const inputSchema = z.object({
  content: z.string().trim().min(1).max(8_000),
  vaultKey: z.string(),
  model: z.string().trim().min(1).max(200).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    await assertRateLimit(session.address, "chat", 30, 60_000);
    const { id } = await context.params;
    const input = inputSchema.parse(await readJson(request));
    const vaultKey = input.vaultKey;
    validateVaultKey(vaultKey);
    const agent = await findOwnedAgent(id, session.address);
    const allMemories = await decryptedMemories(agent.id, vaultKey);
    const relevant = rankMemories(input.content, allMemories);
    const history = await decryptedMessages(agent.id, vaultKey, 10);

    const answer = await answerWithMemory({
      name: agent.name,
      purpose: agent.purpose,
      personality: agent.personality,
      prompt: input.content,
      memories: relevant.map((memory) => memory.content),
      recentMessages: history.map(({ role, content }) => ({ role, content })),
      model: input.model,
    });

    let candidates: Awaited<ReturnType<typeof extractMemories>> = [];
    let extractionWarning: string | null = null;
    if (agent.remember_preferences || agent.remember_projects) {
      try {
        candidates = await extractMemories(input.content, answer.content, answer.model);
      } catch (error) {
        console.error("Memory extraction failed", error);
        extractionWarning =
          "The reply succeeded, but memory extraction could not be completed.";
      }
    }

    candidates = candidates.filter((memory) => {
      if (
        memory.type === "preference" ||
        memory.type === "technology" ||
        memory.type === "fact"
      ) {
        return Boolean(agent.remember_preferences);
      }
      return Boolean(agent.remember_projects);
    });

    const existing = new Set(
      allMemories.map((memory) => normalizeMemory(memory.content)),
    );
    const uniqueCandidates = candidates.filter((memory) => {
      const normalized = normalizeMemory(memory.content);
      if (!normalized || existing.has(normalized)) return false;
      existing.add(normalized);
      return true;
    });

    const now = new Date().toISOString();
    const userMessageId = crypto.randomUUID();
    const assistantMessageId = crypto.randomUUID();
    const savedMemoryIds: string[] = [];
    const statements: DatabaseStatement[] = [];

    if (agent.remember_conversations) {
      const insertMessageSql = `INSERT INTO messages
        (id, agent_ref, role, cipher, model, compute_verified, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;
      statements.push(
        {
          sql: insertMessageSql,
          params: [
          userMessageId,
          agent.id,
          "user",
          encryptText(input.content, vaultKey, agent.id),
          answer.model,
          0,
          now,
          ],
        },
        {
          sql: insertMessageSql,
          params: [
            assistantMessageId,
            agent.id,
            "assistant",
            encryptText(answer.content, vaultKey, agent.id),
            answer.model,
            0,
            now,
          ],
        },
      );
    }

    for (const memory of uniqueCandidates) {
      const memoryId = crypto.randomUUID();
      statements.push({
        sql: `INSERT INTO memories
              (id, agent_ref, type, cipher, importance, confidence,
               source_message_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          memoryId,
          agent.id,
          memory.type,
          encryptText(memory.content, vaultKey, agent.id),
          memory.importance,
          memory.confidence,
          agent.remember_conversations ? userMessageId : null,
          now,
          now,
        ],
      });
      savedMemoryIds.push(memoryId);
    }

    if (relevant.length) {
      const placeholders = relevant.map(() => "?").join(",");
      statements.push({
        sql: `UPDATE memories SET usage_count = usage_count + 1, last_accessed = ?
              WHERE id IN (${placeholders})`,
        params: [now, ...relevant.map((memory) => memory.id)],
      });
    }
    await transaction(statements);

    const changed = agent.remember_conversations || savedMemoryIds.length > 0;
    const snapshot = changed ? await persistVaultSnapshot(agent) : null;

    return NextResponse.json({
      message: {
        id: assistantMessageId,
        role: "assistant",
        content: answer.content,
        model: answer.model,
        computeVerified: false,
        createdAt: now,
      },
      userMessageId,
      memory: {
        saved: uniqueCandidates.map((memory, index) => ({
          id: savedMemoryIds[index],
          ...memory,
        })),
        used: relevant.map((memory) => memory.id),
        warning: extractionWarning,
      },
      snapshot: snapshot
        ? {
            rootHash: snapshot.rootHash,
            transactionHash: snapshot.transactionHash,
            backend: snapshot.backend,
          }
        : null,
    });
  } catch (error) {
    return apiError(error);
  }
}
