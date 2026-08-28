import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { publicClient } from "@/lib/chain";
import { databaseHealth } from "@/lib/db";
import { publicConfig } from "@/lib/network";
import {
  resolvedStorageBackend,
  serverConfig,
} from "@/lib/server-config";

export async function GET() {
  try {
    const [chainId, registryCode, database] = await Promise.all([
      publicClient.getChainId(),
      publicClient.getCode({ address: publicConfig.identityRegistry }),
      databaseHealth(),
    ]);
    return NextResponse.json({
      chain: {
        connected: chainId === publicConfig.chainId,
        chainId,
        registryAvailable: Boolean(registryCode && registryCode !== "0x"),
      },
      storage: {
        backend: resolvedStorageBackend(),
        configured: Boolean(serverConfig.storagePrivateKey),
        required: serverConfig.storageMode === "og",
      },
      compute: {
        configured: Boolean(serverConfig.computeApiKey),
      },
      persistence: {
        backend: database,
        durable: database === "postgres" || !process.env.VERCEL,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
