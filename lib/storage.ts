import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ethers } from "ethers";
import { keccak256, toBytes } from "viem";
import { ApiError } from "@/lib/api";
import {
  resolvedStorageBackend,
  serverConfig,
} from "@/lib/server-config";
import type { SnapshotResult, StorageBackend } from "@/lib/types";

type StoredSnapshot = SnapshotResult & { locator: string };

const localVaultDirectory = resolve(process.cwd(), ".data", "vaults");

async function storageOperation<T>(operation: Promise<T>, action: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new ApiError(
                `0G Storage ${action} did not finish in time. Try again shortly.`,
                504,
                "STORAGE_TIMEOUT",
              ),
            ),
          serverConfig.storageTimeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function storeLocally(payload: string): Promise<StoredSnapshot> {
  await mkdir(localVaultDirectory, { recursive: true });
  const rootHash = keccak256(toBytes(payload));
  const locator = resolve(localVaultDirectory, `${rootHash.slice(2)}.json`);
  await writeFile(locator, payload, { encoding: "utf8", flag: "wx" }).catch(
    async (error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    },
  );
  return {
    rootHash,
    transactionHash: null,
    backend: "local",
    snapshotId: crypto.randomUUID(),
    locator,
  };
}

async function storeOn0G(payload: string): Promise<StoredSnapshot> {
  if (!serverConfig.storagePrivateKey) {
    throw new ApiError(
      "0G Storage is required but OG_STORAGE_PRIVATE_KEY is not configured.",
      503,
      "STORAGE_NOT_CONFIGURED",
    );
  }

  const { Indexer, MemData } = await import(
    "@0gfoundation/0g-storage-ts-sdk"
  );
  const provider = new ethers.JsonRpcProvider(serverConfig.rpcUrl);
  const signer = new ethers.Wallet(serverConfig.storagePrivateKey, provider);
  const indexer = new Indexer(serverConfig.storageIndexerUrl);
  const data = new MemData(new TextEncoder().encode(payload));
  const [, treeError] = await data.merkleTree();
  if (treeError) {
    throw new ApiError(`0G Storage could not hash the vault: ${treeError}`, 502);
  }

  const [transaction, uploadError] = await storageOperation(
    indexer.upload(data, serverConfig.rpcUrl, signer),
    "upload",
  );
  if (uploadError || !transaction) {
    throw new ApiError(
      `0G Storage upload failed${uploadError ? `: ${uploadError}` : "."}`,
      502,
      "STORAGE_UPLOAD_FAILED",
    );
  }
  if (!("rootHash" in transaction)) {
    throw new ApiError(
      "The vault snapshot was unexpectedly fragmented by 0G Storage.",
      502,
      "STORAGE_FRAGMENTED",
    );
  }

  return {
    rootHash: transaction.rootHash,
    transactionHash: transaction.txHash,
    backend: "og",
    snapshotId: crypto.randomUUID(),
    locator: transaction.rootHash,
  };
}

export async function storeSnapshot(payload: string): Promise<StoredSnapshot> {
  const backend = resolvedStorageBackend();
  if (backend === "local") return storeLocally(payload);

  try {
    return await storeOn0G(payload);
  } catch (error) {
    if (serverConfig.storageMode === "auto") {
      console.error("0G Storage unavailable; using honest local fallback", error);
      return storeLocally(payload);
    }
    throw error;
  }
}

export async function verifySnapshot(
  rootHash: string,
  locator: string,
  backend: StorageBackend,
) {
  if (backend === "local") {
    const payload = await readFile(locator, "utf8");
    return keccak256(toBytes(payload)).toLowerCase() === rootHash.toLowerCase();
  }

  const { Indexer } = await import("@0gfoundation/0g-storage-ts-sdk");
  const indexer = new Indexer(serverConfig.storageIndexerUrl);
  const targetDirectory = resolve(process.cwd(), ".data", "verification");
  await mkdir(targetDirectory, { recursive: true });
  const outputPath = resolve(targetDirectory, `${crypto.randomUUID()}.snapshot`);
  try {
    const error = await storageOperation(
      indexer.download(rootHash, outputPath, true),
      "verification",
    );
    return error === null;
  } finally {
    await unlink(outputPath).catch(() => undefined);
  }
}
