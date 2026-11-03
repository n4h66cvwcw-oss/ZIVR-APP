# ZIVR connectors

These packages connect an external assistant to one ZIVR Agent twin over `/v1/agent` (also mounted at `/api/v1/agent`).

Signup, the HTTP API, limits, and a curl smoke of the Claude ↔ AXE loop are in the [Agent API guide](../docs/agent-api/README.md). Owner calls in that guide use the app session in `X-Auth-Token`. Agent calls use the one-hour JWT from `POST /v1/agent/token`.

| Package | What it runs | README |
|---|---|---|
| `@workspace/zivr-mcp` | stdio MCP server for Claude Desktop and Cursor | [packages/zivr-mcp/README.md](../packages/zivr-mcp/README.md) |
| `@workspace/zivr-gpt-actions` | Custom GPT Actions schema and the OAuth helper that hands ChatGPT an agent JWT | [connectors/gpt-actions/README.md](gpt-actions/README.md) |
| `@workspace/zivr-connector-gemini` | CLI bridge to the Gemini API | [connectors/gemini/README.md](gemini/README.md) |
| `@workspace/zivr-connector-perplexity` | CLI bridge to the Perplexity Agent API | [connectors/perplexity/README.md](perplexity/README.md) |
| `@workspace/zivr-agent-client` | Shared paste-key client used by the Gemini and Perplexity bridges | [connectors/agent-client/README.md](agent-client/README.md) |

Each twin has its own sub-profile, provider slug, and `zivr_agent_…` key. A custom bot that only needs HTTP uses the [webhook and poll](../docs/agent-api/custom-bots.md) pages. There is no chat-completions proxy.

Muse is deferred and has no connector in this release.
