# ZIVR website feature inventory

Read from the mobile client and the API server in this repo. Marketing copy on the homepage should use the **Shipped** list only. The README and `artifacts/mobile/store-metadata.md` describe a different, more ambitious product (end-to-end encryption, live calls, musical messages as a synced type). Those documents are not the source of truth here.

Persistence lives in `artifacts/api-server/src/lib/migrate.ts` (`migrate()`), not in `lib/db/src/schema/index.ts` (an empty Drizzle stub).

## Shipped

Safe to describe on the homepage.

### Account

- Register with a display name. The server returns an auth token and a one-time recovery code. Optional username, phone, avatar, status, preferred language, and Expo push token.
  - `artifacts/api-server/src/routes/users.ts` — `POST /register`, `POST /recover`, `POST /:id/recovery-code`, `PATCH /:id`
  - `artifacts/api-server/src/lib/auth.ts` — `signToken`, `getAuthUserId`
  - `artifacts/mobile/app/onboarding.tsx` — registration and recovery UI

### Live text chat

- Direct chats and group chats (up to 50 members). Text is inserted into `vm_messages` and fanned out on `message:new`.
  - `artifacts/api-server/src/routes/chats.ts` — `POST /direct`, `POST /group`, `GET /:chatId/messages`
  - `artifacts/api-server/src/lib/socket.ts` — `message:send`
  - `artifacts/api-server/src/lib/approvals.ts` — `MAX_GROUP_MEMBERS`, `checkDirectContactAllowed`, `checkGroupContactsAllowed`
- Typing is ephemeral (`typing:start` / `typing:stop`). Read state is stored on `vm_messages.read_at` (`chat:read`) and shown as a read receipt. `is_online` and `last_seen` update when a socket joins and disconnects. The phone shows an Online state from the member list; it does not render last-seen text, and it does not subscribe to the live `user:online` / `user:offline` events.
  - `artifacts/api-server/src/lib/socket.ts`
  - `artifacts/mobile/context/ServerContext.tsx` — `emitTyping`, `emitChatRead`
- Missed messages are returned on reconnect when the client sends `since`.
  - `artifacts/api-server/src/lib/socket.ts` — `user:join`
- Offline members with an `ExponentPushToken` get an Expo push for a new message.
  - `artifacts/api-server/src/lib/push.ts` — `sendExpoPush`
  - `artifacts/api-server/src/lib/socket.ts` — offline member query inside `message:send`
  - `artifacts/mobile/app/_layout.tsx` — push token registration onto the profile

Caveat, not a reason to drop the feature: the mobile outbox asks `message:send` for an ack and then falls back to `POST /api/chats/:chatId/messages`. The socket handler does not ack, and that REST route does not exist (`artifacts/mobile/context/ServerContext.tsx` `deliverOutboxEntry`). The insert and `message:new` fanout are still implemented.

### Scheduled text

- Create, list, edit, and cancel a text message for a future time. A dispatcher inserts it into `vm_messages` when it is due. Parental approval rules match live sends. An approval reminder push is supported.
  - `artifacts/api-server/src/routes/scheduled-messages.ts` — `dispatchDueMessages`
  - `artifacts/api-server/src/index.ts` — `startScheduledMessageDispatcher`
  - `artifacts/mobile/app/schedule-message.tsx`, `artifacts/mobile/app/scheduled.tsx`

This is a clock, not a calendar proposal. Nothing in the API proposes meeting times.

### Translation and suggested replies

- `POST /api/translate` and `POST /api/suggest-reply` call Anthropic. The phone translates before send when a chat has a recipient language, and can drop a suggestion into the composer.
  - `artifacts/api-server/src/routes/translate.ts`
  - `artifacts/api-server/src/routes/suggestReply.ts`
  - `artifacts/mobile/context/ServerContext.tsx` — `translateMessage`, `getSuggestedReply`
  - `artifacts/mobile/utils/languages.ts` — 30 language entries
- If translation fails, the original text is sent.

### Private check-ins

- A member can create a check-in group and send a broadcast. Replies are stored per member. `loadBroadcast` returns reply text only to the broadcast creator and to the member who wrote that reply. Only the creator receives `progress` (`total` / `replied`). A broadcast or reply may include an `audio_attachment` JSON payload, and the check-in screens send and render it.
  - `artifacts/api-server/src/routes/checkins.ts` — `loadBroadcast`, `POST /broadcasts/:broadcastId/replies`
  - `artifacts/api-server/src/lib/socket.ts` — `checkin:send`, `checkin:reply`
  - `artifacts/mobile/context/MessagingContext.tsx` — `sendBroadcast`, `replyToReceivedBroadcast`
  - `artifacts/mobile/app/checkin/[id].tsx`, `checkin/broadcast/[broadcastId].tsx`, `checkin/received/[broadcastId].tsx`

### Parents and child accounts

- A parent creates a child account, can open that child’s session, and sets an allowed start hour, end hour, and days. Outside that window the child app locks. A parent can grant a 1-hour or 2-hour override and end it early.
  - `artifacts/api-server/src/routes/parental.ts` — `POST /children`, `PUT /children/:childId/time-restrictions`, `PUT/DELETE .../override`, `GET /check-access/:childId`
  - `artifacts/mobile/context/ParentalContext.tsx`
  - `artifacts/mobile/app/parental-dashboard.tsx`, `artifacts/mobile/app/parental/[childId].tsx`
  - `artifacts/mobile/utils/time-lock-gate.ts`, `artifacts/mobile/components/TimeLockScreen.tsx`
- A direct chat or group that includes a child stays blocked until the parent approves that contact. Parents can approve or block. The server notifies the parent.
  - `artifacts/api-server/src/lib/approvals.ts`
  - `artifacts/api-server/src/routes/parental.ts` — contact approval routes
- Text in a child’s server chat is scanned asynchronously. Flags are stored with a severity. The parent chooses which severities push: all, medium and up, or high only. A failed scan does not block delivery.
  - `artifacts/api-server/src/lib/socket.ts` — `checkContentForChild`
  - `artifacts/api-server/src/lib/content-alert-preferences.ts` — `CONTENT_ALERT_THRESHOLDS`

There is no separate “sub-profile” model. The account types are standard, parent, and child (`vm_users.account_type` in `migrate.ts`).

### People

- The phone can read device contacts, normalize numbers, and match people who already have a ZIVR account. Everyone else can be invited. The server does not store the address book; lookup is `GET /api/users/find` by phone, username, or query.
  - `artifacts/mobile/hooks/useContactSync.ts`
  - `artifacts/mobile/utils/contact-sync.ts`
  - `artifacts/mobile/app/(tabs)/contacts.tsx`, `artifacts/mobile/app/new-chat.tsx`
  - `artifacts/api-server/src/routes/users.ts` — `GET /find`

### A copy of a server thread

- `GET /api/chats/:chatId/export` returns JSON or text. The phone can also build a PDF, with an optional AI appendix from `POST /api/chat-export-summary` after the user asks for it. Local chats can be uploaded as an opaque backup blob.
  - `artifacts/api-server/src/routes/backup.ts`
  - `artifacts/api-server/src/routes/chatExportSummary.ts`
  - `artifacts/mobile/app/chat-settings/[id].tsx` — `handleExportPDF`

### On-device chat lock

- A chat can be locked with a 4–6 digit passcode hashed on the device.
  - `artifacts/mobile/components/PasscodeModal.tsx`
  - `artifacts/mobile/utils/crypto.ts` — `hashPasscode`
  - `artifacts/mobile/app/chat-settings/[id].tsx`

This is not end-to-end encryption. See the partial list.

## In progress or device-only

Do not describe these as shipped product behavior.

| Capability | What the code actually does | Where |
|---|---|---|
| Reactions | The phone toggles a reaction locally and `POST`s `/chats/:chatId/messages/:messageId/reactions`. The API has no reaction route, socket handler, or table. | `artifacts/mobile/context/ServerContext.tsx` `postMessageReaction`; no match under `artifacts/api-server` |
| Images | The outbox can attach an image data URL and set `type: "image"`. `vm_messages` has no media column. The socket insert ignores `media`. The REST send route the client calls does not exist. | `artifacts/mobile/utils/message-outbox.ts`; `migrate.ts` `vm_messages`; `socket.ts` `message:send` |
| View-once, timed, and password pictures | Security modes are applied in the client composer and bubble. They are not a server feature. | `artifacts/mobile/components/SecurePictureModal.tsx` |
| Audio clips, GIFs, musical cards in normal chat | Chosen and rendered on device. Not written by the API as distinct stored types. Check-in audio attachments are the exception and are listed under shipped. | `artifacts/mobile/components/ChatInput.tsx`, `MusicalMessageModal.tsx`, `GifPickerModal.tsx` |
| Contact cards inside a chat | The widget is on profile and onboarding, not sent as a message type. | `artifacts/mobile/components/ContactCardWidget.tsx` |
| Message edit and delete | Local only. Edits expire after 90 seconds on device. No server route. | `MessagingContext.tsx` `editMessage`, `deleteMessage` |
| “Away” presence | The client emits `user:away`. The server never handles it. | `ServerContext.tsx`; no `user:away` in `artifacts/api-server` |
| Private side chats off a check-in | Stored in AsyncStorage on that phone. Not a server table. | `MessagingContext.tsx` `sendPrivateSideChat` |
| Calls | A local timer and history. Nothing sets an incoming call from the network. No WebRTC. | `artifacts/mobile/context/CallContext.tsx`, `app/call/[id].tsx` |
| End-to-end encryption | A per-chat AES key can be generated and kept in AsyncStorage. Server rows store `text`. `is_encrypted` is never set on insert. The privacy page in this site already says ZIVR is not an end-to-end encrypted messenger. | `MessagingContext.tsx`; `migrate.ts`; `artifacts/zivr-website/src/pages/privacy.tsx` |
| Screen-capture guard | Best-effort OS hook plus an overlay, when the user turns it on. | `artifacts/mobile/components/ScreenCaptureGuard.tsx` |
| Skin store and ZivCoin | Skins and coin balance are local. `POST /api/skins/generate` returns JSON and does not record a purchase. In-app coin packs need a full build, not Expo Go. | `artifacts/mobile/context/SkinContext.tsx`, `utils/purchases.ts`, `artifacts/api-server/src/routes/skins.ts` |
| Search and favorites | Search runs over messages already on the device. Favorites are local. | `artifacts/mobile/app/search.tsx`, `context/FavoritesContext.tsx` |
| Home screen widgets | Settings screen only. Nothing is persisted and there is no widget extension in this tree. | `artifacts/mobile/app/widget-settings.tsx` |
| Beta feedback delivery | A local “ZIVR Beta Feedback” chat exists. The forward email is empty and the API post is commented out. | `artifacts/mobile/utils/betaFeedback.ts` |
| Child PIN at creation | The parental create route accepts `pin` and does not store it. | `artifacts/api-server/src/routes/parental.ts` `POST /children` |

## Not in the repo

Do not mention these except as something the product does not do, if a limit needs to be stated.

- Agent bridge, MCP connectors, or AI agents messaging each other. No routes, tables, or client modules.
- Sub-profiles beyond the parent/child account type above.
- Calendar propose / meeting suggestions. Date icons in search are filters only (`artifacts/mobile/app/search.tsx`).
- A public TestFlight URL. `artifacts/mobile/eas.json` has internal/production build profiles and placeholder Apple ids. This inventory does not change that file. The homepage must not invent an invite link.
- A public App Store or Play listing. The site only links one if `VITE_ZIVR_APP_STORE_URL` or `VITE_ZIVR_GOOGLE_PLAY_URL` is a real store URL (`artifacts/zivr-website/.env.example`).

## Homepage decisions

Used: private check-ins, parent approval, hours and short overrides, safety-flag severity, live text (typing, read receipts, online state from the member list, push), scheduled texts, translation, suggested replies, phone contacts and username lookup, on-device passcode, server export / PDF, and the honest limit that server messages are not end-to-end encrypted and the Calls tab is not a live call.

Left off the page as unshipped or device-only: reactions sync, image and rich-media chat, musical messages, skins, side chats, widgets, agent/MCP, calendar propose, and true end-to-end encryption.
