import { describe, expect, it } from "vitest";
import { decryptText, encryptText, validateVaultKey } from "@/lib/crypto";

const key = `0x${"11".repeat(32)}` as `0x${string}`;

describe("vault encryption", () => {
  it("round-trips private text with agent-bound authenticated encryption", () => {
    const encrypted = encryptText("Prefers PostgreSQL", key, "agent-a");
    expect(encrypted).not.toContain("Prefers PostgreSQL");
    expect(decryptText(encrypted, key, "agent-a")).toBe("Prefers PostgreSQL");
  });

  it("rejects ciphertext moved to another agent", () => {
    const encrypted = encryptText("Private context", key, "agent-a");
    expect(() => decryptText(encrypted, key, "agent-b")).toThrow(
      "This wallet could not decrypt the vault.",
    );
  });

  it("rejects malformed vault keys", () => {
    expect(() => validateVaultKey("0x1234")).toThrow(
      "Unlock this vault with its owner wallet",
    );
  });
});
