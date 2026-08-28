"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";
import type { Agent } from "@/lib/types";

export function useAgent(id: string) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<{ agent: Agent }>(`/api/agents/${id}`);
      setAgent(result.agent);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Agent could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => void refresh(), [refresh]);
  return { agent, loading, error, refresh };
}
