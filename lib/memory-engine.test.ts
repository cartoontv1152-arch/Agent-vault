import { describe, expect, it } from "vitest";
import { normalizeMemory, rankMemories } from "@/lib/memory-engine";

describe("memory engine", () => {
  it("normalizes equivalent memory text for deduplication", () => {
    expect(normalizeMemory("Prefers TypeScript! ")).toBe("prefers typescript");
    expect(normalizeMemory("Prefers  TypeScript")).toBe("prefers typescript");
  });

  it("ranks relevant memories before unrelated ones", () => {
    const result = rankMemories("database", [
      { id: "a", type: "technology", content: "Uses PostgreSQL for databases", importance: 0.8, confidence: 0.9, usageCount: 0, lastAccessed: null, createdAt: "", updatedAt: "" },
      { id: "b", type: "fact", content: "Likes morning walks", importance: 1, confidence: 1, usageCount: 0, lastAccessed: null, createdAt: "", updatedAt: "" },
    ]);
    expect(result[0]?.id).toBe("a");
    expect(result.some((memory) => memory.id === "b")).toBe(false);
  });
});
