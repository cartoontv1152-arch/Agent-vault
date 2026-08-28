export class ClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ClientError(
      "Network connection failed. Check your connection and try again.",
      0,
      "NETWORK_ERROR",
    );
  }

  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };
  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    const retryHint = retryAfter ? ` Try again in ${retryAfter} seconds.` : "";
    throw new ClientError(
      `${body.error || `Request failed with ${response.status}.`}${retryHint}`,
      response.status,
      body.code,
    );
  }
  return body as T;
}

export function shortAddress(value: string, start = 6, end = 4) {
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

export function shortHash(value: string) {
  return shortAddress(value, 10, 8);
}
