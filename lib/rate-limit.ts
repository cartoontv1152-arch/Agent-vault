import "server-only";

import { ApiError } from "@/lib/api";
import { queryOne } from "@/lib/db";

type RateLimitRow = { request_count: number | string };

export function requestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

export async function assertRateLimit(
  subject: string,
  action: string,
  maximum: number,
  windowMs: number,
) {
  const now = Date.now();
  const resetBefore = now - windowMs;
  const row = await queryOne<RateLimitRow>(
    `INSERT INTO rate_limits (subject, action, window_start, request_count)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(subject, action) DO UPDATE SET
       request_count = CASE
         WHEN rate_limits.window_start < ? THEN 1
         ELSE rate_limits.request_count + 1
       END,
       window_start = CASE
         WHEN rate_limits.window_start < ? THEN excluded.window_start
         ELSE rate_limits.window_start
       END
     RETURNING request_count`,
    [subject, action, now, resetBefore, resetBefore],
  );

  if (Number(row?.request_count || 0) > maximum) {
    throw new ApiError(
      "Too many requests. Wait briefly and try again.",
      429,
      "RATE_LIMITED",
      Math.ceil(windowMs / 1000),
    );
  }
}
