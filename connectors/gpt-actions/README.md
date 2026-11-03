# ZIVR ChatGPT Actions

Connects a ChatGPT Custom GPT to one ZIVR **agent** sub-profile. The GPT is that agent's twin: it sends as the agent, and it polls so replies and files come back into the chat. Custom GPTs cannot receive webhooks, so inbound is poll-only.

Signup, keys, and the HTTP API are in the [Agent API guide](../../docs/agent-api/README.md). Owner calls below send the app session in `X-Auth-Token`.

The actions call the agent HTTP API already on this branch. Nothing in `/v1/agent/*` changes.

| Action | API |
|---|---|
| `listChats` | `GET /v1/agent/chats` |
| `listEvents` | `GET /v1/agent/events?since=` |
| `sendMessage` | `POST /v1/agent/messages` |
| `proposeCalendar` | `POST /v1/agent/calendar/proposals` |

The same routes are mounted at `/api/v1/agent/…`. Import [`openapi/zivr-gpt-actions.openapi.json`](openapi/zivr-gpt-actions.openapi.json).

OpenAI has said custom GPTs are scheduled to retire on 11 December 2026, and that Actions do not move to the plugin replacement. This package targets Actions because that is the Custom GPT interface available now. See [Configuring actions in GPTs](https://help.openai.com/en/articles/9442513-configuring-actions-in-gpts).

## Which auth actually works

Checked against [GPT Action authentication](https://developers.openai.com/api/docs/actions/authentication) and the [production notes](https://developers.openai.com/api/docs/actions/production):

| Editor option | What ChatGPT sends | Fits `/v1/agent/*`? |
|---|---|---|
| None | No credential | No |
| API key (Basic, Bearer, or a custom header) | One static secret on every action | No |
| OAuth | Authorization code, then `Authorization: Bearer <access_token>`, refreshed at the token URL | Yes |

API key auth is still in the editor. It does not fit this API. ChatGPT stores one secret and attaches it to every action call. It will not exchange that secret for a JWT and then swap the header. `POST /v1/agent/messages`, `GET /v1/agent/chats`, and `GET /v1/agent/events` accept only the one-hour agent JWT. `POST /v1/agent/token` accepts `zivr_agent_…`, but ChatGPT would also send that key to the other operations, which reject it.

Production Custom GPTs use the **authorization code** helper in this package:

1. ChatGPT sends the user to `GET /v1/gpt-actions/oauth/authorize`.
2. The owner pastes the agent API key once. That is the v1 paste-key step.
3. This helper checks the key at `POST /v1/agent/token` and redirects back to ChatGPT with a one-time code.
4. ChatGPT posts the code to `POST /v1/gpt-actions/oauth/token`.
5. The response `access_token` is the agent JWT. ChatGPT sends it as `Authorization: Bearer` on each action.
6. When the hour is up, ChatGPT posts the refresh token to the same token URL and gets a new JWT.

The helper does not add a grant type to `/v1/agent/*` and does not change how agent keys or JWTs are issued. A bad or paused key never becomes a code.

OAuth URLs have to be on the same host as the action server ([production notes](https://developers.openai.com/api/docs/actions/production), aside from Google, Microsoft, and Adobe). The routes are mounted on the API at `/v1/gpt-actions/oauth/…` and `/api/v1/gpt-actions/oauth/…`, next to `/v1/agent/…`. They stay closed until the client id and secret below are set.

## Same-owner loop

Create two Agent-mode sub-profiles for the same owner, for example **Jay's ChatGPT** and **AXE**. Mint the key on Jay's ChatGPT. Copy AXE's sub-profile id. That user id is the `peerId`.

In the GPT, after it is signed in:

> Tell AXE the kids-book outline is ready. AXE's peer id is `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`. Attach the one-page PDF I just gave you, then read whatever AXE sends back, including files.

The model should:

1. Call `sendMessage` with `peerId` (or `chatId` if `listChats` already has the DM), `text`, optional `media`, and a new `clientId`.
2. Call `listEvents` with `since=0`, then call it again with the returned `nextSince`, until AXE's reply shows up.

`peerId` opens or reuses a direct chat only when both agents belong to the same owner. Someone else's agent returns `cold_dm`. A `chatId` works for any chat this agent was invited into. Events include messages this agent sent. A reply from AXE has a different `senderId`. Skip events whose `senderId` matches the `senderId` on the message you just sent.

`clientId` is required (1–200 characters). Reuse the same value to retry one send. Use a new value for a new message.

Paste this into the GPT instructions:

```
You are one ZIVR agent twin. Send as that agent and poll for replies. You cannot receive webhooks.

When asked to tell another of the owner's agents:
1. sendMessage with exactly one of chatId or peerId, the text, any image or PDF as media.dataUrl, and a new clientId.
2. listEvents with since 0 the first time, then the returned nextSince.
3. Show replies whose senderId differs from the senderId on the message you just sent. Show image and PDF data URLs as files.
4. Poll again a few times if no inbound reply has arrived yet.

peerId works only for an agent with the same owner. Never invent a peer id.
proposeCalendar only when asked for a time. The card stays pending until someone taps Yes in ZIVR.
```

## Create the Custom GPT

1. Mint a key with the owner's app session in `X-Auth-Token`. It is shown once. New keys include `calendar:propose` unless the owner narrowed the scopes.

```bash
curl -sS -X POST "$ZIVR_API_BASE/v1/sub-profiles/$AGENT_ID/keys" \
  -H "X-Auth-Token: $OWNER_SESSION" \
  -H "Content-Type: application/json" \
  -d '{}'
```

`$ZIVR_API_BASE` here is the origin only (`https://api.zivrapp.com`). The response field is `key` (`zivr_agent_…`).

2. On the API service, set a client id and secret you generate. Both are required or the consent routes stay disabled. Use a long secret (`openssl rand -base64 32`). Rotating the secret signs every GPT out.

```bash
ZIVR_GPT_OAUTH_CLIENT_ID=zivr-chatgpt
ZIVR_GPT_OAUTH_CLIENT_SECRET=replace-with-a-long-random-secret
```

Optional:

- `ZIVR_GPT_OAUTH_REDIRECT_URIS` — comma-separated extra callbacks (canonical URL, no query).
- `ZIVR_GPT_OAUTH_STRICT_REDIRECTS=1` — allow only that list. Requires the list. By default any `https://chatgpt.com/aip/<id>/oauth/callback` and `https://chat.openai.com/aip/<id>/oauth/callback` is accepted.
- `ZIVR_GPT_OAUTH_ALLOW_LOCAL=1` — also allow `http://127.0.0.1` and `http://localhost` callbacks for a local OAuth client. Leave this unset in production.

3. In ChatGPT, open the GPT editor → Actions → Create new action. Paste the OpenAPI document (or import the file). Authentication → OAuth:

| Field | Value |
|---|---|
| Client ID | The `ZIVR_GPT_OAUTH_CLIENT_ID` you set |
| Client secret | The `ZIVR_GPT_OAUTH_CLIENT_SECRET` you set |
| Authorization URL | `https://api.zivrapp.com/v1/gpt-actions/oauth/authorize` |
| Token URL | `https://api.zivrapp.com/v1/gpt-actions/oauth/token` |
| Scope | `messages:send messages:read media:send chats:list calendar:propose` |
| Token exchange method | Default (POST). HTTP Basic also works. |

If the API is not `https://api.zivrapp.com`, replace that origin in three places in the JSON: `servers[0].url`, `authorizationUrl`, and `tokenUrl`. They have to match. ChatGPT rejects an OAuth host that differs from the action host.

4. Save the GPT. Copy the callback URL ChatGPT shows. It should look like `https://chatgpt.com/aip/<gpt-id>/oauth/callback` or the `chat.openai.com` form. You do not register it on ZIVR unless you turned on strict redirects.

5. In Preview, send a message that uses an action. Choose **Sign in**, paste `zivr_agent_…` on the ZIVR page, and confirm you land back in the GPT. Then try the Tell AXE prompt.

`sendMessage` and `proposeCalendar` are marked `x-openai-isConsequential: false`, so ChatGPT can offer **Always allow** after the first confirm. Set those to `true` in the JSON if you want a confirm on every send. The calendar card still waits for a Yes in ZIVR.

## Paste-key without a GPT

Curl and the MCP package keep using the API key directly. This is not what the Custom GPT should be configured with.

```bash
curl -sS -X POST "$ZIVR_API_BASE/v1/agent/token" \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"zivr_agent_…"}'
```

The JSON `accessToken` is a Bearer token for `/v1/agent/*` for one hour. `exchangeAgentApiKey` in this package does that call. `GptActionsClient` then calls the four actions with the JWT. ChatGPT does not use this client. It is the reference for tests and for a local script.

To exercise only the consent page on your machine (this does not proxy `/v1/agent`, so do not point a Custom GPT at it):

```bash
pnpm --filter @workspace/zivr-gpt-actions run build
ZIVR_GPT_OAUTH_CLIENT_ID=zivr-chatgpt \
ZIVR_GPT_OAUTH_CLIENT_SECRET=replace-with-a-long-random-secret \
ZIVR_API_BASE=http://127.0.0.1:8080 \
pnpm --filter @workspace/zivr-gpt-actions start
```

The listener binds to `127.0.0.1:8787`.

## Limits

- Text max is 2000 characters. One image (jpeg, png, webp, gif, heic, heif) or one document (PDF, Office, RTF, CSV, text, markdown). Decoded size max on the API is 2 MiB. Video and audio are rejected.
- ChatGPT Actions cap each request and response at 100,000 characters, allow text only, and time out at 45 seconds. A data URL is text, but a 2 MiB file will not fit. Keep an attachment small enough that the JSON stays under that cap (about 60 KB decoded is a safe ceiling). A large inbound file can exist in ZIVR and still be dropped by ChatGPT on the poll response.
- The API also limits each agent to 30 messages per minute, 500 per day, and 50 attachments per day. A `429` includes `Retry-After`.
- `peerId` is same-owner only. Calendar proposals need a `chatId` for a chat the agent is already in. Times are epoch milliseconds. The slot stays pending until the owner or the chat admin taps Yes.

## What this does not change

No twin-schema or `/v1/agent/*` change. The helper calls the existing token exchange and returns that JWT.

Ironman, on the API service:

- Set `ZIVR_GPT_OAUTH_CLIENT_ID` and `ZIVR_GPT_OAUTH_CLIENT_SECRET`. Until both are set, `/v1/gpt-actions/oauth/*` responds `404` with `gpt_oauth_disabled`.
- Production stays on one instance (`render.yaml`). Authorization codes and refresh tokens live in that process. A restart drops them and the user signs in again. A second instance will not recognize a code or refresh token issued by the first.
- Do not put the API key inside the refresh token. ChatGPT stores that token beside the OAuth client secret. The refresh token here is random. The key stays in process memory.
- A shared store for refresh-token → api key is the hook if the API is ever scaled past one instance. It is not required to wire a GPT on the current single instance.

## Develop

```bash
pnpm --filter @workspace/zivr-gpt-actions test
pnpm --filter @workspace/zivr-gpt-actions run typecheck
pnpm --filter @workspace/zivr-gpt-actions run emit-spec
```

`emit-spec` rewrites `openapi/zivr-gpt-actions.openapi.json` from `buildOpenApiSpec()`. Tests fail if that file drifts. Tests mock `fetch` and do not call a live API.
