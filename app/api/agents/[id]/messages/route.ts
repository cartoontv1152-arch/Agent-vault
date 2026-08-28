import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, assertSameOrigin, readJson } from "@/lib/api";
import { validateVaultKey } from "@/lib/crypto";
import { decryptedMessages, findOwnedAgent } from "@/lib/repository";
import { assertRateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session";

const inputSchema = z.object({ vaultKey: z.string() });

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
    return NextResponse.json({
      messages: await decryptedMessages(agent.id, vaultKey),
    });
  } catch (error) {
    return apiError(error);
  }
}
