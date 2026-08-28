import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { assertRateLimit, requestIp } from "@/lib/rate-limit";
import { issueNonce } from "@/lib/session";

export async function GET(request: Request) {
  try {
    await assertRateLimit(`ip:${requestIp(request)}`, "auth_nonce", 20, 60_000);
    return NextResponse.json({ nonce: await issueNonce() });
  } catch (error) {
    return apiError(error);
  }
}
