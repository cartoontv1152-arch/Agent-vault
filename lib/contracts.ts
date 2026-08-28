import { parseAbi } from "viem";

export const identityRegistryAbi = parseAbi([
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
  "event MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue)",
  "function register(string agentURI, (string metadataKey, bytes metadataValue)[] metadata) returns (uint256 agentId)",
  "function setMetadata(uint256 agentId, string metadataKey, bytes metadataValue)",
  "function getMetadata(uint256 agentId, string metadataKey) view returns (bytes)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
]);

export const MEMORY_ROOT_KEY = "agentvault.memoryRoot";
export const VAULT_ID_KEY = "agentvault.vaultId";
export const PURPOSE_HASH_KEY = "agentvault.purposeHash";
