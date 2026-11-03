import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import test from "node:test";
import { ACTION_SCOPES } from "./limits.js";
import { handleOAuthRequest, readOAuthConfig, type OAuthConfig, type OAuthDeps, type OAuthIncoming } from "./oauth.js";
import { createMemoryAuthStore } from "./store.js";
import type { TokenExchanger } from "./client.js";

const KEY = `zivr_agent_${"b".repeat(24)}`;
const OTHER = `zivr_agent_${"c".repeat(24)}`;
const AGENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REDIRECT = "https://chatgpt.com/aip/g-axe/oauth/callback";
const STATE = "state-from-chatgpt-1";

function config(overrides: Partial<OAuthConfig> = {}): OAuthConfig {
  return {
    clientId: "gpt-client-id",
    clientSecret: "gpt-client-secret-value",
    allowLocalRedirects: false,
    strictRedirects: false,
    extraRedirects: [],
    codeTtlMs: 5 * 60 * 1000,
    refreshTtlMs: 30 * 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

function deps(overrides: Partial<OAuthDeps> & { revoked?: () => boolean } = {}): OAuthDeps & { issued: () => number } {
  let issued = 0;
  const exchange: TokenExchanger = async (apiKey) => {
    if (overrides.revoked?.()) return { ok: false, status: 401, error: "API key is invalid", code: "auth" };
    if (apiKey === OTHER) return { ok: false, status: 403, error: "This profile is paused", code: "paused" };
    if (apiKey !== KEY) return { ok: false, status: 401, error: "API key is invalid", code: "auth" };
    issued += 1;
    return {
      ok: true,
      token: {
        accessToken: `jwt-${issued}`,
        tokenType: "Bearer",
        expiresIn: 3600,
        agentUserId: AGENT,
        scopes: [...ACTION_SCOPES],
      },
    };
  };
  return {
    config: overrides.config ?? config(),
    store: overrides.store ?? createMemoryAuthStore(),
    exchange,
    ...(overrides.now ? { now: overrides.now } : {}),
    issued: () => issued,
  };
}

async function call(parts: Partial<OAuthIncoming> & { deps: OAuthDeps }): Promise<{
  status: number;
  headers: Record<string, string>;
  body: string;
  json: Record<string, unknown> | null;
}> {
  const response = await handleOAuthRequest({
    method: parts.method ?? "GET",
    pathname: parts.pathname ?? "/v1/gpt-actions/oauth/authorize",
    query: parts.query ?? new URLSearchParams(),
    body: parts.body ?? null,
    authorization: parts.authorization ?? null,
  }, parts.deps);
  let json: Record<string, unknown> | null = null;
  if (response.body.startsWith("{")) json = JSON.parse(response.body) as Record<string, unknown>;
  return { status: response.status, headers: response.headers, body: response.body, json };
}

function authorizeQuery(overrides: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams({
    response_type: "code",
    client_id: "gpt-client-id",
    redirect_uri: REDIRECT,
    state: STATE,
    scope: ACTION_SCOPES.join(" "),
    ...overrides,
  });
}

test("consent requires a ChatGPT callback and a state value", async () => {
  const kit = deps();
  const missing = await call({ deps: kit, query: authorizeQuery({ state: "" }) });
  assert.equal(missing.status, 400);
  assert.equal(missing.headers["location"], undefined);
  const evil = await call({ deps: kit, query: authorizeQuery({ redirect_uri: "https://evil.example/steal" }) });
  assert.equal(evil.status, 400);
  assert.equal(evil.body.includes("name=\"apiKey\""), false);
  const script = await call({ deps: kit, query: authorizeQuery({ redirect_uri: "javascript:alert(1)" }) });
  assert.equal(script.status, 400);
  const openai = await call({
    deps: kit,
    query: authorizeQuery({ redirect_uri: "https://chat.openai.com/aip/g-axe/oauth/callback" }),
  });
  assert.equal(openai.status, 200);
  assert.equal(openai.body.includes("name=\"apiKey\""), true);
  assert.equal(openai.body.includes(KEY), false);
});

test("a wrong client id is sent back to ChatGPT without a form", async () => {
  const kit = deps();
  const response = await call({ deps: kit, query: authorizeQuery({ client_id: "someone-else" }) });
  assert.equal(response.status, 302);
  const location = new URL(response.headers["location"] ?? "");
  assert.equal(location.searchParams.get("error"), "unauthorized_client");
  assert.equal(location.searchParams.get("state"), STATE);
});

test("pasting the agent key returns a code and the token endpoint returns the agent JWT", async () => {
  const kit = deps();
  const rejected = await call({
    deps: kit,
    method: "POST",
    body: {
      ...Object.fromEntries(authorizeQuery()),
      apiKey: OTHER,
    },
  });
  assert.equal(rejected.status, 400);
  assert.match(rejected.body, /paused/);
  assert.equal(rejected.body.includes(OTHER), false);
  assert.equal(rejected.headers["location"], undefined);

  const consent = await call({
    deps: kit,
    method: "POST",
    pathname: "/api/v1/gpt-actions/oauth/authorize",
    body: { ...Object.fromEntries(authorizeQuery()), apiKey: KEY },
  });
  assert.equal(consent.status, 302);
  const location = new URL(consent.headers["location"] ?? "");
  const code = location.searchParams.get("code") ?? "";
  assert.equal(location.origin + location.pathname, REDIRECT);
  assert.equal(location.searchParams.get("state"), STATE);
  assert.equal(code.startsWith("zivr_gpt_code_"), true);
  assert.equal(consent.headers["location"]?.includes(KEY), false);

  const wrongSecret = await call({
    deps: kit,
    method: "POST",
    pathname: "/v1/gpt-actions/oauth/token",
    body: {
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT,
      client_id: "gpt-client-id",
      client_secret: "not-the-secret-value",
    },
  });
  assert.equal(wrongSecret.json?.["error"], "invalid_client");

  const token = await call({
    deps: kit,
    method: "POST",
    pathname: "/v1/gpt-actions/oauth/token",
    body: {
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT,
      client_id: "gpt-client-id",
      client_secret: "gpt-client-secret-value",
    },
  });
  assert.equal(token.json?.["access_token"], "jwt-2");
  assert.equal(token.json?.["token_type"], "Bearer");
  assert.equal(token.json?.["expires_in"], 3600);
  assert.equal(token.json?.["scope"], ACTION_SCOPES.join(" "));
  const refresh = String(token.json?.["refresh_token"]);
  assert.equal(refresh.startsWith("zivr_gpt_rt_"), true);
  assert.equal(refresh.includes(KEY), false);

  const again = await call({
    deps: kit,
    method: "POST",
    pathname: "/oauth/token",
    body: {
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT,
      client_id: "gpt-client-id",
      client_secret: "gpt-client-secret-value",
    },
  });
  assert.equal(again.json?.["error"], "invalid_grant");

  const refreshed = await call({
    deps: kit,
    method: "POST",
    pathname: "/v1/gpt-actions/oauth/token",
    body: {
      grant_type: "refresh_token",
      refresh_token: refresh,
      client_id: "gpt-client-id",
      client_secret: "gpt-client-secret-value",
    },
  });
  assert.equal(refreshed.json?.["access_token"], "jwt-3");
  assert.equal(refreshed.json?.["refresh_token"], refresh);
});

test("an expired code and a revoked key both fail closed", async () => {
  let now = 1_000_000;
  let revoked = false;
  const kit = deps({ now: () => now, revoked: () => revoked });
  const consent = await call({
    deps: kit,
    method: "POST",
    body: { ...Object.fromEntries(authorizeQuery()), apiKey: KEY },
  });
  const code = new URL(consent.headers["location"] ?? "").searchParams.get("code") ?? "";
  now += 5 * 60 * 1000 + 1;
  const expired = await call({
    deps: kit,
    method: "POST",
    pathname: "/v1/gpt-actions/oauth/token",
    body: {
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT,
      client_id: "gpt-client-id",
      client_secret: "gpt-client-secret-value",
    },
  });
  assert.equal(expired.json?.["error"], "invalid_grant");

  now = 2_000_000;
  const second = await call({
    deps: kit,
    method: "POST",
    body: { ...Object.fromEntries(authorizeQuery()), apiKey: KEY },
  });
  const live = new URL(second.headers["location"] ?? "").searchParams.get("code") ?? "";
  const minted = await call({
    deps: kit,
    method: "POST",
    pathname: "/v1/gpt-actions/oauth/token",
    body: {
      grant_type: "authorization_code",
      code: live,
      redirect_uri: REDIRECT,
      client_id: "gpt-client-id",
      client_secret: "gpt-client-secret-value",
    },
  });
  const refresh = String(minted.json?.["refresh_token"]);
  revoked = true;
  const dead = await call({
    deps: kit,
    method: "POST",
    pathname: "/v1/gpt-actions/oauth/token",
    body: {
      grant_type: "refresh_token",
      refresh_token: refresh,
      client_id: "gpt-client-id",
      client_secret: "gpt-client-secret-value",
    },
  });
  assert.equal(dead.json?.["error"], "invalid_grant");
});

test("PKCE S256 and HTTP Basic client auth are accepted", async () => {
  const kit = deps();
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const consent = await call({
    deps: kit,
    method: "POST",
    body: {
      ...Object.fromEntries(authorizeQuery()),
      code_challenge: challenge,
      code_challenge_method: "S256",
      apiKey: KEY,
    },
  });
  const code = new URL(consent.headers["location"] ?? "").searchParams.get("code") ?? "";
  const bad = await call({
    deps: kit,
    method: "POST",
    pathname: "/v1/gpt-actions/oauth/token",
    authorization: `Basic ${Buffer.from("gpt-client-id:gpt-client-secret-value").toString("base64")}`,
    body: { grant_type: "authorization_code", code, redirect_uri: REDIRECT, code_verifier: "not-the-verifier-not-the-verifier-not-the" },
  });
  assert.equal(bad.json?.["error"], "invalid_grant");
  const consentAgain = await call({
    deps: kit,
    method: "POST",
    body: {
      ...Object.fromEntries(authorizeQuery()),
      code_challenge: challenge,
      code_challenge_method: "S256",
      apiKey: KEY,
    },
  });
  const code2 = new URL(consentAgain.headers["location"] ?? "").searchParams.get("code") ?? "";
  const good = await call({
    deps: kit,
    method: "POST",
    pathname: "/v1/gpt-actions/oauth/token",
    authorization: `Basic ${Buffer.from("gpt-client-id:gpt-client-secret-value").toString("base64")}`,
    body: { grant_type: "authorization_code", code: code2, redirect_uri: REDIRECT, code_verifier: verifier },
  });
  assert.equal(typeof good.json?.["access_token"], "string");
});

test("redirect policy can pin one callback or allow localhost", async () => {
  const pinned = "https://chatgpt.com/aip/g-only/oauth/callback";
  const strict = deps({
    config: config({ strictRedirects: true, extraRedirects: [pinned] }),
  });
  const blocked = await call({ deps: strict, query: authorizeQuery() });
  assert.equal(blocked.status, 400);
  const allowed = await call({ deps: strict, query: authorizeQuery({ redirect_uri: pinned }) });
  assert.equal(allowed.status, 200);
  const local = deps({ config: config({ allowLocalRedirects: true }) });
  const loopback = await call({
    deps: local,
    query: authorizeQuery({ redirect_uri: "http://127.0.0.1:8787/oauth/callback" }),
  });
  assert.equal(loopback.status, 200);
  const closed = await call({
    deps: deps(),
    query: authorizeQuery({ redirect_uri: "http://127.0.0.1:8787/oauth/callback" }),
  });
  assert.equal(closed.status, 400);
});

test("oauth env is disabled until both secrets are set", () => {
  assert.equal(readOAuthConfig({}).state, "disabled");
  assert.equal(readOAuthConfig({ ZIVR_GPT_OAUTH_CLIENT_ID: "gpt-client-id" }).state, "invalid");
  const ready = readOAuthConfig({
    ZIVR_GPT_OAUTH_CLIENT_ID: "gpt-client-id",
    ZIVR_GPT_OAUTH_CLIENT_SECRET: "gpt-client-secret-value",
    ZIVR_GPT_OAUTH_ALLOW_LOCAL: "1",
  });
  assert.equal(ready.state, "ready");
  if (ready.state === "ready") assert.equal(ready.config.allowLocalRedirects, true);
});
