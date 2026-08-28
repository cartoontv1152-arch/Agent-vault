import "server-only";

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type Database from "better-sqlite3";

export type DatabaseValue = string | number | null;

export type DatabaseStatement = {
  sql: string;
  params?: DatabaseValue[];
};

type DatabaseBackend =
  | { kind: "postgres"; sql: NeonQueryFunction<false, false> }
  | { kind: "sqlite"; native: Database.Database };

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    purpose TEXT NOT NULL,
    personality TEXT NOT NULL,
    remember_conversations INTEGER NOT NULL DEFAULT 1,
    remember_preferences INTEGER NOT NULL DEFAULT 1,
    remember_projects INTEGER NOT NULL DEFAULT 1,
    registration_tx_hash TEXT NOT NULL,
    latest_root TEXT,
    anchored_root TEXT,
    storage_backend TEXT,
    storage_tx_hash TEXT,
    anchor_tx_hash TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(owner, agent_id)
  )`,
  "CREATE INDEX IF NOT EXISTS agents_owner_idx ON agents(owner)",
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    agent_ref TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    cipher TEXT NOT NULL,
    model TEXT,
    compute_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS messages_agent_idx ON messages(agent_ref, created_at)",
  `CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    agent_ref TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    cipher TEXT NOT NULL,
    importance REAL NOT NULL,
    confidence REAL NOT NULL,
    source_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_accessed TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )`,
  "CREATE INDEX IF NOT EXISTS memories_agent_idx ON memories(agent_ref, deleted_at, created_at)",
  `CREATE TABLE IF NOT EXISTS snapshots (
    id TEXT PRIMARY KEY,
    agent_ref TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    root_hash TEXT NOT NULL,
    transaction_hash TEXT,
    backend TEXT NOT NULL CHECK(backend IN ('og', 'local')),
    locator TEXT NOT NULL,
    created_at TEXT NOT NULL,
    verified_at TEXT
  )`,
  "CREATE INDEX IF NOT EXISTS snapshots_agent_idx ON snapshots(agent_ref, created_at)",
  `CREATE TABLE IF NOT EXISTS rate_limits (
    subject TEXT NOT NULL,
    action TEXT NOT NULL,
    window_start BIGINT NOT NULL,
    request_count INTEGER NOT NULL,
    PRIMARY KEY(subject, action)
  )`,
] as const;

const globalDatabase = globalThis as typeof globalThis & {
  agentVaultBackend?: Promise<DatabaseBackend>;
  agentVaultSchema?: Promise<void>;
};

function postgresQuery(text: string) {
  let index = 0;
  return text.replace(/\?/g, () => `$${++index}`);
}

async function createBackend(): Promise<DatabaseBackend> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    return { kind: "postgres", sql: neon(databaseUrl) };
  }

  if (process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL is required on Vercel. Local SQLite is intentionally disabled because Vercel filesystems are ephemeral.",
    );
  }

  const databasePath = process.env.DATABASE_PATH
    ? resolve(process.env.DATABASE_PATH)
    : resolve(process.cwd(), ".data", "agentvault.db");
  mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  const { default: BetterSqlite3 } = await import("better-sqlite3");
  const native = new BetterSqlite3(databasePath, { timeout: 5000 });
  native.pragma("journal_mode = WAL");
  native.pragma("foreign_keys = ON");
  try {
    chmodSync(databasePath, 0o600);
  } catch {
    // Windows does not consistently implement POSIX file modes.
  }
  return { kind: "sqlite", native };
}

async function getBackend() {
  globalDatabase.agentVaultBackend ||= createBackend();
  return globalDatabase.agentVaultBackend;
}

async function ensureSchema() {
  globalDatabase.agentVaultSchema ||= (async () => {
    const backend = await getBackend();
    if (backend.kind === "postgres") {
      await backend.sql.transaction(
        schemaStatements.map((sql) => backend.sql.query(sql)),
      );
      return;
    }
    backend.native.transaction(() => {
      for (const sql of schemaStatements) backend.native.exec(sql);
    })();
  })();
  return globalDatabase.agentVaultSchema;
}

export async function queryAll<T>(
  sql: string,
  params: DatabaseValue[] = [],
): Promise<T[]> {
  await ensureSchema();
  const backend = await getBackend();
  if (backend.kind === "postgres") {
    return (await backend.sql.query(postgresQuery(sql), params)) as T[];
  }
  return backend.native.prepare(sql).all(...params) as T[];
}

export async function queryOne<T>(
  sql: string,
  params: DatabaseValue[] = [],
): Promise<T | undefined> {
  return (await queryAll<T>(sql, params))[0];
}

export async function execute(
  sql: string,
  params: DatabaseValue[] = [],
) {
  await ensureSchema();
  const backend = await getBackend();
  if (backend.kind === "postgres") {
    await backend.sql.query(postgresQuery(sql), params);
    return;
  }
  backend.native.prepare(sql).run(...params);
}

export async function transaction(statements: DatabaseStatement[]) {
  if (!statements.length) return;
  await ensureSchema();
  const backend = await getBackend();
  if (backend.kind === "postgres") {
    await backend.sql.transaction(
      statements.map(({ sql, params = [] }) =>
        backend.sql.query(postgresQuery(sql), params),
      ),
    );
    return;
  }
  backend.native.transaction(() => {
    for (const { sql, params = [] } of statements) {
      backend.native.prepare(sql).run(...params);
    }
  })();
}

export async function databaseHealth() {
  const backend = await getBackend();
  await ensureSchema();
  if (backend.kind === "postgres") {
    await backend.sql`SELECT 1 AS ok`;
  } else {
    backend.native.prepare("SELECT 1 AS ok").get();
  }
  return backend.kind;
}

export type AgentRow = {
  id: string;
  owner: string;
  agent_id: string;
  name: string;
  purpose: string;
  personality: string;
  remember_conversations: number;
  remember_preferences: number;
  remember_projects: number;
  registration_tx_hash: string;
  latest_root: string | null;
  anchored_root: string | null;
  storage_backend: "og" | "local" | null;
  storage_tx_hash: string | null;
  anchor_tx_hash: string | null;
  created_at: string;
  updated_at: string;
  memory_count?: number | string;
};

export function serializeAgent(row: AgentRow) {
  return {
    id: row.id,
    owner: row.owner,
    agentId: row.agent_id,
    name: row.name,
    purpose: row.purpose,
    personality: row.personality,
    rememberConversations: Boolean(row.remember_conversations),
    rememberPreferences: Boolean(row.remember_preferences),
    rememberProjects: Boolean(row.remember_projects),
    registrationTxHash: row.registration_tx_hash,
    latestRoot: row.latest_root,
    anchoredRoot: row.anchored_root,
    storageBackend: row.storage_backend,
    storageTxHash: row.storage_tx_hash,
    anchorTxHash: row.anchor_tx_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    memoryCount: Number(row.memory_count || 0),
  };
}
