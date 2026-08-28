export const memoryTypes = [
  "preference",
  "project",
  "technology",
  "decision",
  "fact",
  "knowledge",
] as const;

export type MemoryType = (typeof memoryTypes)[number];
export type StorageBackend = "og" | "local";

export type Agent = {
  id: string;
  owner: string;
  agentId: string;
  name: string;
  purpose: string;
  personality: string;
  rememberConversations: boolean;
  rememberPreferences: boolean;
  rememberProjects: boolean;
  registrationTxHash: string;
  latestRoot: string | null;
  anchoredRoot: string | null;
  storageBackend: StorageBackend | null;
  storageTxHash: string | null;
  anchorTxHash: string | null;
  createdAt: string;
  updatedAt: string;
  memoryCount?: number;
};

export type Memory = {
  id: string;
  type: MemoryType;
  content: string;
  importance: number;
  confidence: number;
  usageCount: number;
  lastAccessed: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  computeVerified: boolean;
  createdAt: string;
};

export type SnapshotResult = {
  rootHash: string;
  transactionHash: string | null;
  backend: StorageBackend;
  snapshotId: string;
};
