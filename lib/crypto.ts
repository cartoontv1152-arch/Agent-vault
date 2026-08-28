import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { ApiError } from "@/lib/api";

type CipherEnvelope = {
  version: 1;
  algorithm: "aes-256-gcm";
  iv: string;
  tag: string;
  data: string;
};

export function validateVaultKey(value: unknown): asserts value is `0x${string}` {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new ApiError(
      "Unlock this vault with its owner wallet before accessing private memory.",
      401,
      "VAULT_LOCKED",
    );
  }
}

function keyBytes(key: `0x${string}`) {
  return Buffer.from(key.slice(2), "hex");
}

function additionalData(agentId: string) {
  return Buffer.from(`agentvault:v1:${agentId}`, "utf8");
}

export function encryptText(
  plaintext: string,
  key: `0x${string}`,
  agentId: string,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(key), iv);
  cipher.setAAD(additionalData(agentId));
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const envelope: CipherEnvelope = {
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    data: encrypted.toString("base64url"),
  };

  return JSON.stringify(envelope);
}

export function decryptText(
  serialized: string,
  key: `0x${string}`,
  agentId: string,
) {
  try {
    const envelope = JSON.parse(serialized) as CipherEnvelope;
    if (envelope.version !== 1 || envelope.algorithm !== "aes-256-gcm") {
      throw new Error("Unsupported cipher envelope");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyBytes(key),
      Buffer.from(envelope.iv, "base64url"),
    );
    decipher.setAAD(additionalData(agentId));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new ApiError(
      "This wallet could not decrypt the vault. Make sure the original owner wallet is connected.",
      401,
      "DECRYPTION_FAILED",
    );
  }
}
