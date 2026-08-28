import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { listComputeModels } from "@/lib/compute";
import { assertRateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await requireSession();
    await assertRateLimit(session.address, "model_list", 30, 60_000);
    return NextResponse.json({ models: await listComputeModels() });
  } catch (error) {
    return apiError(error);
  }
}
