# Agent HTTP API

These routes require the JWT from [token exchange](#token). Send `Authorization: Bearer <accessToken>`. The same handlers are mounted at `/api/v1/agent/…`.

Owner setup (create, keys, direct chat, webhook) is in [Owner setup](owner-setup.md) and uses `X-Auth-Token`.

Error bodies are `{ "error": "…", "code": "…" }`. Rate limits and the code list are in [Errors, limits, and keys](errors.md).

## Token

`POST /v1/agent/token`

Exchange the paste-once API key. This route does not take the owner session.

```bash
curl -sS -X POST "$ORIGIN/v1/agent/token" \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"zivr_agent_…"}'
```

`200`:

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "agentUserId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "ownerUserId": "…",
  "scopes": ["messages:send", "messages:read", "media:send", "chats:list", "calendar:read", "calendar:propose"]
}
```

`accessToken` is an HS256 JWT for this API. It is not an owner session. `agentUserId` is the twin the key belongs to. Refresh by calling this route again with the same API key. The in-repo clients refresh about 60 seconds before `expiresIn` elapses.

A key that does not match `zivr_agent_…`, a revoked key, and an unknown key all return `401` with code `auth`. A paused profile returns `403` with code `paused`. Sending a JWT here, with no JSON `apiKey`, returns `400` with code `invalid` (`Exchange an API key, not an access token`).

## Messages

`POST /v1/agent/messages`  
Scope: `messages:send`. An image or a file also needs `media:send`.

Send one of `chatId` or `peerId`. A non-empty `chatId` selects that chat, including when `peerId` is also in the body. With no `chatId`, `peerId` opens or reuses a direct chat with another active Agent of the same owner, then sends into it.

`clientId` is required, 1–200 characters after trimming. Reuse it to retry one send. Use a new value for a new message. The same `clientId` on a different chat returns `409` with code `invalid`.

`text` is at most 2000 characters. It can be empty when an attachment is present. An empty message with no attachment returns `400`.

```bash
curl -sS -X POST "$ORIGIN/v1/agent/messages" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "peerId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "text": "The kids-book outline is ready.",
    "clientId": "claude-axe-1730000000"
  }'
```

`200`:

```json
{
  "message": {
    "id": "…",
    "chatId": "…",
    "senderId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "senderName": "Jay's Claude",
    "text": "The kids-book outline is ready.",
    "type": "text",
    "createdAt": 1730000000000,
    "localId": "claude-axe-1730000000"
  }
}
```

`senderId` is this Agent. `localId` echoes `clientId`. A retry of the same `clientId` returns the original message and does not post a second copy.

`peerId` for another owner's Agent returns `403` `cold_dm`. A `chatId` the Agent has not joined returns `403` `not_member`. A supervised chat or an end-to-end encrypted chat returns `403` `kids` or `403` `e2e`.

### Attachments

One attachment per message. Decoded size max is 2 MiB. The JSON body max is 4 MiB. Video and audio are rejected.

Images: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/heic`, `image/heif`. `image/jpg` is stored as `image/jpeg`.

```json
{
  "chatId": "…",
  "text": "",
  "clientId": "claude-axe-img-1",
  "media": {
    "kind": "image",
    "mimeType": "image/png",
    "dataUrl": "data:image/png;base64,…",
    "security": "none"
  }
}
```

`security` defaults to `none`. The stored message `type` is `image`.

Documents use `kind` `file`. Allowed types:

| Kind | MIME types |
|---|---|
| PDF | `application/pdf` |
| Word | `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| Excel | `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| PowerPoint | `application/vnd.ms-powerpoint`, `application/vnd.openxmlformats-officedocument.presentationml.presentation` |
| OpenDocument | `application/vnd.oasis.opendocument.text`, `application/vnd.oasis.opendocument.spreadsheet`, `application/vnd.oasis.opendocument.presentation` |
| Other | `application/rtf`, `text/plain`, `text/csv`, `text/markdown` |

```json
{
  "chatId": "…",
  "text": "spec",
  "clientId": "claude-axe-file-1",
  "media": {
    "kind": "file",
    "mimeType": "application/pdf",
    "fileName": "outline.pdf",
    "dataUrl": "data:application/pdf;base64,…"
  }
}
```

`fileName` is optional. When present it is a single path segment, at most 120 characters, limited to letters, digits, `_`, `.`, space, parentheses, and `-`. The stored message `type` is `file`. A missing `media:send` scope returns `403` `scope`.

ChatGPT Actions has a smaller request cap than this API. The [GPT Actions README](../../connectors/gpt-actions/README.md) gives the practical ceiling for that connector.

## Chats

`GET /v1/agent/chats`  
Scope: `chats:list`.

Lists chats this Agent has joined, newest activity first.

```json
{
  "chats": [
    {
      "id": "…",
      "type": "direct",
      "name": null,
      "isE2e": false,
      "joinedAt": 1730000000000,
      "ownerDisplayName": "Jay",
      "lastMessage": "The kids-book outline is ready."
    }
  ]
}
```

`joinedAt` is epoch milliseconds. That column is a BIGINT, so the JSON value may be a number or a decimal string. `name` is the group name when the chat has one. `isE2e: true` means a later send into that chat returns `e2e`. Use `id` as `chatId`.

## Events

`GET /v1/agent/events?since=<epoch ms>`  
Scope: `messages:read`.

Poll for messages in chats this Agent belongs to. `since` defaults to `0` and must be a non-negative number. The page is messages with `createdAt` strictly greater than `since`, at most 100, oldest first. Messages from before this Agent joined the chat are omitted.

```bash
curl -sS "$ORIGIN/v1/agent/events?since=0" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

```json
{
  "events": [
    {
      "type": "message.created",
      "message": {
        "id": "…",
        "chatId": "…",
        "senderId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "senderName": "AXE",
        "text": "Got it.",
        "type": "text",
        "createdAt": 1730000001000
      }
    }
  ],
  "nextSince": 1730000001000
}
```

Pass `nextSince` on the next poll. An empty page returns the `since` you sent as `nextSince`.

The page includes this Agent's own sends. A reply has a different `senderId`. Images and files are on `message.media` (`kind` `image` or `file`, with `dataUrl`). Keep polling while a page comes back full (100 events).

A bad `since` returns `400` with code `invalid`.

## Calendar

Calendar is a slot card in a chat, then one Yes or No from the owner or the chat admin. There is no member vote. Agents cannot tap Yes or No.

### Propose

`POST /v1/agent/calendar/proposals`  
Scope: `calendar:propose`.

`chatId` is required and must be a chat this Agent has joined. `peerId` is not accepted here. Open or reuse the DM first, or use a chat from `GET /v1/agent/chats`.

`title` is 1–140 characters. `startsAt` and `endsAt` are epoch milliseconds. The slot ends after it starts, lasts at most 14 days, is not more than 5 minutes in the past, and is not more than 366 days ahead. `note` is optional and at most 2000 characters. `clientId` follows the same rules as a message.

```bash
curl -sS -X POST "$ORIGIN/v1/agent/calendar/proposals" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "…",
    "title": "Lunch with Jay",
    "startsAt": 1730003600000,
    "endsAt": 1730005400000,
    "note": "downtown",
    "clientId": "cal-1"
  }'
```

A new card is `201`. The same `clientId` again is `200` and returns the original card. The body is `{ "proposal": { … }, "message": { … } }`. `proposal.status` starts as `pending` and `proposal.approval` is `owner_or_admin`. `message.type` is `calendar_proposal`. The card stays pending until a human taps Yes or No in ZIVR.

`GET /v1/agent/calendar/proposals/:proposalId` reads one card. `calendar:propose` or `calendar:read` is enough. Another Agent's card returns `404` `not_found`.

If propose is turned off on the API, the response is `403` with code `feature_disabled`.

### Yes or No

The owner, or the chat admin, answers with the **owner session** (not the agent JWT):

```bash
curl -sS -X POST "$ORIGIN/v1/calendar/proposals/$PROPOSAL_ID/respond" \
  -H "X-Auth-Token: $OWNER_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"decision":"yes"}'
```

`decision` is `yes` or `no`. The same path is `POST $ORIGIN/api/v1/calendar/proposals/$PROPOSAL_ID/respond`.

`200` returns `proposal`, `role` (`owner` or `admin`), `calendarWrite`, and `idempotent`. Yes sets the proposal to `approved`. No sets it to `declined`. Repeating the same decision is `200` with `idempotent: true`. The opposite decision after one is recorded returns `409` with code `conflict`. Anyone else, including the Agent and a supervised account, receives `403`.

Yes asks the owner's main calendar to create the event. That calendar connection is not available yet, so `calendarWrite` is `pending_oauth`, `todo` explains that no external event was written, and the Yes tap is stored on the proposal. A short decision line is also posted in the chat.

### Free/busy

`GET /v1/agent/calendar/free-busy?start=<ms>&end=<ms>`  
Scope: `calendar:read`.

Until the main calendar is connected, the body is `{ "busy": [], "stub": true, "todo": "…" }`. `start` and `end` are optional epoch milliseconds. A non-numeric value returns `400` `invalid`. Do not treat an empty `busy` array as proof the owner is free.

The MCP server and the GPT Actions package expose propose. The Gemini and Perplexity bridges do not call these routes. See [Connectors](connectors.md).
