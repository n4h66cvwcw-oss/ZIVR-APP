import assert from "node:assert/strict";
import test from "node:test";
import { ACTION_SCOPES } from "./limits.js";
import { startOAuthServer } from "./http.js";
import { createMemoryAuthStore } from "./store.js";
import type { OAuthConfig } from "./oauth.js";
import type { TokenExchanger } from "./client.js";

const KEY = `zivr_agent_${"d".repeat(24)}`;
const REDIRECT = "https://chatgpt.com/aip/g-wire/oauth/callback";

test("the token endpoint accepts the form body ChatGPT posts", async () => {
  let issued = 0;
  const exchange: TokenExchanger = async (apiKey) => {
    assert.equal(apiKey, KEY);
    issued += 1;
    return {
      ok: true,
      token: {
        accessToken: `jwt-${issued}`,
        tokenType: "Bearer",
        expiresIn: 3600,
        agentUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        scopes: [...ACTION_SCOPES],
      },
    };
  };
  const config: OAuthConfig = {
    clientId: "gpt-client-id",
    clientSecret: "gpt-client-secret-value",
    allowLocalRedirects: false,
    strictRedirects: false,
    extraRedirects: [],
    codeTtlMs: 60_000,
    refreshTtlMs: 60_000,
  };
  const server = await startOAuthServer({ config, store: createMemoryAuthStore(), exchange });
  try {
    const consent = await fetch(`${server.url}/v1/gpt-actions/oauth/authorize`, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        response_type: "code",
        client_id: config.clientId,
        redirect_uri: REDIRECT,
        state: "wire-state-1",
        apiKey: KEY,
      }),
    });
    assert.equal(consent.status, 302);
    const code = new URL(consent.headers.get("location") ?? "").searchParams.get("code") ?? "";
    const token = await fetch(`${server.url}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    const body = await token.json() as { access_token: string; token_type: string; refresh_token: string };
    assert.equal(token.status, 200);
    assert.equal(body.access_token, "jwt-2");
    assert.equal(body.token_type, "Bearer");
    assert.equal(body.refresh_token.startsWith("zivr_gpt_rt_"), true);
  } finally {
    await server.close();
  }
});
