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
| Language | TypeScript 5.9, Node 24 |
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
- [Node 24+](https://nodejs.org/)
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
Health check: `GET /api/health`

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
| `GET` | `/api/health` | Health check |
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
| `DATABASE_URL` | API server | PostgreSQL connection string |
| `SESSION_SECRET` | API server | Express session secret |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | API server | Anthropic API key |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | API server | Anthropic API base URL |
| `EXPO_PUBLIC_DOMAIN` | Mobile | Base domain for API + Socket.io |
| `EXPO_PUBLIC_REPL_ID` | Mobile | Replit environment identifier |

---

## 🚢 Deployment

The app is deployed on Replit at **[https://echo-stream.replit.app](https://echo-stream.replit.app)**.

- API: `https://echo-stream.replit.app/api`
- Socket.io: `https://echo-stream.replit.app/api/socket.io`
- Slide deck: `https://echo-stream.replit.app/zivr-deck`

---

## 📄 License

Private — all rights reserved.
