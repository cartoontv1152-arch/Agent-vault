import "server-only";

import { transaction, type AgentRow } from "@/lib/db";
import { encryptedVaultPayload } from "@/lib/repository";
import { storeSnapshot } from "@/lib/storage";

export async function persistVaultSnapshot(agent: AgentRow) {
  const stored = await storeSnapshot(await encryptedVaultPayload(agent));
  const now = new Date().toISOString();

  await transaction([
    {
      sql: `INSERT INTO snapshots
            (id, agent_ref, root_hash, transaction_hash, backend, locator, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params: [
        stored.snapshotId,
        agent.id,
        stored.rootHash,
        stored.transactionHash,
        stored.backend,
        stored.locator,
        now,
      ],
    },
    {
      sql: `UPDATE agents SET latest_root = ?, storage_backend = ?, storage_tx_hash = ?,
            updated_at = ? WHERE id = ?`,
      params: [
        stored.rootHash,
        stored.backend,
        stored.transactionHash,
        now,
        agent.id,
      ],
    },
  ]);

  return stored;
}
