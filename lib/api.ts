import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "BAD_REQUEST",
    public retryAfter?: number,
  ) {
    super(message);
  }
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      {
        status: error.status,
        headers: error.retryAfter
          ? { "Retry-After": String(error.retryAfter) }
          : undefined,
      },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "The request contains invalid data.", details: error.issues },
      { status: 422 },
    );
  }

  console.error(error);
  return NextResponse.json(
    { error: "AgentVault could not complete the request." },
    { status: 500 },
  );
}

export async function readJson(request: Request, maxBytes = 1_000_000) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new ApiError("Content-Type must be application/json.", 415);
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiError("The request body is too large.", 413, "PAYLOAD_TOO_LARGE");
  }
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > maxBytes) {
      throw new ApiError("The request body is too large.", 413, "PAYLOAD_TOO_LARGE");
    }
    return JSON.parse(body) as unknown;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("A valid JSON request body is required.", 400);
  }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    if (process.env.NODE_ENV === "production") {
      throw new ApiError("A same-origin request is required.", 403, "ORIGIN_REQUIRED");
    }
    return;
  }

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProtocol = request.headers.get("x-forwarded-proto");
    const expectedHost = forwardedHost || request.headers.get("host") || requestUrl.host;
    const expectedProtocol = forwardedProtocol || requestUrl.protocol.replace(":", "");
    if (
      originUrl.host !== expectedHost ||
      originUrl.protocol !== `${expectedProtocol}:`
    ) {
      throw new Error("Origin mismatch");
    }
  } catch {
    throw new ApiError("Cross-origin requests are not allowed.", 403, "ORIGIN_MISMATCH");
  }
}
