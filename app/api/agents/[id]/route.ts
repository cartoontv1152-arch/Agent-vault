import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { serializeAgent } from "@/lib/db";
import { findOwnedAgent } from "@/lib/repository";
import { requireSession } from "@/lib/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    return NextResponse.json({
      agent: serializeAgent(await findOwnedAgent(id, session.address)),
    });
  } catch (error) {
    return apiError(error);
  }
}
