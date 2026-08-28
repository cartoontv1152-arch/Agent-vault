import { NextResponse } from "next/server";
import { decodeEventLog, isAddressEqual } from "viem";
import { z } from "zod";
import { apiError, ApiError, assertSameOrigin, readJson } from "@/lib/api";
import { publicClient } from "@/lib/chain";
import { identityRegistryAbi, MEMORY_ROOT_KEY } from "@/lib/contracts";
import { execute } from "@/lib/db";
import { publicConfig } from "@/lib/network";
import { findOwnedAgent } from "@/lib/repository";
import { assertRateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session";

const inputSchema = z.object({
  rootHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  transactionHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    await assertRateLimit(session.address, "root_anchor", 20, 60_000);
    const { id } = await context.params;
    const input = inputSchema.parse(await readJson(request));
    const agent = await findOwnedAgent(id, session.address);
    if (agent.latest_root?.toLowerCase() !== input.rootHash.toLowerCase()) {
      throw new ApiError("Only the latest encrypted vault root can be anchored.", 409);
    }

    const [receipt, owner] = await Promise.all([
      publicClient.getTransactionReceipt({
        hash: input.transactionHash as `0x${string}`,
      }),
      publicClient.readContract({
        address: publicConfig.identityRegistry,
        abi: identityRegistryAbi,
        functionName: "ownerOf",
        args: [BigInt(agent.agent_id)],
      }),
    ]);

    if (
      receipt.status !== "success" ||
      !receipt.to ||
      !isAddressEqual(receipt.to, publicConfig.identityRegistry) ||
      owner.toLowerCase() !== session.address.toLowerCase()
    ) {
      throw new ApiError("The memory anchor transaction is invalid.", 422);
    }

    const matchingEvent = receipt.logs.some((log) => {
      try {
        const decoded = decodeEventLog({
          abi: identityRegistryAbi,
          data: log.data,
          topics: log.topics,
          eventName: "MetadataSet",
        });
        return (
          decoded.args.agentId.toString() === agent.agent_id &&
          decoded.args.metadataKey === MEMORY_ROOT_KEY &&
          decoded.args.metadataValue.toLowerCase() === input.rootHash.toLowerCase()
        );
      } catch {
        return false;
      }
    });
    if (!matchingEvent) {
      throw new ApiError("The transaction does not anchor this memory root.", 422);
    }

    await execute(
      `UPDATE agents SET anchored_root = ?, anchor_tx_hash = ?, updated_at = ?
       WHERE id = ?`,
      [input.rootHash, input.transactionHash, new Date().toISOString(), agent.id],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
