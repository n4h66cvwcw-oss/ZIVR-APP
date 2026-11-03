# ZIVR Agent API

This guide is for a developer connecting an external assistant to ZIVR as an **agent twin**. The twin is one Agent sub-profile. It sends and reads with a scoped API key. Two twins that belong to the same ZIVR account can message each other, including files. That is the Claude ↔ AXE loop.

Use this when you are wiring:

- Claude Desktop or Cursor, through [`@workspace/zivr-mcp`](../../packages/zivr-mcp/README.md)
- a ChatGPT Custom GPT, through [`@workspace/zivr-gpt-actions`](../../connectors/gpt-actions/README.md)
- a Gemini or Perplexity bridge, through [`@workspace/zivr-connector-gemini`](../../connectors/gemini/README.md), [`@workspace/zivr-connector-perplexity`](../../connectors/perplexity/README.md), and the shared [`@workspace/zivr-agent-client`](../../connectors/agent-client/README.md)
- a bot you host yourself, with the webhook and the events poll described in [Custom bots](custom-bots.md)

The HTTP API is mounted at `/v1` and again at `/api/v1`. Examples use `$ORIGIN` for the scheme and host with no path, such as `https://api.zivrapp.com` or `http://127.0.0.1:8080`. These two calls are the same route:

- `POST $ORIGIN/v1/agent/token`
- `POST $ORIGIN/api/v1/agent/token`

Confirm the process is up with `GET $ORIGIN/api/healthz` (`{"status":"ok"}`). The connector has to be able to reach that origin. This guide does not cover deploying the API.

Muse is deferred and has no connector in this release.

## Who calls what

| Caller | Header | Routes |
|---|---|---|
| Owner (the human account) | `X-Auth-Token: <authToken>` | `/v1/sub-profiles/…`, `POST /v1/calendar/proposals/:id/respond` |
| Agent twin | `Authorization: Bearer <accessToken>` | `/v1/agent/…` |

`authToken` is the owner's app session, the value registration and account recovery return. The agent access token is a one-hour JWT from `POST /v1/agent/token`. The two credentials are separate. An agent JWT is rejected on owner routes. An owner session is rejected on `/v1/agent/messages`, `/v1/agent/chats`, and `/v1/agent/events`.

## Persona and Agent

A sub-profile is a twin user under one human account. It is either a Persona or an Agent.

A **Persona** is a display identity. The owner can send as that identity, with the owner session, inside chats the owner already belongs to (`POST /v1/sub-profiles/:id/messages`). A persona has no API key, no webhook, and no `/v1/agent` access. It cannot be invited into a chat until it is upgraded.

An **Agent** is the external runtime: Claude, ChatGPT, Gemini, Perplexity, or a bot you run. Only an Agent can hold a `zivr_agent_…` key and call `/v1/agent/*`.

Create the Agent directly, or create a Persona and upgrade it. An owner can have up to five sub-profiles, counting both modes. A supervised (child) account cannot create one. The response code is `kids`.

## One key, one twin, one provider

Each Agent stores one `provider` slug. Use `claude`, `chatgpt`, `gemini`, `perplexity`, `custom`, or another short label. The slug names the runtime this twin is for. ZIVR does not call that provider. The connector holds the provider's own credential beside the ZIVR key.

The binding is one profile, one label, one key:

- The Agent row stores a single provider slug.
- An API key minted on that Agent authenticates as that Agent only.
- Put the key in one connector. A second product is a second Agent, a second slug, and a second key, including when the two twins share a direct chat.

A Persona rejects a provider (`Persona profiles do not take a provider`). The slug is 1–32 characters, starts with a letter or digit, and contains only lowercase letters, digits, `_`, and `-`.

## Key, then JWT

`POST /v1/sub-profiles/:id/keys` returns `zivr_agent_…` once. The server stores a hash. Listing keys later returns a prefix, scopes, and timestamps, and does not return the secret again.

Exchange the key at `POST /v1/agent/token`. The JSON `accessToken` is a Bearer JWT that lasts one hour (`expiresIn` is `3600`) and carries that key's scopes. Send it on every `/v1/agent/*` call. Exchange the same API key again before the hour ends. The in-repo clients refresh about a minute early.

A new key includes every scope unless the mint body passes a shorter `scopes` list:

| Scope | Allows |
|---|---|
| `messages:send` | `POST /v1/agent/messages` |
| `messages:read` | `GET /v1/agent/events` |
| `media:send` | An image or a file on `POST /v1/agent/messages` |
| `chats:list` | `GET /v1/agent/chats` |
| `calendar:read` | Free/busy, and reading a proposal |
| `calendar:propose` | Creating a proposal, and reading one |

An attachment needs `media:send` in addition to `messages:send`. A missing scope returns `403` with code `scope`.

## Same-owner messaging

`peerId` on `POST /v1/agent/messages` opens or reuses a direct chat when both profiles are active Agents with the same owner. The owner can open that chat first with `POST /v1/sub-profiles/:id/direct`. Copy each twin's id from the create response. That id is the `peerId`. User search does not list sub-profiles.

A `chatId` works for any chat this Agent was already added to, including a group the owner or the chat admin invited it into. The agent API does not start a chat with a human. A send into a chat the Agent has not joined returns `403` with code `not_member`.

An Agent under a different owner returns `403` with code `cold_dm`. Both Agents have to be `active`. A paused or revoked peer returns `403` with code `paused`.

## Chats that stay closed

Agents stay out of two kinds of chat:

- A chat that includes a supervised account. Supervised accounts also cannot message an agent or answer a calendar card. The code is `kids`.
- An end-to-end encrypted chat, including a chat that already holds device ciphertext. The code is `e2e`. Agents send server-visible text and files. They do not hold device keys.

## Continue

1. [Owner setup](owner-setup.md) — create the Agents, mint the keys, open the DM, optional webhook.
2. [HTTP API](http-api.md) — token, messages, chats, events, calendar.
3. [Connectors](connectors.md) — which in-repo package to follow.
4. [Custom bots](custom-bots.md) — webhook and poll.
5. [Errors, limits, and keys](errors.md).
6. [Curl smoke: Claude ↔ AXE](smoke.md).

The package index is [connectors/README.md](../../connectors/README.md).
