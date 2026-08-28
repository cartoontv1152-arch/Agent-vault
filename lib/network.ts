import { defineChain, isAddress } from "viem";

function publicNumber(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function publicValue(name: string, fallback: string) {
  return process.env[name] || fallback;
}

function publicUrl(name: string, fallback: string) {
  const value = publicValue(name, fallback);
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${name} must use http or https.`);
  }
  return url.toString().replace(/\/$/, "");
}

function publicAddress(name: string, fallback: `0x${string}`) {
  const value = publicValue(name, fallback);
  if (!isAddress(value)) throw new Error(`${name} must be an EVM address.`);
  return value;
}

export const publicConfig = {
  appUrl: publicUrl("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  chainId: publicNumber("NEXT_PUBLIC_OG_CHAIN_ID", 16602),
  rpcUrl: publicUrl(
    "NEXT_PUBLIC_OG_RPC_URL",
    "https://evmrpc-testnet.0g.ai",
  ),
  explorerUrl: publicUrl(
    "NEXT_PUBLIC_OG_EXPLORER_URL",
    "https://chainscan-galileo.0g.ai",
  ),
  storageExplorerUrl: publicUrl(
    "NEXT_PUBLIC_OG_STORAGE_EXPLORER_URL",
    "https://storagescan-galileo.0g.ai",
  ),
  identityRegistry: publicAddress(
    "NEXT_PUBLIC_ERC8004_IDENTITY_REGISTRY",
    "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  ),
} as const;

export const galileo = defineChain({
  id: publicConfig.chainId,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: {
    default: { http: [publicConfig.rpcUrl] },
  },
  blockExplorers: {
    default: { name: "0G ChainScan", url: publicConfig.explorerUrl },
  },
  testnet: true,
});

export function explorerTransaction(hash: string) {
  return `${publicConfig.explorerUrl}/tx/${hash}`;
}

export function explorerAddress(address: string) {
  return `${publicConfig.explorerUrl}/address/${address}`;
}
