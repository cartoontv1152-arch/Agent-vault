import "server-only";

import { publicConfig } from "@/lib/network";

export type StorageMode = "auto" | "og" | "local";

function storageMode(value: string | undefined): StorageMode {
  if (!value) return "auto";
  if (value === "og" || value === "local") return value;
  if (value === "auto") return value;
  throw new Error("STORAGE_MODE must be auto, og, or local.");
}

function privateKey(value: string | undefined) {
  if (!value) return "";
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("OG_STORAGE_PRIVATE_KEY must be a 32-byte hex private key.");
  }
  return normalized;
}

function serviceUrl(name: string, value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${name} must use http or https.`);
  }
  return url.toString().replace(/\/$/, "");
}

function positiveInteger(name: string, value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

export const serverConfig = {
  ...publicConfig,
  sessionSecret: process.env.SESSION_SECRET || "",
  storageMode: storageMode(process.env.STORAGE_MODE),
  storagePrivateKey: privateKey(process.env.OG_STORAGE_PRIVATE_KEY),
  storageIndexerUrl: serviceUrl(
    "OG_STORAGE_INDEXER_URL",
    process.env.OG_STORAGE_INDEXER_URL ||
      "https://indexer-storage-testnet-turbo.0g.ai",
  ),
  storageTimeoutMs: positiveInteger(
    "OG_STORAGE_TIMEOUT_MS",
    process.env.OG_STORAGE_TIMEOUT_MS,
    120_000,
  ),
  computeApiUrl: serviceUrl(
    "OG_COMPUTE_API_URL",
    process.env.OG_COMPUTE_API_URL ||
      "https://router-api-testnet.integratenetwork.work/v1",
  ),
  computeApiKey: process.env.OG_COMPUTE_API_KEY || "",
  computeModel: process.env.OG_COMPUTE_MODEL || "",
  computeTimeoutMs: positiveInteger(
    "OG_COMPUTE_TIMEOUT_MS",
    process.env.OG_COMPUTE_TIMEOUT_MS,
    60_000,
  ),
};

export function requireSessionSecret() {
  if (!serverConfig.sessionSecret || serverConfig.sessionSecret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Run `npm run setup` before starting AgentVault.",
    );
  }
  return serverConfig.sessionSecret;
}

export function resolvedStorageBackend(): "og" | "local" {
  if (serverConfig.storageMode === "local") return "local";
  if (serverConfig.storageMode === "og") return "og";
  return serverConfig.storagePrivateKey ? "og" : "local";
}
