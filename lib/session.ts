import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { ApiError } from "@/lib/api";
import { requireSessionSecret } from "@/lib/server-config";

const NONCE_COOKIE = "agentvault_nonce";
const SESSION_COOKIE = "agentvault_session";

type Session = {
  address: `0x${string}`;
  chainId: number;
};

function signingKey() {
  return new TextEncoder().encode(requireSessionSecret());
}

async function signToken(
  payload: Record<string, unknown>,
  expiresIn: string,
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(signingKey());
}

export async function issueNonce() {
  const nonce = createSiweNonce();
  const token = await signToken({ nonce, scope: "login" }, "10m");
  const jar = await cookies();
  jar.set(NONCE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return nonce;
}

export function createSiweNonce() {
  return randomBytes(18).toString("hex");
}

export async function readNonce() {
  const jar = await cookies();
  const token = jar.get(NONCE_COOKIE)?.value;
  jar.delete(NONCE_COOKIE);
  if (!token) throw new ApiError("The login request expired. Try again.", 401);

  try {
    const { payload } = await jwtVerify(token, signingKey());
    if (payload.scope !== "login" || typeof payload.nonce !== "string") {
      throw new Error("Invalid nonce token");
    }
    return payload.nonce;
  } catch {
    throw new ApiError("The login request expired. Try again.", 401);
  }
}

export async function issueSession(session: Session) {
  const token = await signToken(
    { address: session.address.toLowerCase(), chainId: session.chainId },
    "7d",
  );
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  jar.delete(NONCE_COOKIE);
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(NONCE_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, signingKey());
    if (
      typeof payload.address !== "string" ||
      !payload.address.startsWith("0x") ||
      typeof payload.chainId !== "number"
    ) {
      return null;
    }
    return {
      address: payload.address as `0x${string}`,
      chainId: payload.chainId,
    };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new ApiError("Connect and unlock your wallet to continue.", 401, "UNAUTHORIZED");
  }
  return session;
}
