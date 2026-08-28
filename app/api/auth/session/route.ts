import { NextResponse } from "next/server";
import { apiError, assertSameOrigin } from "@/lib/api";
import { clearSession, getSession } from "@/lib/session";

export async function GET() {
  try {
    return NextResponse.json({ session: await getSession() });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    await clearSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
