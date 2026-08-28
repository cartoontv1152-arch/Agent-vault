import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, ApiError, assertSameOrigin, readJson } from "@/lib/api";
import { encryptText, validateVaultKey } from "@/lib/crypto";
import { execute, queryOne } from "@/lib/db";
import { findOwnedAgent, type MemoryRow } from "@/lib/repository";
import { requireSession } from "@/lib/session";
import { assertRateLimit } from "@/lib/rate-limit";
import { persistVaultSnapshot } from "@/lib/snapshots";
import { memoryTypes } from "@/lib/types";

const updateSchema = z.object({
  vaultKey: z.string(),
  content: z.string().trim().min(3).max(500),
  type: z.enum(memoryTypes),
  importance: z.number().min(0).max(1),
});

const deleteSchema = z.object({ vaultKey: z.string() });

async function requireMemory(agentId: string, memoryId: string) {
  const memory = await queryOne<MemoryRow>(
    "SELECT * FROM memories WHERE id = ? AND agent_ref = ? AND deleted_at IS NULL",
    [memoryId, agentId],
  );
  if (!memory) throw new ApiError("Memory not found.", 404, "NOT_FOUND");
  return memory;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; memoryId: string }> },
) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    await assertRateLimit(session.address, "memory_write", 60, 60_000);
    const { id, memoryId } = await context.params;
    const input = updateSchema.parse(await readJson(request));
    const vaultKey = input.vaultKey;
    validateVaultKey(vaultKey);
    const agent = await findOwnedAgent(id, session.address);
    await requireMemory(agent.id, memoryId);
    const now = new Date().toISOString();
    await execute(
      `UPDATE memories SET type = ?, cipher = ?, importance = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.type,
        encryptText(input.content, vaultKey, agent.id),
        input.importance,
        now,
        memoryId,
      ],
    );
    const snapshot = await persistVaultSnapshot(agent);
    return NextResponse.json({
      success: true,
      snapshot: {
        rootHash: snapshot.rootHash,
        transactionHash: snapshot.transactionHash,
        backend: snapshot.backend,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; memoryId: string }> },
) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    await assertRateLimit(session.address, "memory_write", 60, 60_000);
    const { id, memoryId } = await context.params;
    const input = deleteSchema.parse(await readJson(request));
    const vaultKey = input.vaultKey;
    validateVaultKey(vaultKey);
    const agent = await findOwnedAgent(id, session.address);
    await requireMemory(agent.id, memoryId);
    const now = new Date().toISOString();
    await execute(
      "UPDATE memories SET deleted_at = ?, updated_at = ? WHERE id = ?",
      [now, now, memoryId],
    );
    const snapshot = await persistVaultSnapshot(agent);
    return NextResponse.json({
      success: true,
      snapshot: {
        rootHash: snapshot.rootHash,
        transactionHash: snapshot.transactionHash,
        backend: snapshot.backend,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
