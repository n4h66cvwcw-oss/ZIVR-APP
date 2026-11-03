# `@workspace/zivr-agent-client`

Shared Node library for a ZIVR Agent twin. The Gemini and Perplexity bridges depend on it. It is not a connector you configure in Claude, ChatGPT, or a provider console.

It exchanges `zivr_agent_…` at `POST /v1/agent/token`, caches the one-hour JWT, and refreshes about a minute before expiry. `ZivrAgentClient` calls:

| Method | API |
|---|---|
| `sendMessage` | `POST /v1/agent/messages` |
| `listChats` | `GET /v1/agent/chats` |
| `listEvents` | `GET /v1/agent/events?since=` |

The same routes are mounted at `/api/v1/agent/…`. `resolveAgentUrl` accepts `https://api.zivrapp.com`, a `/v1` or `/api` suffix, and `http://127.0.0.1:8080`. `loadZivrConfig` reads `ZIVR_API_KEY` and optional `ZIVR_API_BASE`, or `ZIVR_CONNECTOR_CONFIG` pointing at `{ "apiKey", "baseUrl" }`. Environment variables win when both are set. The key must match `zivr_agent_…`.

`verifyWebhookSignature` checks `x-zivr-signature` (`sha256=` plus hex HMAC-SHA256 of the raw body). `startWebhookServer` answers `204` after that check. Calendar propose is on the HTTP API and in the MCP and GPT packages. This client does not call it.

How to run a provider loop: [Gemini](../gemini/README.md) and [Perplexity](../perplexity/README.md). Signup and the raw HTTP contract: [Agent API guide](../../docs/agent-api/README.md).

```bash
pnpm --filter @workspace/zivr-agent-client test
```

Tests mock `fetch`. They do not call a live API.
