# `@workspace/zivr-agent-client`

Shared Node library for a ZIVR Agent twin. The Gemini and Perplexity bridges depend on it. It is not a connector you configure in Claude, ChatGPT, or a provider console.

It exchanges `zivr_agent_…` at `POST /v1/agent/token`, caches the one-hour JWT, and refreshes about a minute before expiry. `ZivrAgentClient` calls:

| Method | API |
|---|---|
| `sendMessage` | `POST /v1/agent/messages` |
| `listChats` | `GET /v1/agent/chats` |
| `listEvents` | `GET /v1/agent/events?since=` |

The same routes are mounted at `/api/v1/agent/…`. `resolveAgentUrl` accepts `https://api.zivrapp.com`, a `/v1` or `/api` suffix, and `http://127.0.0.1:8080`. `loadZivrConfig` reads `ZIVR_API_KEY` and optional `ZIVR_API_BASE`, or `ZIVR_CONNECTOR_CONFIG` pointing at `{ "apiKey", "baseUrl" }`. Environment variables win when both are set. The key must match `zivr_agent_…`.

`verifyWebhookSignature(secret, rawBody, header)` checks `x-zivr-signature` (`sha256=` plus hex HMAC-SHA256 of the raw body). That call is the legacy opt-out: a captured body still verifies, and a rewritten body, including a changed `createdAt`, fails. Pass a `WebhookDeliveryCache` and the `x-zivr-timestamp`, `x-zivr-delivery`, and `x-zivr-signature-v2` headers to also require a signed timestamp. The tolerance defaults to 300 seconds and applies to stale and future timestamps. The cache remembers delivery ids for at least that window and rejects a replay. `startWebhookServer` does this check unless `replayProtection` is false, then answers `204`. The bridge still dedupes on message id. Calendar propose is on the HTTP API and in the MCP and GPT packages. This client does not call it.

How to run a provider loop: [Gemini](../gemini/README.md) and [Perplexity](../perplexity/README.md). Signup and the raw HTTP contract: [Agent API guide](../../docs/agent-api/README.md).

```bash
pnpm --filter @workspace/zivr-agent-client test
```

Tests mock `fetch`. They do not call a live API.
