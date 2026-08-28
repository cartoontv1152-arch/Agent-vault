import { NextResponse } from "next/server";
import { apiError, ApiError, assertSameOrigin } from "@/lib/api";
import { execute, queryOne } from "@/lib/db";
import { findOwnedAgent } from "@/lib/repository";
import { requireSession } from "@/lib/session";
import { assertRateLimit } from "@/lib/rate-limit";
import { verifySnapshot } from "@/lib/storage";
import type { StorageBackend } from "@/lib/types";

type SnapshotRow = {
  id: string;
  root_hash: string;
  backend: StorageBackend;
  locator: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    await assertRateLimit(session.address, "snapshot_verify", 30, 60_000);
    const { id } = await context.params;
    const agent = await findOwnedAgent(id, session.address);
    const snapshot = await queryOne<SnapshotRow>(
      "SELECT id, root_hash, backend, locator FROM snapshots WHERE agent_ref = ? ORDER BY created_at DESC LIMIT 1",
      [agent.id],
    );
    if (!snapshot) throw new ApiError("This agent has no memory snapshot yet.", 404);

    const verified = await verifySnapshot(
      snapshot.root_hash,
      snapshot.locator,
      snapshot.backend,
    );
    if (verified) {
      await execute(
        "UPDATE snapshots SET verified_at = ? WHERE id = ?",
        [new Date().toISOString(), snapshot.id],
      );
    }
    return NextResponse.json({
      verified,
      rootHash: snapshot.root_hash,
      backend: snapshot.backend,
      anchored: agent.anchored_root === snapshot.root_hash,
    });
  } catch (error) {
    return apiError(error);
  }
}
