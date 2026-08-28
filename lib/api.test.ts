import { describe, expect, it } from "vitest";
import { assertSameOrigin, readJson } from "@/lib/api";

describe("API request protections", () => {
  it("accepts a matching request origin", () => {
    const request = new Request("https://agentvault.example/api/test", {
      headers: {
        host: "agentvault.example",
        origin: "https://agentvault.example",
      },
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("rejects a cross-origin request", () => {
    const request = new Request("https://agentvault.example/api/test", {
      headers: {
        host: "agentvault.example",
        origin: "https://attacker.example",
      },
    });
    expect(() => assertSameOrigin(request)).toThrow(
      "Cross-origin requests are not allowed.",
    );
  });

  it("requires JSON for API request bodies", async () => {
    const request = new Request("https://agentvault.example/api/test", {
      method: "POST",
      body: "not json",
      headers: { "content-type": "text/plain" },
    });
    await expect(readJson(request)).rejects.toMatchObject({ status: 415 });
  });

  it("rejects oversized JSON bodies before route work", async () => {
    const request = new Request("https://agentvault.example/api/test", {
      method: "POST",
      body: JSON.stringify({ value: "1234567890" }),
      headers: { "content-type": "application/json" },
    });
    await expect(readJson(request, 8)).rejects.toMatchObject({ status: 413, code: "PAYLOAD_TOO_LARGE" });
  });
});
