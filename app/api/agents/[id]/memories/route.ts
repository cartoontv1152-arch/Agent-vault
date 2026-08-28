import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, assertSameOrigin, readJson } from "@/lib/api";
import { encryptText, validateVaultKey } from "@/lib/crypto";
import { transaction, type DatabaseStatement } from "@/lib/db";
import { memoryTypes } from "@/lib/types";
import { decryptedMemories, findOwnedAgent } from "@/lib/repository";
import { assertRateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session";
import { persistVaultSnapshot } from "@/lib/snapshots";
import { normalizeMemory } from "@/lib/memory-engine";

const inputSchema = z.object({
  vaultKey: z.string(),
  query: z.string().trim().max(200).optional(),
  type: z.enum(memoryTypes).optional(),
});

const createSchema = z.object({
  vaultKey: z.string(),
  memories: z
    .array(
      z.object({
        content: z.string().trim().min(3).max(500),
        type: z.enum(memoryTypes),
        importance: z.number().min(0).max(1).default(0.65),
      }),
    )
    .min(1)
    .max(100),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    await assertRateLimit(session.address, "private_read", 120, 60_000);
    const { id } = await context.params;
    const input = inputSchema.parse(await readJson(request));
    const vaultKey = input.vaultKey;
    validateVaultKey(vaultKey);
    const agent = await findOwnedAgent(id, session.address);
    const query = input.query?.toLocaleLowerCase();
    const memories = (await decryptedMemories(agent.id, vaultKey)).filter(
      (memory) =>
        (!input.type || memory.type === input.type) &&
        (!query || memory.content.toLocaleLowerCase().includes(query)),
    );
    return NextResponse.json({ memories });
  } catch (error) {
    return apiError(error);
  }
}

/** Create user-authored memories or import a previously exported memory set. */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    await assertRateLimit(session.address, "memory_write", 30, 60_000);
    const { id } = await context.params;
    const input = createSchema.parse(await readJson(request));
    validateVaultKey(input.vaultKey);
    const agent = await findOwnedAgent(id, session.address);
    const existing = new Set(
      (await decryptedMemories(agent.id, input.vaultKey)).map((memory) =>
        normalizeMemory(memory.content),
      ),
    );
    const statements: DatabaseStatement[] = [];
    const created: Array<{ id: string; type: (typeof memoryTypes)[number]; content: string; importance: number }> = [];
    const now = new Date().toISOString();
    for (const memory of input.memories) {
      const content = memory.content.trim();
      const normalized = normalizeMemory(content);
      if (!normalized || existing.has(normalized)) continue;
      existing.add(normalized);
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
          encryptText(content, input.vaultKey, agent.id),
          memory.importance,
          1,
          null,
          now,
          now,
        ],
      });
      created.push({ id: memoryId, type: memory.type, content, importance: memory.importance });
    }
    await transaction(statements);
    const snapshot = statements.length ? await persistVaultSnapshot(agent) : null;
    return NextResponse.json(
      {
        created,
        skipped: input.memories.length - created.length,
        snapshot: snapshot
          ? {
              rootHash: snapshot.rootHash,
              transactionHash: snapshot.transactionHash,
              backend: snapshot.backend,
            }
          : null,
      },
      { status: statements.length ? 201 : 200 },
    );
  } catch (error) {
    return apiError(error);
  }
}
