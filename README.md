# ZIVR — Encrypted AI-Powered Messaging App

ZIVR is a full-stack, real-time messaging application built with Expo React Native (mobile), Express + Socket.io (backend), and PostgreSQL. It features end-to-end encryption, AI-powered translation and reply suggestions, rich media messaging, and a customisable skin store.

---

## ✨ Features

### Messaging
- Real-time one-to-one and group chats via Socket.io
- Text, image, audio, GIF, and music-card message types
- Emoji reactions, message edits, and deletes
- Typing indicators and read receipts
- Online/offline presence and missed-message catch-up on reconnect
- Search messages by keyword, date, time, or sender
- Pin, mute, and delete conversations with swipe gestures

### Security & Privacy
- AES-256 per-chat encryption with PBKDF2/SHA-256 key derivation
- Device-only keys for end-to-end encrypted chats
- Passcode lock, recovery flow, and encrypted-list preview masking
- Screen-capture guard and secure picture sharing

### AI Capabilities
- **Auto-Translation** — outgoing messages are silently translated before sending based on a per-chat recipient language setting (30 languages supported). Powered by Anthropic Claude Haiku.
- **Suggest-Reply** — a ✨ button reads the recent conversation and suggests a contextual reply you can edit or send instantly.
- **AI Content Moderation** — every message in a child's chat is scanned by Claude Haiku for inappropriate content; flagged messages are stored and surfaced to parents with a severity rating and reason.

### Family & Parental Controls
- **Parent accounts** — toggle Parent Mode in profile to create and manage child accounts
- **Child accounts** — separate monitored accounts linked to a parent, with restricted access
- **Screen time** — set allowed hours and active days per child; a lock screen blocks the app outside those windows
- **Contact approval** — children's contact requests go to a parent approval queue before messaging can begin
- **AI monitoring dashboard** — parents see all flagged messages per child, severity-rated (low / medium / high), with Claude's explanation; one-tap dismiss after review

### Other
- Broadcast check-ins where members can't see each other's responses
- Call history
- Contact sync and group management
- Push notifications (Expo Notifications)
- **Skin Store** — themed UI skins purchasable with ZivCoin (in-app purchases)
- **Parental dashboard** — manage all children, see unread flag counts, jump to per-child settings
- Investor slide deck (`/zivr-deck`)

---

## 🏗 Monorepo Structure

```
.
├── artifacts/
│   ├── api-server/        # Express 5 + Socket.io REST & realtime backend
│   ├── mobile/            # Expo React Native iOS/Android app
│   ├── zivr-deck/         # Vite React investor slide deck
│   └── mockup-sandbox/    # Vite component preview / design harness
├── lib/
│   ├── db/                # PostgreSQL pool + Drizzle ORM schema
│   ├── api-spec/          # OpenAPI 3.1 contract + Orval codegen
│   ├── api-zod/           # Generated Zod schemas
│   └── api-client-react/  # Generated React Query fetch client
└── scripts/               # Utility TypeScript scripts
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.9, Node 22+ |
| Package manager | pnpm (workspaces) |
| Mobile | Expo ~54, React Native 0.81, Expo Router |
| Backend | Express 5, Socket.io 4.8 |
| Database | PostgreSQL, Drizzle ORM |
| AI | Anthropic Claude Haiku (claude-haiku-4-5) |
| Validation | Zod, drizzle-zod |
| Logging | Pino |
| Frontend tooling | Vite, esbuild, Tailwind 4 |
| State / data-fetching | React Query, AsyncStorage |
| Animation | Reanimated, Gesture Handler, Framer Motion |

---

## 🚀 Local Development

### Prerequisites
- [Node 22+](https://nodejs.org/) (Render production uses Node 22; Node 24 also works)
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- PostgreSQL database (set `DATABASE_URL` in your environment)
- Anthropic API key (set `AI_INTEGRATIONS_ANTHROPIC_API_KEY` and `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Push the database schema

```bash
pnpm --filter @workspace/db run push
```

### 3. Start the API server

```bash
pnpm --filter @workspace/api-server run dev
```

The API will be available at `http://localhost:<PORT>/api`.  
Socket.io path: `/api/socket.io`  
Health check: `GET /api/healthz`  
Realtime bus: `GET /api/healthz/realtime`

### 4. Start the mobile app

```bash
pnpm --filter @workspace/mobile run dev
```

Requires the Expo CLI. Set `EXPO_PUBLIC_DOMAIN` to point at your running API server.

### 5. (Optional) Start the slide deck

```bash
pnpm --filter @workspace/zivr-deck run dev
```

### Regenerate API client from OpenAPI spec

```bash
pnpm --filter @workspace/api-spec run codegen
```

---

## 🌐 API Routes

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/healthz` | Health check (`{"status":"ok"}`) |
| `GET` | `/api/healthz/realtime` | Postgres LISTEN fan-out status (`busHealthy`, no message content) |
| `POST` | `/api/users/recover/request-email` | Email a new recovery code (Migadu SMTP). Always `200` for a well-formed identifier |
| `PUT` | `/api/users/:id/email` | Set or clear the signed-in user's recovery email |
| `POST` | `/api/users/register` | Register a new user |
| `PATCH` | `/api/users/:id` | Update user profile |
| `GET/POST` | `/api/chats` | List / create chats |
| `GET` | `/api/chats/:id/messages` | Fetch chat messages |
| `GET/POST` | `/api/skins` | Skin store catalog |
| `POST` | `/api/translate` | AI translation (`{text, targetLanguage}`) |
| `POST` | `/api/suggest-reply` | AI reply suggestion (`{messages, chatName, myName}`) |
| `POST` | `/api/parental/children` | Create a child account linked to a parent |
| `GET` | `/api/parental/children` | List parent's children (`?parentId=`) |
| `GET` | `/api/parental/children/:id` | Child detail + time restrictions |
| `PUT` | `/api/parental/children/:id/time-restrictions` | Update screen time settings |
| `GET` | `/api/parental/check-access/:childId` | Check if child can use app right now |
| `GET` | `/api/parental/children/:id/contacts` | List contact approval requests |
| `PUT` | `/api/parental/children/:id/contacts/:cid` | Approve or block a contact |
| `GET` | `/api/parental/children/:id/flags` | Get AI-flagged messages |
| `PATCH` | `/api/parental/children/:id/flags/:fid` | Mark a flag reviewed |

---

## 📱 Mobile App Screens

- **Chats** — conversation list with unread badges, search, and swipe actions
- **Chat** — full message thread with AI suggest-reply, auto-translate, media, reactions
- **Calls** — call history
- **Check-ins** — broadcast messages with private per-member responses
- **Profile** — language preference, notification sound, passcode, beta feedback
- **Chat Settings** — per-chat auto-translate language picker, mute, encryption toggle
- **Skin Store** — browse and purchase UI skins with ZivCoin
- **Parental Dashboard** — list all child accounts with unread alert counts, add new children
- **Child Settings** — per-child screen time hours/days, contact approval queue, AI flag log

---

## 🔐 Environment Variables

| Variable | Where | Description |
|---|---|---|
| `PORT` | API server | HTTP listen port. Render sets this; the process binds `0.0.0.0` |
| `DATABASE_URL` | API server | PostgreSQL connection string. On Render use the **Internal** URL from `zivr-db` (direct, not a pooler) so `LISTEN`/`NOTIFY` works |
| `DATABASE_URL_DIRECT` | API server | Optional. Direct session URL used only for the realtime `LISTEN` client when `DATABASE_URL` is a pooler |
| `SESSION_SECRET` | API server | HMAC secret for auth tokens. Copy the existing echo-stream value; do not rotate it |
| `SMTP_HOST` | API server | Migadu SMTP host (`smtp.migadu.com`) |
| `SMTP_PORT` | API server | `465` implicit TLS (default) or `587` STARTTLS |
| `SMTP_USER` | API server | Full Migadu mailbox, e.g. `noreply@zivrapp.com` |
| `SMTP_PASS` | API server | Mailbox password. Set in the host's secret store; never commit it |
| `SMTP_FROM` | API server | Optional From header. Defaults to `SMTP_USER`. Example: `ZIVR <noreply@zivrapp.com>` |
| `RECOVER_EMAIL_MIN_RESPONSE_MS` | API server | Optional. Floor for recover-email responses (default `1500`) |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | API server | Anthropic API key |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | API server | Anthropic API base URL |
| `EXPO_PUBLIC_DOMAIN` | Mobile | Base domain for API + Socket.io |
| `EXPO_PUBLIC_REPL_ID` | Mobile | Replit environment identifier |

---

## 🚢 Deployment

The current live API is still Replit Autoscale at **[https://echo-stream.replit.app](https://echo-stream.replit.app)**. Production is moving to a Render Web Service. Leave echo-stream up until Render health checks and messaging smoke tests pass.

- API: `https://echo-stream.replit.app/api`
- Socket.io: `https://echo-stream.replit.app/api/socket.io`
- Slide deck: `https://echo-stream.replit.app/zivr-deck`

## Deploy on Render

Render can create the web service from the public clone. GitHub OAuth is not required.

Postgres is already provisioned as **`zivr-db`**. Do not create a second database. Put this web service in the **same region** as `zivr-db` so the Internal URL resolves. Use that instance's **Internal Database URL** (direct connection) for `DATABASE_URL`. Do not use a connection pooler: the message bus uses Postgres `LISTEN`/`NOTIFY`, and a pooler accepts `LISTEN` but never delivers notifications. `GET /api/healthz/realtime` reports `busHealthy` and `listenerHostIsPooler`.

`SESSION_SECRET` must be the exact value already used by echo-stream. Do not generate a new one. SMTP is the existing Migadu mailbox (`SMTP_HOST=smtp.migadu.com`). Leave every secret out of git.

Dashboard → **New** → **Web Service** → **Public Git repository**:

| Field | Value |
|---|---|
| Public Git repo URL | `https://github.com/n4h66cvwcw-oss/ZIVR-APP` |
| Branch | `main` |
| Root Directory | *(leave blank — repository root)* |
| Language / Runtime | `Node` |
| Node | `22` (Environment → `NODE_VERSION` = `22`) |
| Instance type | `Starter` (512 MB), **1 instance** |
| Build Command | `corepack enable && corepack prepare pnpm@10.33.4 --activate && NODE_ENV=development pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build` |
| Start Command | `pnpm --filter @workspace/api-server run start` |
| Health Check Path | `/api/healthz` |

`NODE_ENV=development` applies only to install so build tools (`esbuild`) are present. Render still runs the process with `NODE_ENV=production`. The start script runs `node --enable-source-maps ./dist/index.mjs` inside `@workspace/api-server` and listens on `process.env.PORT`.

Environment variables to set on the service (no values in this repo):

| Key | Notes |
|---|---|
| `DATABASE_URL` | `zivr-db` Internal / direct URL |
| `DATABASE_URL_DIRECT` | Optional. Set only if `DATABASE_URL` is not already the direct URL |
| `SESSION_SECRET` | Existing echo-stream secret. Do not rotate |
| `SMTP_HOST` | `smtp.migadu.com` |
| `SMTP_PORT` | `587` (STARTTLS) or `465` (implicit TLS). The server defaults to `465` when unset |
| `SMTP_USER` | Migadu mailbox, `noreply@zivrapp.com` |
| `SMTP_PASS` | That mailbox's password |
| `SMTP_FROM` | Optional. `ZIVR <noreply@zivrapp.com>` |
| `NODE_VERSION` | `22` |

`render.yaml` is the same service (`zivr-api`) as a Blueprint. It does not provision Postgres. After the first deploy, `GET /api/healthz` returns `{"status":"ok"}` and `GET /api/healthz/realtime` returns `busHealthy: true` once `DATABASE_URL` and `SESSION_SECRET` are set. Recover-email stays silent (and still returns `200`) until the SMTP variables are set.

---

## 📄 License

Private — all rights reserved.
