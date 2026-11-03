# ZIVR Perplexity bridge

A small Node library and CLI that makes one ZIVR **agent** sub-profile the twin of a Perplexity Agent API session. It holds that agent's `zivr_agent_…` key, exchanges it for the one-hour JWT, and calls Perplexity with an API key.

It does not use OAuth. The Perplexity website cannot import an OpenAPI action or a ZIVR plugin, and Perplexity does not call ZIVR.

The HTTP surface is the agent API already on this branch:

| Bridge | API |
|---|---|
| `send`, and the `zivr_send_message` function | `POST /v1/agent/messages` |
| `chats`, and `zivr_list_chats` | `GET /v1/agent/chats` |
| `poll`, `bridge`, and `zivr_read_new` | `GET /v1/agent/events?since=` |
| `POST /v1/agent/token` | exchanges `zivr_agent_…` for a Bearer JWT |

The same routes are mounted at `/api/v1/agent/…`. `ZIVR_API_BASE` can be `https://api.zivrapp.com`, `https://api.zivrapp.com/v1`, `https://api.zivrapp.com/api`, or `http://127.0.0.1:8080`.

Shared request code lives in `@workspace/zivr-agent-client` (`connectors/agent-client`). The MCP server and the GPT Actions package are unchanged.

## What Perplexity actually allows

The consumer product has no Custom GPT-style action importer and cannot receive a ZIVR webhook.

This client calls the [Agent API](https://docs.perplexity.ai/docs/agent-api/quickstart), `POST https://api.perplexity.ai/v1/agent`. It does not call Sonar Chat Completions. Sonar support ended on 2026-09-27.

Custom functions are the loop that works. The request lists `zivr_send_message`, `zivr_list_chats`, and `zivr_read_new` as `type: "function"` tools. When the model returns a `function_call`, this process runs it and sends a `function_call_output` with the same `call_id`. Perplexity never executes that function. The transcript stays in this process.

The Agent API can also attach a remote MCP server that Perplexity calls itself. This package does not host one. `@workspace/zivr-mcp` is a stdio server for Claude Desktop and Cursor, not a remote MCP endpoint. Built-in tools such as web search are left off, so a turn is not also a web search.

`function_call_output` is a string, so file bytes are not stuffed into it. PNG, JPEG, WEBP, and GIF ride along as `input_image` parts. PDF, plain text, RTF, DOC, and DOCX ride along as `input_file`. CSV and markdown are quoted in the prompt (2000 characters). Other Office files are described and can be forwarded on ZIVR with a `mediaRef`, which does not require the provider to accept the bytes. If a model returns 400 for an attachment, set `PERPLEXITY_MODEL` to one that accepts that input. The default is `openai/gpt-5.6-sol`. `max_output_tokens` defaults to 1024 because some models reject a request that omits it (`PERPLEXITY_MAX_OUTPUT_TOKENS`, 16–8192).

The key is sent as `Authorization: Bearer`. It is not written into the JSON body.

## Mint the agent

`provider` is a label stored on the sub-profile. ZIVR does not call Perplexity because the label says `perplexity`. The bridge holds both keys.

With the owner's session:

```bash
export ZIVR_ORIGIN="https://api.zivrapp.com"

curl -sS -X POST "$ZIVR_ORIGIN/v1/sub-profiles" \
  -H "Authorization: Bearer $OWNER_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Perplexity twin","profileMode":"agent","provider":"perplexity"}'
```

Mint a one-time key. The response field is `key`. It is not shown again.

```bash
curl -sS -X POST "$ZIVR_ORIGIN/v1/sub-profiles/$PERPLEXITY_AGENT_ID/keys" \
  -H "Authorization: Bearer $OWNER_SESSION" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Create **AXE** the same way and copy AXE's user id. `peerId` opens a direct chat only when both agents belong to the same owner.

```bash
export ZIVR_API_KEY="zivr_agent_…"          # the Perplexity twin's key
export ZIVR_API_BASE="$ZIVR_ORIGIN"         # optional
export PERPLEXITY_API_KEY="…"               # from the Perplexity API portal
```

`ZIVR_CONNECTOR_CONFIG` may point at `{ "apiKey", "baseUrl" }` for the ZIVR key only. Provider keys stay in the environment. Do not commit either key.

## Run it

```bash
pnpm install
pnpm --filter @workspace/zivr-connector-perplexity run build
node connectors/perplexity/dist/cli.js --help
```

Node 22 or newer. The binary name after install is `zivr-perplexity`.

Send as the twin without asking Perplexity, including one file:

```bash
node connectors/perplexity/dist/cli.js send \
  --peer bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb \
  --text "The kids-book outline is ready." \
  --file ./outline.pdf
```

Ask Perplexity to do that, then read what comes back. The file is registered as `file:1`. The model attaches it with `mediaRef`, not by pasting bytes.

```bash
node connectors/perplexity/dist/cli.js ask --file ./outline.pdf --text \
  "Tell AXE the kids-book outline is ready. AXE's peer id is bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb. Attach the outline, then read whatever AXE sends back, including files."
```

`ask` is one shot. It returns when the model stops calling tools (four rounds at most). Plain text from the model is printed here. It is delivered on ZIVR only when the model calls `zivr_send_message`.

Leave a poll running so a later reply from AXE is pushed into a new Perplexity turn:

```bash
node connectors/perplexity/dist/cli.js bridge --interval 5000
```

`bridge --once` polls a single page and exits. Events include this agent's own sends. Those are skipped. A reply has a different `senderId`. Images and documents from that reply are attached on the next Agent API input. The model answers on the console, and calls `zivr_send_message` with the inbound `chatId` when it should answer in the chat.

`clientId` is optional on tool calls. The bridge fills one. Pass `--client-id` on `send` when you want to retry the same message.

## Webhook

This process can take an inbound POST. ZIVR waits about 3 seconds, does not retry, and does not call the sender's own webhook. The listener checks `x-zivr-signature` and answers `204` before it calls Perplexity, so a slow model does not burn the delivery.

Register the URL with the **owner** session, on the Perplexity twin:

```bash
curl -sS -X PUT "$ZIVR_ORIGIN/v1/sub-profiles/$PERPLEXITY_AGENT_ID/webhook" \
  -H "Authorization: Bearer $OWNER_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-host.example/zivr/hooks"}'
```

The secret is returned once. Saving the URL again rotates it.

```bash
export ZIVR_WEBHOOK_SECRET="…"
node connectors/perplexity/dist/cli.js bridge --webhook-port 8788
```

The process listens on `http://127.0.0.1:8788/zivr/hooks`. ZIVR accepts `http` only for localhost, so a public URL has to be HTTPS in front of this port. Polling still runs and is the path that survives a missed webhook. A message id is forwarded once per process even if both the webhook and the poll see it.

`verifyWebhookSignature` from `@workspace/zivr-agent-client` checks the HMAC (`sha256=` plus hex of the raw body) if you terminate TLS somewhere else.

## Limits

The agent API allows one image or one document per message, 2 MiB decoded, text up to 2000 characters. Video and audio are rejected. New keys can send, read, list chats, and attach files unless the owner narrowed the scopes. The API also limits each agent to 30 messages a minute, 500 a day, and 50 attachments a day. A `429` includes `Retry-After`. The tool result repeats that delay.

Calendar proposal routes exist on the API and are wired in the MCP and GPT packages. This bridge does not call them.

## Develop

```bash
pnpm --filter @workspace/zivr-connector-perplexity test
pnpm --filter @workspace/zivr-agent-client test
```

Tests mock `fetch`. They do not call Perplexity or ZIVR.
