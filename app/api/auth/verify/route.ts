import { NextResponse } from "next/server";
import { SiweMessage } from "siwe";
import { z } from "zod";
import { apiError, ApiError, assertSameOrigin, readJson } from "@/lib/api";
import { publicConfig } from "@/lib/network";
import { assertRateLimit, requestIp } from "@/lib/rate-limit";
import { issueSession, readNonce } from "@/lib/session";

const inputSchema = z.object({
  message: z.string().min(1),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await assertRateLimit(`ip:${requestIp(request)}`, "auth_verify", 10, 60_000);
    const input = inputSchema.parse(await readJson(request));
    const nonce = await readNonce();
    const message = new SiweMessage(input.message);
    const expectedDomain =
      request.headers.get("host") || new URL(publicConfig.appUrl).host;
    const result = await message.verify({
      signature: input.signature,
      nonce,
      domain: expectedDomain,
    });

    if (!result.success || message.chainId !== publicConfig.chainId) {
      throw new ApiError("The wallet signature is not valid for 0G Galileo.", 401);
    }

    await issueSession({
      address: message.address as `0x${string}`,
      chainId: message.chainId,
    });
    return NextResponse.json({
      address: message.address.toLowerCase(),
      chainId: message.chainId,
    });
  } catch (error) {
    return apiError(error);
  }
}
