import "server-only";

import { z } from "zod";
import { ApiError } from "@/lib/api";
import { memoryTypes, type MemoryType } from "@/lib/types";
import { serverConfig } from "@/lib/server-config";

type ComputeMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ModelEntry = {
  id: string;
  ownedBy?: string;
};

const globalCompute = globalThis as typeof globalThis & {
  agentVaultModels?: { expiresAt: number; value: ModelEntry[] };
  agentVaultModelsRequest?: Promise<ModelEntry[]>;
};

const extractedMemorySchema = z.object({
  type: z.enum(memoryTypes),
  content: z.string().trim().min(3).max(500),
  importance: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
});

function computeHeaders() {
  if (!serverConfig.computeApiKey) {
    throw new ApiError(
      "0G Compute is not configured. Add a testnet Router API key to OG_COMPUTE_API_KEY.",
      503,
      "COMPUTE_NOT_CONFIGURED",
    );
  }
  return {
    Authorization: `Bearer ${serverConfig.computeApiKey}`,
    "Content-Type": "application/json",
  };
}

async function computeFetch(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    serverConfig.computeTimeoutMs,
  );
  try {
    const response = await fetch(`${serverConfig.computeApiUrl}${path}`, {
      ...init,
      headers: { ...computeHeaders(), ...init?.headers },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.text();
      console.error("0G Compute error", response.status, body.slice(0, 500));
      throw new ApiError(
        `0G Compute returned ${response.status}. Check the Router balance, API key, and selected model.`,
        502,
        "COMPUTE_ERROR",
      );
    }
    return response;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "0G Compute did not respond in time. Try again shortly.",
      504,
      "COMPUTE_TIMEOUT",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function listComputeModels(): Promise<ModelEntry[]> {
  if (!serverConfig.computeApiKey) return [];
  if (
    globalCompute.agentVaultModels &&
    globalCompute.agentVaultModels.expiresAt > Date.now()
  ) {
    return globalCompute.agentVaultModels.value;
  }
  globalCompute.agentVaultModelsRequest ||= (async () => {
    const response = await computeFetch("/models");
    const body = (await response.json()) as {
      data?: Array<{ id?: unknown; owned_by?: unknown }>;
    };
    const value = (body.data || [])
      .filter((entry): entry is { id: string; owned_by?: string } =>
        Boolean(entry && typeof entry.id === "string"),
      )
      .slice(0, 200)
      .map((entry) => ({ id: entry.id, ownedBy: entry.owned_by }));
    globalCompute.agentVaultModels = {
      expiresAt: Date.now() + 5 * 60_000,
      value,
    };
    return value;
  })();
  try {
    return await globalCompute.agentVaultModelsRequest;
  } finally {
    globalCompute.agentVaultModelsRequest = undefined;
  }
}

async function resolveModel(requested?: string) {
  const models = await listComputeModels();
  const preferred = requested || serverConfig.computeModel;
  if (preferred) {
    if (models.length && !models.some((model) => model.id === preferred)) {
      throw new ApiError(
        "The selected 0G Compute model is no longer available. Choose another model.",
        409,
        "MODEL_UNAVAILABLE",
      );
    }
    return preferred;
  }
  if (!models[0]) {
    throw new ApiError(
      "No chatbot models are currently available through this 0G Compute account.",
      503,
      "NO_MODELS",
    );
  }
  return models[0].id;
}

async function completion(messages: ComputeMessage[], requestedModel?: string) {
  const model = await resolveModel(requestedModel);
  const response = await computeFetch("/chat/completions", {
    method: "POST",
    body: JSON.stringify({ model, messages, temperature: 0.35 }),
  });
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
    model?: string;
  };
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new ApiError(
      "0G Compute returned an empty response.",
      502,
      "EMPTY_COMPUTE_RESPONSE",
    );
  }
  return { content: content.trim(), model: body.model || model };
}

export async function answerWithMemory(input: {
  name: string;
  purpose: string;
  personality: string;
  prompt: string;
  memories: string[];
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>;
  model?: string;
}) {
  const memoryContext = input.memories.length
    ? input.memories.map((memory, index) => `${index + 1}. ${memory}`).join("\n")
    : "No relevant saved memories.";

  return completion(
    [
      {
        role: "system",
        content: [
          `You are ${input.name}. ${input.purpose}`,
          `Communication style: ${input.personality}`,
          "Use the supplied AgentVault memories only when relevant. Do not claim a memory exists if it is not listed. Be direct and useful.",
          `Relevant memories:\n${memoryContext}`,
        ].join("\n\n"),
      },
      ...input.recentMessages.slice(-10),
      { role: "user", content: input.prompt },
    ],
    input.model,
  );
}

function extractJsonArray(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || content;
  const start = source.indexOf("[");
  const end = source.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  try {
    return JSON.parse(source.slice(start, end + 1));
  } catch {
    return [];
  }
}

export async function extractMemories(
  userMessage: string,
  assistantReply: string,
  model?: string,
): Promise<
  Array<{
    type: MemoryType;
    content: string;
    importance: number;
    confidence: number;
  }>
> {
  const result = await completion(
    [
      {
        role: "system",
        content:
          "Extract only durable, user-specific facts worth remembering across future AI sessions. Ignore greetings, transient requests, and facts stated by the assistant. Return only a JSON array. Each item must have type (preference, project, technology, decision, fact, or knowledge), content as a concise standalone sentence, importance from 0 to 1, and confidence from 0 to 1. Return [] when nothing is worth saving.",
      },
      {
        role: "user",
        content: `User message:\n${userMessage}\n\nAssistant reply (context only):\n${assistantReply}`,
      },
    ],
    model,
  );

  const parsed = z.array(extractedMemorySchema).safeParse(
    extractJsonArray(result.content),
  );
  return parsed.success ? parsed.data.slice(0, 8) : [];
}
