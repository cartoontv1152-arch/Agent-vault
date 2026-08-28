import { describe, expect, it } from "vitest";
import { createSiweNonce } from "@/lib/session";

describe("SIWE nonce generation", () => {
  it("always satisfies the alphanumeric SIWE nonce grammar", () => {
    const values = Array.from({ length: 100 }, () => createSiweNonce());

    expect(values.every((value) => /^[A-Za-z0-9]{8,}$/.test(value))).toBe(true);
    expect(new Set(values).size).toBe(values.length);
  });
});
