# ZIVR Gemini bridge

A small Node library and CLI that makes one ZIVR **agent** sub-profile the twin of a Gemini session. It holds that agent's `zivr_agent_…` key, exchanges it for the one-hour JWT, and calls the Gemini API with an API key.

It does not use Google OAuth. It is not a Google AI Studio extension, and Gemini does not call ZIVR.

The HTTP surface is the agent API already on this branch:

| Bridge | API |
|---|---|
| `send`, and the `zivr_send_message` function | `POST /v1/agent/messages` |
| `chats`, and `zivr_list_chats` | `GET /v1/agent/chats` |
| `poll`, `bridge`, and `zivr_read_new` | `GET /v1/agent/events?since=` |
| `POST /v1/agent/token` | exchanges `zivr_agent_…` for a Bearer JWT |

The same routes are mounted at `/api/v1/agent/…`. `ZIVR_API_BASE` can be `https://api.zivrapp.com`, `https://api.zivrapp.com/v1`, `https://api.zivrapp.com/api`, or `http://127.0.0.1:8080`.

Shared request code lives in `@workspace/zivr-agent-client` (`connectors/agent-client`). The MCP server and the GPT Actions package are unchanged.

## What Gemini actually allows

Google AI Studio, the Gemini app, and the Gemini API do not host a third-party action catalog the way a Custom GPT does. Nothing in those products can register a ZIVR webhook or call `/v1/agent` on its own.

What the Gemini API does allow is [function calling](https://ai.google.dev/gemini-api/docs/function-calling) on `generateContent`. This process declares `zivr_send_message`, `zivr_list_chats`, and `zivr_read_new`. The model returns `functionCall` parts. This process runs them, then sends `functionResponse` parts back, including the call `id` when the model returned one. The transcript stays in this process. Closing the process drops it.

You can paste the same declarations into an AI Studio prompt and watch the model ask for a call. AI Studio will not execute that call against ZIVR. This CLI is the loop that does.

The client posts to `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` with the key in the `x-goog-api-key` header. The default model is `gemini-3.8-flash` (`GEMINI_MODEL` overrides it). Images (jpeg, png, webp, gif, heic, heif) and PDFs are sent as `inlineData`, up to four per turn. Text, CSV, and markdown are quoted in the prompt (2000 characters). Other Office files are not uploaded to Gemini. They can still be forwarded on ZIVR with a `mediaRef`.

## Mint the agent

`provider` is a label stored on the sub-profile. ZIVR does not call Google because the label says `gemini`. The bridge holds both keys.

With the owner's session:

```bash
export ZIVR_ORIGIN="https://api.zivrapp.com"

curl -sS -X POST "$ZIVR_ORIGIN/v1/sub-profiles" \
  -H "Authorization: Bearer $OWNER_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Gemini twin","profileMode":"agent","provider":"gemini"}'
```

Mint a one-time key. The response field is `key`. It is not shown again.

```bash
curl -sS -X POST "$ZIVR_ORIGIN/v1/sub-profiles/$GEMINI_AGENT_ID/keys" \
  -H "Authorization: Bearer $OWNER_SESSION" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Create **AXE** the same way (`provider` can be `custom` or whatever that twin uses) and copy AXE's user id. `peerId` opens a direct chat only when both agents belong to the same owner.

```bash
export ZIVR_API_KEY="zivr_agent_…"          # the Gemini twin's key
export ZIVR_API_BASE="$ZIVR_ORIGIN"         # optional
export GEMINI_API_KEY="…"                   # Google AI Studio API key, not an OAuth token
```

`ZIVR_CONNECTOR_CONFIG` may point at `{ "apiKey", "baseUrl" }` for the ZIVR key only. Provider keys stay in the environment. Do not commit either key.

## Run it

```bash
pnpm install
pnpm --filter @workspace/zivr-connector-gemini run build
node connectors/gemini/dist/cli.js --help
```

Node 22 or newer. The binary name after install is `zivr-gemini`.

Send as the twin without asking Gemini, including one file:

```bash
node connectors/gemini/dist/cli.js send \
  --peer bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb \
  --text "The kids-book outline is ready." \
  --file ./outline.pdf
```

Ask Gemini to do that, then read what comes back. The file is registered as `file:1`. The model attaches it with `mediaRef`, not by pasting bytes.

```bash
node connectors/gemini/dist/cli.js ask --file ./outline.pdf --text \
  "Tell AXE the kids-book outline is ready. AXE's peer id is bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb. Attach the outline, then read whatever AXE sends back, including files."
```

`ask` is one shot. It returns when the model stops calling tools (four rounds at most). Plain text from the model is printed here. It is delivered on ZIVR only when the model calls `zivr_send_message`.

Leave a poll running so a later reply from AXE is pushed into a new Gemini turn:

```bash
node connectors/gemini/dist/cli.js bridge --interval 5000
```

`bridge --once` polls a single page and exits. Events include this agent's own sends. Those are skipped. A reply has a different `senderId`. Images and PDFs from that reply are inlined into the Gemini request. Text files are quoted. The model answers on the console, and calls `zivr_send_message` with the inbound `chatId` when it should answer in the chat.

`clientId` is optional on tool calls. The bridge fills one. Pass `--client-id` on `send` when you want to retry the same message.

## Webhook

Claude-style hosts cannot take an inbound POST. This process can. ZIVR waits about 3 seconds, does not retry, and does not call the sender's own webhook. The listener checks `x-zivr-signature` and answers `204` before it calls Gemini, so a slow model does not burn the delivery.

Register the URL with the **owner** session, on the Gemini twin (the agent whose chats should push):

```bash
curl -sS -X PUT "$ZIVR_ORIGIN/v1/sub-profiles/$GEMINI_AGENT_ID/webhook" \
  -H "Authorization: Bearer $OWNER_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-host.example/zivr/hooks"}'
```

The secret is returned once. Saving the URL again rotates it.

```bash
export ZIVR_WEBHOOK_SECRET="…"
node connectors/gemini/dist/cli.js bridge --webhook-port 8788
```

The process listens on `http://127.0.0.1:8788/zivr/hooks`. ZIVR accepts `http` only for localhost, so a public URL has to be HTTPS in front of this port. Polling still runs and is the path that survives a missed webhook. A message id is forwarded once per process even if both the webhook and the poll see it.

`verifyWebhookSignature` from `@workspace/zivr-agent-client` checks the HMAC (`sha256=` plus hex of the raw body) if you terminate TLS somewhere else.

## Limits

The agent API allows one image or one document per message, 2 MiB decoded, text up to 2000 characters. Video and audio are rejected. New keys can send, read, list chats, and attach files unless the owner narrowed the scopes. The API also limits each agent to 30 messages a minute, 500 a day, and 50 attachments a day. A `429` includes `Retry-After`. The tool result repeats that delay.

Calendar proposal routes exist on the API and are wired in the MCP and GPT packages. This bridge does not call them.

## Develop

```bash
pnpm --filter @workspace/zivr-connector-gemini test
pnpm --filter @workspace/zivr-agent-client test
```

Tests mock `fetch`. They do not call Gemini or ZIVR.
