import type { Memory } from "@/lib/types";

function tokens(value: string) {
  return new Set(
    value
      .toLocaleLowerCase()
      .normalize("NFKD")
      .split(/[^\p{L}\p{N}+#.-]+/u)
      .filter((token) => token.length > 1)
      .map((token) => (token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token)),
  );
}

export function normalizeMemory(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function rankMemories(query: string, memories: Memory[], limit = 8) {
  const queryTokens = tokens(query);
  return memories
    .map((memory) => {
      const memoryTokens = tokens(memory.content);
      let overlap = 0;
      for (const token of queryTokens) {
        if (memoryTokens.has(token)) overlap += 1;
      }
      const relevance = queryTokens.size ? overlap / queryTokens.size : 0;
      const score = relevance * 0.68 + memory.importance * 0.22 + memory.confidence * 0.1;
      return { memory, score };
    })
    .filter(({ score, memory }) => {
      if (!queryTokens.size) return score > 0.12;
      return tokens(memory.content).size > 0 && score > 0.12 &&
        [...queryTokens].some((token) => tokens(memory.content).has(token));
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ memory }) => memory);
}
