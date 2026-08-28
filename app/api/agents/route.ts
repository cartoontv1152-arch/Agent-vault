import { NextResponse } from "next/server";
import { decodeEventLog, isAddressEqual } from "viem";
import { z } from "zod";
import { apiError, ApiError, assertSameOrigin, readJson } from "@/lib/api";
import { publicClient } from "@/lib/chain";
import { identityRegistryAbi } from "@/lib/contracts";
import { execute, queryOne } from "@/lib/db";
import { publicConfig } from "@/lib/network";
import { listOwnedAgents } from "@/lib/repository";
import { assertRateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session";

const createAgentSchema = z.object({
  id: z.uuid(),
  agentId: z.string().regex(/^\d+$/),
  agentUri: z.string().min(1).max(12_000),
  name: z.string().trim().min(2).max(48),
  purpose: z.string().trim().min(8).max(240),
  personality: z.string().trim().min(8).max(280),
  rememberConversations: z.boolean(),
  rememberPreferences: z.boolean(),
  rememberProjects: z.boolean(),
  transactionHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json({ agents: await listOwnedAgents(session.address) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    await assertRateLimit(session.address, "agent_create", 5, 60 * 60_000);
    const input = createAgentSchema.parse(await readJson(request));
    const receipt = await publicClient.getTransactionReceipt({
      hash: input.transactionHash as `0x${string}`,
    });
    if (
      receipt.status !== "success" ||
      !receipt.to ||
      !isAddressEqual(receipt.to, publicConfig.identityRegistry)
    ) {
      throw new ApiError("The identity registration transaction is invalid.", 422);
    }

    const registration = receipt.logs.flatMap((log) => {
      try {
        const decoded = decodeEventLog({
          abi: identityRegistryAbi,
          data: log.data,
          topics: log.topics,
          eventName: "Registered",
        });
        return [decoded.args];
      } catch {
        return [];
      }
    })[0];

    if (
      !registration ||
      registration.agentId.toString() !== input.agentId ||
      registration.agentURI !== input.agentUri ||
      registration.owner.toLowerCase() !== session.address.toLowerCase()
    ) {
      throw new ApiError(
        "The registered Agent ID does not match this wallet or agent card.",
        422,
      );
    }

    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM agents WHERE registration_tx_hash = ?",
      [input.transactionHash],
    );
    if (existing) {
      return NextResponse.json({ id: existing.id }, { status: 200 });
    }

    const now = new Date().toISOString();
    await execute(
      `INSERT INTO agents
       (id, owner, agent_id, name, purpose, personality,
        remember_conversations, remember_preferences, remember_projects,
        registration_tx_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        session.address.toLowerCase(),
        input.agentId,
        input.name,
        input.purpose,
        input.personality,
        Number(input.rememberConversations),
        Number(input.rememberPreferences),
        Number(input.rememberProjects),
        input.transactionHash,
        now,
        now,
      ],
    );

    return NextResponse.json({ id: input.id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
