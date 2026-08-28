import { keccak256, type Hex } from "viem";

export function vaultUnlockMessage(address: string) {
  return [
    "Unlock AgentVault private memory",
    "",
    `Owner: ${address.toLowerCase()}`,
    "Network: 0G Galileo",
    "",
    "This signature derives your in-memory encryption key. It does not authorize a transaction or cost gas.",
  ].join("\n");
}

export function deriveVaultKey(signature: Hex) {
  return keccak256(signature);
}

export function vaultKeyStorageKey(address: string) {
  return `agentvault:vault-key:${address.toLowerCase()}`;
}
