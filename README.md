# AgentVault

AgentVault is a wallet-owned memory layer for AI agents on the 0G Galileo testnet. It gives an agent a portable ERC-8004 identity, keeps its useful context encrypted, and lets the owner inspect, edit, export, verify, and anchor that context instead of losing it when a model changes.

## What the app does

1. **Connect and unlock** — SIWE authenticates the owner wallet. A fixed, human-readable wallet signature derives an in-memory AES-256-GCM vault key. The signature never authorizes a transaction.
2. **Create an agent** — the browser submits a real ERC-8004 registration transaction to the official 0G Galileo Identity Registry. The server verifies the receipt and binds the resulting agent record to the signing address.
3. **Chat with memory** — prompts are ranked against decrypted memories, sent to the configured 0G Compute Router, and saved as encrypted messages when conversation memory is enabled. The extraction step can save new preference/project facts without blocking a successful reply.
4. **Manage memory** — the owner can search, filter, add, edit, delete, import JSON, or export JSON. Every write creates a fresh encrypted snapshot.
5. **Store and verify** — snapshots use 0G Storage Turbo in production. The Identity and Memory screens compare the latest storage root with the `agentvault.memoryRoot` ERC-8004 metadata value and can verify the stored content.
6. **Anchor ownership** — “Anchor latest root” writes the snapshot root to the agent’s on-chain metadata. The private memory content is never written directly to the chain.

## Product routes

- `/` — product overview and 0G architecture explanation.
- `/app` — owner dashboard, integration health, and agent list.
- `/app/agents/new` — ERC-8004 identity creation flow.
- `/app/agents/:id/chat` — model selection, private chat, memory retrieval notices, and snapshot status.
- `/app/agents/:id/memory` — encrypted memory review, search/filter, add/edit/delete, import/export, verification, and anchoring.
- `/app/agents/:id/identity` — live owner, token URI, registry, storage, and root comparison.
- `/privacy` and `/terms` — plain-language testnet notices.

## Architecture

- **Next.js 16 App Router + React 19 + TypeScript** for the web application and API routes.
- **Wagmi/Viem** for wallet connection, chain reads, and the browser-signed ERC-8004 registration and metadata transactions.
- **SIWE + HTTP-only signed session cookie** for authentication. Every private route checks the session, wallet ownership, same-origin request, JSON limits, and a database-backed rate limit.
- **AES-256-GCM** envelopes use the vault key plus the agent ID as additional authenticated data. The database and 0G Storage receive ciphertext only.
- **Neon Postgres** is required on Vercel; local development falls back to a private `.data/agentvault.db` SQLite file.
- **0G Galileo** defaults are centralized in `lib/network.ts`; service keys and URLs are validated in `lib/server-config.ts`.
- **0G Compute** is called through its OpenAI-compatible Router API. Model discovery is available at `/api/models` and chat at `/api/agents/:id/chat`.
- **0G Storage Turbo** receives encrypted vault snapshots. `STORAGE_MODE=og` fails closed if the production storage service is unavailable; `auto` is useful only for local development.

## Configuration

Copy `.env.example` to `.env.local` and fill in the private values. Never commit `.env.local`, a wallet private key, or a Router key.

| Variable | Purpose |
| --- | --- |
| `SESSION_SECRET` | Signs the HTTP-only SIWE session. Generate with `npm run setup`. |
| `DATABASE_URL` | Durable Postgres connection string. Required on Vercel. |
| `NEXT_PUBLIC_APP_URL` | Public origin used by SIWE and agent registration metadata. |
| `NEXT_PUBLIC_OG_*` | Public Galileo RPC, explorers, chain ID, and registry settings. |
| `STORAGE_MODE` | `og` for production, `auto` for local fallback behavior. |
| `OG_STORAGE_PRIVATE_KEY` | Server signer used for 0G Storage uploads. |
| `OG_STORAGE_INDEXER_URL` | 0G Storage indexer endpoint. |
| `OG_COMPUTE_API_URL` | OpenAI-compatible 0G Compute Router base URL. |
| `OG_COMPUTE_API_KEY` | Router credential for model discovery and chat. |
| `OG_COMPUTE_MODEL` | Optional default model override. |
| `*_TIMEOUT_MS` | Bounded Storage/Compute request timeouts. |

## Local development

Requirements: Node.js 24, a browser wallet, and Galileo testnet 0G from the [0G faucet](https://faucet.0g.ai).

```bash
npm install
npm run setup
# edit .env.local; add OG_COMPUTE_API_KEY for chat
npm run dev
```

Open `http://localhost:3000`, switch the wallet to chain `16602`, and use the [0G Compute testnet console](https://pc.testnet.0g.ai) for a Router key. A local SQLite database is created under `.data/` and is intentionally ignored by git.

## Verification and release checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```

The production health endpoint is `/api/health`. A release is considered ready only when `chain.connected`, `chain.registryAvailable`, `storage.backend === "og"`, `compute.configured`, and `persistence.durable` are all true. Browser smoke checks should cover the landing page, wallet gate, dashboard empty state, agent creation, chat error recovery, memory CRUD/import/export, identity reads, root anchoring, mobile sidebar, `/privacy`, `/terms`, and a 404 route.

## Deploying to Vercel

Create a Neon Postgres database and set every variable from `.env.example` in the Vercel project. Keep `SESSION_SECRET`, `OG_COMPUTE_API_KEY`, `OG_STORAGE_PRIVATE_KEY`, and `DATABASE_URL` encrypted as sensitive environment variables. Use Node.js 24 and deploy with:

```bash
vercel --prod
```

After deployment, run `npm run build` and the production smoke script, then inspect `/api/health`. The current public deployment is `https://agentvault-one.vercel.app`.

## Data and testnet caveats

Locking the vault removes the derived key from the browser session, but existing ciphertext remains in the database and 0G Storage. Deleting a memory creates a tombstone and a new snapshot; it is not a recovery mechanism. Testnet RPC, Compute, Storage, and faucet services can be delayed, rate-limited, reset, or unavailable. Do not put production secrets or irreplaceable data in the Galileo testnet vault.
