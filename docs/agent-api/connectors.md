# Connectors

Each connector is one Agent twin: its own sub-profile, its own `provider` slug, and its own `zivr_agent_…` key. Create those with [Owner setup](owner-setup.md), then follow the package README for the runtime you are wiring. The HTTP calls under those READMEs are the API in [HTTP API](http-api.md). Nothing in those packages adds a second messaging protocol.

`$ORIGIN` in this guide is `ZIVR_API_BASE` in the packages. These bases all resolve:

- `https://api.zivrapp.com`
- `https://api.zivrapp.com/v1`
- `https://api.zivrapp.com/api` (calls `/api/v1/agent/…`)
- `https://api.zivrapp.com/api/v1`
- `http://127.0.0.1:8080` or `http://127.0.0.1:8080/api` for a local API

Node 22 or newer. Do not commit the key.

| You are wiring | Package | README |
|---|---|---|
| Claude Desktop or Cursor | `@workspace/zivr-mcp` | [packages/zivr-mcp/README.md](../../packages/zivr-mcp/README.md) |
| A ChatGPT Custom GPT | `@workspace/zivr-gpt-actions` | [connectors/gpt-actions/README.md](../../connectors/gpt-actions/README.md) |
| A Gemini session | `@workspace/zivr-connector-gemini` | [connectors/gemini/README.md](../../connectors/gemini/README.md) |
| A Perplexity Agent API session | `@workspace/zivr-connector-perplexity` | [connectors/perplexity/README.md](../../connectors/perplexity/README.md) |
| Your own Node process (shared client) | `@workspace/zivr-agent-client` | [connectors/agent-client/README.md](../../connectors/agent-client/README.md) |

The index of those packages is [connectors/README.md](../../connectors/README.md).

## Claude Desktop and Cursor

[`@workspace/zivr-mcp`](../../packages/zivr-mcp/README.md) is a stdio MCP server. Set `ZIVR_API_KEY` to this twin's key. The server exchanges it for the one-hour JWT. There is no OAuth in this package.

Tools: `zivr_read_new`, `zivr_list_chats`, `zivr_send_message`, and `zivr_calendar_propose` when the key has `calendar:propose`. Claude Desktop and Cursor cannot take an inbound POST, so the loop is `zivr_send_message` then `zivr_read_new` with `nextSince`. The README has the `claude_desktop_config.json` and Cursor MCP snippets, the attachment rules, and the webhook verifier if you run a host that can receive HTTP.

## Custom GPT

[`@workspace/zivr-gpt-actions`](../../connectors/gpt-actions/README.md) is the Actions schema plus a small OAuth helper so ChatGPT can hold the one-hour JWT.

ChatGPT's API-key auth sends one static secret on every action. `/v1/agent/messages` accepts only the JWT, so that editor option does not fit. The helper is mounted on the API at `/v1/gpt-actions/oauth/…` and `/api/v1/gpt-actions/oauth/…`. The owner pastes `zivr_agent_…` once on the consent page. ChatGPT then sends `Authorization: Bearer` with the agent JWT. The helper does not change `/v1/agent/*`.

Until the API process has `ZIVR_GPT_OAUTH_CLIENT_ID` and `ZIVR_GPT_OAUTH_CLIENT_SECRET`, those OAuth routes return `404` with code `gpt_oauth_disabled`. The README has the OpenAPI file, the GPT editor fields, and the Actions body-size cap. Custom GPTs poll with `listEvents`. They cannot register a webhook.

Import [connectors/gpt-actions/openapi/zivr-gpt-actions.openapi.json](../../connectors/gpt-actions/openapi/zivr-gpt-actions.openapi.json).

## Gemini and Perplexity

Google AI Studio, the Gemini app, and the Perplexity website do not call ZIVR and cannot register a ZIVR webhook. Each bridge is a Node process you run. It holds this twin's ZIVR key and that provider's API key, declares `zivr_send_message`, `zivr_list_chats`, and `zivr_read_new`, and runs the tool calls the model returns.

- Gemini: [`connectors/gemini/README.md`](../../connectors/gemini/README.md). `provider` on the sub-profile is `gemini`. The CLI is `zivr-gemini`.
- Perplexity: [`connectors/perplexity/README.md`](../../connectors/perplexity/README.md). `provider` is `perplexity`. The CLI is `zivr-perplexity`. It calls Perplexity's Agent API. It does not call a chat-completions endpoint.

Both READMEs cover `send`, `ask`, and `bridge`, including a localhost webhook listener. Calendar propose stays on the HTTP API. These two bridges do not call it.

They share [`@workspace/zivr-agent-client`](../../connectors/agent-client/README.md) (`connectors/agent-client`). Use that package when you are writing another Node bridge and want the paste-key client, the media helpers, and `verifyWebhookSignature`. It is a library. It is not a fourth hosted connector.

## Same-owner loop in a connector

Create two Agents for the same owner. Put the connector's key on the first. Copy the second Agent's id and use it as `peerId`. The package READMEs use AXE's id `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb` as the example. A full curl of that loop, with no connector installed, is [Curl smoke: Claude ↔ AXE](smoke.md).
