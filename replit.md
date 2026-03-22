# VibeMsg — Expo React Native Messaging App

## App Overview
VibeMsg is a feature-rich iOS-style messaging app with unique innovations:
1. **Broadcast Check-In Groups** — members can't see each other, only sender sees replies, live reply progress bars, auto member reply simulation
2. **Musical Messages (two tiers)** — (a) raw audio clips via file picker shown as waveform player bubbles; (b) Music Card messages — 18 curated tracks across 6 moods (Energy/Vibe/Chill/Love/Good Mood/Attitude) rendered as gradient mini-player bubbles with animated EQ bars and play/pause
3. **Skin Store** — 3-tab (Store/AI Lab/My Skins) with VibeCoin purchases, AI-generated skins, gradient chat/bubble theming

### Key Features
- End-to-end AES-256 encryption (via crypto-js) per chat — encrypted on device, stored ciphertext in AsyncStorage
- Per-chat passcode lock (4-6 digit PIN) with hint and recovery email option
- Encrypted chats show no message preview on the main list ("🔐 Encrypted message")
- Export any chat thread to PDF (expo-print + expo-sharing) with full dates/times
- Advanced search: keyword, exact date, date range, time range, by sender — with highlighted results
- Multiple organize modes: Most Recent, Unread First, Alphabetical, Oldest First, Pinned First
- Filter tabs: All, Unread, Direct, Groups, Pinned, Encrypted
- Home screen widget configuration (Small/Medium/Large, up to 4 chat shortcuts)
- Swipe-to-pin, swipe-to-mute, swipe-to-delete, swipe to Chat Settings
- Check-In broadcast groups with per-member reply panels and private side chats
- Audio message player with waveform visualization and pulse animation
- Emoji reactions on any message via long-press
- Read receipts, online status, "last seen" indicators
- Dark/light mode, Inter fonts, iOS-native design language

### Real-Time Backend (NEW)
- **PostgreSQL** — `vm_users`, `vm_chats`, `vm_chat_members`, `vm_messages` tables (UUIDs, BigInt timestamps)
- **Socket.io** on the Express API server — rooms per chat, `user:join`, `message:send→message:new`, `typing:start/stop`, disconnect cleanup
- **REST routes**: `POST /api/users/register`, `GET /api/users/find`, `POST /api/chats/direct`, `POST /api/chats/group`, `GET /api/chats/:id/messages`
- **ServerContext** (`artifacts/mobile/context/ServerContext.tsx`) — socket client, server user ID (persisted in AsyncStorage), register, find users, create chats, typing events
- **Registration** happens silently on onboarding completion (fire-and-forget)
- **Find People tab** in New Chat screen searches live server users by name/@username
- **Live badge** + **typing indicator** appear in chat header for server chats
- All existing local-only features still work; server is opt-in per chat

### Architecture
- `artifacts/mobile/context/ServerContext.tsx` — socket connection, server user registration, user search, real-time events
- `artifacts/mobile/context/MessagingContext.tsx` — all state, AsyncStorage persistence, encryption, search, PDF gen, socket integration
- `artifacts/mobile/utils/crypto.ts` — AES encrypt/decrypt, PBKDF2, SHA-256 via crypto-js
- `artifacts/mobile/app/(tabs)/index.tsx` — main chats screen with all filter/sort/organize features
- `artifacts/mobile/app/search.tsx` — advanced multi-mode search screen
- `artifacts/mobile/app/chat-settings/[id].tsx` — encryption toggle, passcode, PDF export, delete
- `artifacts/mobile/app/widget-settings.tsx` — home screen widget configuration
- `artifacts/mobile/components/PasscodeModal.tsx` — 6-dot PIN entry with shake animation and hint/recovery
- `artifacts/mobile/components/MessageBubble.tsx` — message with audio player (expo-audio)
- `artifacts/mobile/components/ChatInput.tsx` — music note button for audio attachment

### Key packages
- expo-audio ~1.1.1 (replaces deprecated expo-av)
- crypto-js (AES encryption)
- expo-print ~15.0.8 (PDF generation)
- expo-mail-composer ~15.0.8 (recovery email)
- expo-sharing (share PDF files)
- expo-document-picker (attach audio files)
- @react-native-async-storage/async-storage (local persistence)
- react-native-keyboard-controller (keyboard avoidance)
- expo-haptics (tactile feedback)

---

# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
