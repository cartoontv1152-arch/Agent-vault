import { Wallet } from "ethers";
import { SiweMessage } from "siwe";

const baseUrl = process.env.SMOKE_BASE_URL;
const privateKey = process.env.OG_STORAGE_PRIVATE_KEY;
const chainId = Number(process.env.NEXT_PUBLIC_OG_CHAIN_ID);

if (!baseUrl) throw new Error("SMOKE_BASE_URL is required.");
if (!privateKey) throw new Error("OG_STORAGE_PRIVATE_KEY is required.");
if (!Number.isSafeInteger(chainId) || chainId <= 0) {
  throw new Error("NEXT_PUBLIC_OG_CHAIN_ID must be a positive integer.");
}

const origin = new URL(baseUrl).origin;
const wallet = new Wallet(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);

function cookiesFrom(response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
}

async function json(response, label) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}: ${body.error || "Unknown error"}`);
  }
  return body;
}

const nonceResponse = await fetch(`${origin}/api/auth/nonce`);
const { nonce } = await json(nonceResponse, "Nonce request");
const nonceCookie = cookiesFrom(nonceResponse);
const message = new SiweMessage({
  domain: new URL(origin).host,
  address: wallet.address,
  statement: "Sign in to your private AgentVault.",
  uri: origin,
  version: "1",
  chainId,
  nonce,
});
const prepared = message.prepareMessage();
const signature = await wallet.signMessage(prepared);
const verifyResponse = await fetch(`${origin}/api/auth/verify`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: nonceCookie,
    Origin: origin,
  },
  body: JSON.stringify({ message: prepared, signature }),
});
await json(verifyResponse, "SIWE verification");
const sessionCookie = cookiesFrom(verifyResponse);
const authenticatedHeaders = { Cookie: sessionCookie };

const [sessionResponse, agentsResponse, modelsResponse] = await Promise.all([
  fetch(`${origin}/api/auth/session`, { headers: authenticatedHeaders }),
  fetch(`${origin}/api/agents`, { headers: authenticatedHeaders }),
  fetch(`${origin}/api/models`, { headers: authenticatedHeaders }),
]);
const [session, agents, models] = await Promise.all([
  json(sessionResponse, "Session check"),
  json(agentsResponse, "Agent list"),
  json(modelsResponse, "Model list"),
]);

console.log(
  JSON.stringify(
    {
      origin,
      wallet: `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`,
      authenticated:
        session.session?.address?.toLowerCase() === wallet.address.toLowerCase(),
      agentCount: Array.isArray(agents.agents) ? agents.agents.length : null,
      modelCount: Array.isArray(models.models) ? models.models.length : null,
    },
    null,
    2,
  ),
);
