import { createHash, timingSafeEqual } from "node:crypto";
import type { ExchangeResult, TokenExchanger } from "./client.js";
import { API_KEY_PATTERN } from "./limits.js";
import type { OAuthConfig } from "./oauth-config.js";
import { renderConsentPage, renderMessagePage } from "./page.js";
import { canonicalRedirect, isAllowedRedirect } from "./redirect.js";
import { randomSecret, type AuthStore } from "./store.js";

export type { OAuthConfig, OAuthConfigRead } from "./oauth-config.js";
export { readOAuthConfig } from "./oauth-config.js";

export type OAuthIncoming = {
  method: string;
  pathname: string;
  query: URLSearchParams;
  body: Record<string, unknown> | null;
  authorization: string | null;
};

export type OAuthHttpResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
};

export type OAuthDeps = {
  config: OAuthConfig;
  store: AuthStore;
  exchange: TokenExchanger;
  now?: () => number;
};

const AUTHORIZE_PATHS = new Set([
  "/v1/gpt-actions/oauth/authorize",
  "/api/v1/gpt-actions/oauth/authorize",
  "/oauth/authorize",
]);

const TOKEN_PATHS = new Set([
  "/v1/gpt-actions/oauth/token",
  "/api/v1/gpt-actions/oauth/token",
  "/oauth/token",
]);

const PKCE_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

function nowOf(deps: OAuthDeps): number {
  return deps.now ? deps.now() : Date.now();
}

function headers(contentType?: string, extra?: Record<string, string>): Record<string, string> {
  return {
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    ...(contentType ? { "content-type": contentType } : {}),
    ...extra,
  };
}

function json(status: number, payload: Record<string, string>, extra?: Record<string, string>): OAuthHttpResponse {
  return {
    status,
    headers: headers("application/json; charset=utf-8", extra),
    body: JSON.stringify(payload),
  };
}

function html(status: number, body: string): OAuthHttpResponse {
  return {
    status,
    headers: headers("text/html; charset=utf-8", {
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    }),
    body,
  };
}

function redirect(uri: string, params: Record<string, string>): OAuthHttpResponse {
  const url = new URL(uri);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return {
    status: 302,
    headers: headers(undefined, { location: url.toString() }),
    body: "",
  };
}

function message(status: number, title: string, text: string): OAuthHttpResponse {
  return html(status, renderMessagePage(title, text));
}

function secretEqual(left: string, right: string): boolean {
  const a = createHash("sha256").update(left, "utf8").digest();
  const b = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(a, b);
}

function stringField(body: Record<string, unknown> | null, query: URLSearchParams, name: string): string {
  const fromBody = body?.[name];
  if (typeof fromBody === "string") return fromBody;
  if (Array.isArray(fromBody) && typeof fromBody[0] === "string") return fromBody[0];
  return query.get(name) ?? "";
}

function decodeForm(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function parseBasic(authorization: string | null): { clientId: string; clientSecret: string } | null {
  if (!authorization) return null;
  const match = /^Basic\s+(\S+)$/i.exec(authorization.trim());
  if (!match?.[1]) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return null;
  }
  const index = decoded.indexOf(":");
  if (index <= 0) return null;
  return {
    clientId: decodeForm(decoded.slice(0, index)),
    clientSecret: decodeForm(decoded.slice(index + 1)),
  };
}

function clientIsAuthenticated(
  body: Record<string, unknown> | null,
  query: URLSearchParams,
  authorization: string | null,
  config: OAuthConfig,
): boolean {
  const basic = parseBasic(authorization);
  const bodyId = stringField(body, query, "client_id");
  const bodySecret = stringField(body, query, "client_secret");
  const clientId = bodyId || basic?.clientId || "";
  const clientSecret = bodySecret || basic?.clientSecret || "";
  if (basic && bodyId && !secretEqual(bodyId, basic.clientId)) return false;
  if (basic && bodySecret && !secretEqual(bodySecret, basic.clientSecret)) return false;
  if (!clientId || !clientSecret) return false;
  return secretEqual(clientId, config.clientId) && secretEqual(clientSecret, config.clientSecret);
}

function validState(state: string): boolean {
  return state.length >= 1 && state.length <= 2048 && !/[\u0000-\u001f\u007f]/.test(state) && !/\s/.test(state);
}

function pkceChallenge(value: string, method: string): string | null {
  if (!value && !method) return null;
  if (method !== "S256" || !PKCE_PATTERN.test(value)) return "invalid";
  return value;
}

function pkceMatches(challenge: string, verifier: string): boolean {
  if (!PKCE_PATTERN.test(verifier)) return false;
  const digest = createHash("sha256").update(verifier).digest("base64url");
  const actual = Buffer.from(digest);
  const expected = Buffer.from(challenge);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function routeOf(pathname: string): "authorize" | "token" | null {
  const path = pathname.split("?")[0]?.replace(/\/+$/, "") || "/";
  if (AUTHORIZE_PATHS.has(path)) return "authorize";
  if (TOKEN_PATHS.has(path)) return "token";
  return null;
}

function consentError(result: Extract<ExchangeResult, { ok: false }>): string {
  if (result.code === "paused" || result.status === 403) return "This agent is paused.";
  if (result.status === 401 || result.code === "auth") return "That API key was rejected.";
  return "ZIVR could not check that key. Try again.";
}

async function exchangeKey(deps: OAuthDeps, apiKey: string): Promise<ExchangeResult> {
  try {
    const result = await deps.exchange(apiKey);
    if (!result.ok) return result;
    if (!result.token.accessToken || result.token.expiresIn <= 0 || result.token.tokenType !== "Bearer") {
      return { ok: false, status: 502, error: "Token exchange failed", code: "upstream" };
    }
    return result;
  } catch {
    return { ok: false, status: 502, error: "Token exchange failed", code: "upstream" };
  }
}

function tokenJson(accessToken: string, expiresIn: number, refreshToken: string, scopes: string[]): OAuthHttpResponse {
  return {
    status: 200,
    headers: headers("application/json; charset=utf-8"),
    body: JSON.stringify({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
      refresh_token: refreshToken,
      scope: scopes.join(" "),
    }),
  };
}

function authorizeGet(incoming: OAuthIncoming, deps: OAuthDeps): OAuthHttpResponse {
  const clientId = incoming.query.get("client_id") ?? "";
  const redirectUri = incoming.query.get("redirect_uri") ?? "";
  const state = incoming.query.get("state") ?? "";
  const responseType = incoming.query.get("response_type") ?? "";
  const scope = incoming.query.get("scope") ?? "";
  const challengeRaw = incoming.query.get("code_challenge") ?? "";
  const challengeMethod = incoming.query.get("code_challenge_method") ?? "";
  const canonical = canonicalRedirect(redirectUri);
  if (!canonical || !isAllowedRedirect(redirectUri, deps.config)) {
    return message(400, "Cannot connect", "The redirect URL is not a ChatGPT callback.");
  }
  if (!validState(state)) return message(400, "Cannot connect", "ChatGPT did not send a state value.");
  if (!secretEqual(clientId, deps.config.clientId)) {
    return redirect(canonical, { error: "unauthorized_client", state });
  }
  if (responseType !== "code") return redirect(canonical, { error: "unsupported_response_type", state });
  const challenge = pkceChallenge(challengeRaw, challengeRaw ? challengeMethod || "missing" : "");
  if (challenge === "invalid") return redirect(canonical, { error: "invalid_request", state });
  const actionPath = incoming.pathname.split("?")[0]?.replace(/\/+$/, "") || incoming.pathname;
  return html(200, renderConsentPage({
    actionPath,
    clientId,
    redirectUri: canonical,
    state,
    scope: scope.slice(0, 500),
    responseType,
    ...(challenge ? { codeChallenge: challenge, codeChallengeMethod: "S256" } : {}),
  }));
}

async function authorizePost(incoming: OAuthIncoming, deps: OAuthDeps): Promise<OAuthHttpResponse> {
  const clientId = stringField(incoming.body, incoming.query, "client_id");
  const redirectUri = stringField(incoming.body, incoming.query, "redirect_uri");
  const state = stringField(incoming.body, incoming.query, "state");
  const responseType = stringField(incoming.body, incoming.query, "response_type");
  const scope = stringField(incoming.body, incoming.query, "scope").slice(0, 500);
  const challengeRaw = stringField(incoming.body, incoming.query, "code_challenge");
  const challengeMethod = stringField(incoming.body, incoming.query, "code_challenge_method");
  const actionPath = incoming.pathname.split("?")[0]?.replace(/\/+$/, "") || incoming.pathname;
  const challenge = pkceChallenge(challengeRaw, challengeRaw ? challengeMethod || "missing" : "");
  const page = (error: string): OAuthHttpResponse => html(400, renderConsentPage({
    actionPath,
    error,
    clientId,
    redirectUri,
    state,
    scope,
    responseType,
    ...(typeof challenge === "string" && challenge !== "invalid" ? { codeChallenge: challenge, codeChallengeMethod: "S256" } : {}),
  }));
  const canonical = canonicalRedirect(redirectUri);
  if (!canonical || !isAllowedRedirect(redirectUri, deps.config)) {
    return message(400, "Cannot connect", "The redirect URL is not a ChatGPT callback.");
  }
  if (!validState(state)) return message(400, "Cannot connect", "ChatGPT did not send a state value.");
  if (!secretEqual(clientId, deps.config.clientId)) return redirect(canonical, { error: "unauthorized_client", state });
  if (responseType !== "code") return redirect(canonical, { error: "unsupported_response_type", state });
  if (challenge === "invalid") return redirect(canonical, { error: "invalid_request", state });
  const apiKey = typeof incoming.body?.["apiKey"] === "string" ? incoming.body["apiKey"].trim() : "";
  if (!API_KEY_PATTERN.test(apiKey)) return page("Paste the full zivr_agent_… key.");
  const exchanged = await exchangeKey(deps, apiKey);
  if (!exchanged.ok) return page(consentError(exchanged));
  const code = randomSecret("zivr_gpt_code_");
  const now = nowOf(deps);
  const saved = deps.store.saveCode(code, {
    apiKey,
    clientId: deps.config.clientId,
    redirectUri: canonical,
    codeChallenge: challenge,
    expiresAt: now + deps.config.codeTtlMs,
  }, now);
  if (saved !== "ok") return page("Too many sign-ins are in progress. Try again in a minute.");
  return redirect(canonical, { code, state });
}

async function tokenPost(incoming: OAuthIncoming, deps: OAuthDeps): Promise<OAuthHttpResponse> {
  if (!clientIsAuthenticated(incoming.body, incoming.query, incoming.authorization, deps.config)) {
    return json(400, { error: "invalid_client", error_description: "Client authentication failed." });
  }
  const grant = stringField(incoming.body, incoming.query, "grant_type");
  if (grant === "refresh_token") return refresh(incoming, deps);
  if (grant !== "authorization_code") {
    return json(400, { error: "unsupported_grant_type", error_description: "Use authorization_code or refresh_token." });
  }
  const code = stringField(incoming.body, incoming.query, "code");
  const redirectUri = canonicalRedirect(stringField(incoming.body, incoming.query, "redirect_uri"));
  const verifier = stringField(incoming.body, incoming.query, "code_verifier");
  const record = code ? deps.store.takeCode(code, nowOf(deps)) : null;
  if (!record || !redirectUri || record.redirectUri !== redirectUri || record.clientId !== deps.config.clientId) {
    return json(400, { error: "invalid_grant", error_description: "The authorization code is invalid or expired." });
  }
  if (record.codeChallenge && !pkceMatches(record.codeChallenge, verifier)) {
    return json(400, { error: "invalid_grant", error_description: "The code verifier does not match." });
  }
  const exchanged = await exchangeKey(deps, record.apiKey);
  if (!exchanged.ok) {
    return json(400, { error: "invalid_grant", error_description: "The agent key is no longer valid." });
  }
  const refreshToken = randomSecret("zivr_gpt_rt_");
  const now = nowOf(deps);
  deps.store.saveRefresh(refreshToken, {
    apiKey: record.apiKey,
    clientId: deps.config.clientId,
    expiresAt: now + deps.config.refreshTtlMs,
  }, now);
  return tokenJson(exchanged.token.accessToken, exchanged.token.expiresIn, refreshToken, exchanged.token.scopes);
}

async function refresh(incoming: OAuthIncoming, deps: OAuthDeps): Promise<OAuthHttpResponse> {
  const refreshToken = stringField(incoming.body, incoming.query, "refresh_token");
  const record = refreshToken ? deps.store.readRefresh(refreshToken, nowOf(deps)) : null;
  if (!record || record.clientId !== deps.config.clientId) {
    return json(400, { error: "invalid_grant", error_description: "The refresh token is invalid or expired." });
  }
  const exchanged = await exchangeKey(deps, record.apiKey);
  if (!exchanged.ok) {
    deps.store.deleteRefresh(refreshToken);
    return json(400, { error: "invalid_grant", error_description: "The agent key is no longer valid." });
  }
  return tokenJson(exchanged.token.accessToken, exchanged.token.expiresIn, refreshToken, exchanged.token.scopes);
}

/**
 * Authorization-code helper for ChatGPT Actions. The access token is the
 * agent JWT from the existing token exchange. These paths are not `/v1/agent`.
 */
export async function handleOAuthRequest(incoming: OAuthIncoming, deps: OAuthDeps): Promise<OAuthHttpResponse> {
  const route = routeOf(incoming.pathname);
  if (!route) return json(404, { error: "not_found", error_description: "Not found." });
  const method = incoming.method.toUpperCase();
  if (route === "authorize") {
    if (method === "GET") return authorizeGet(incoming, deps);
    if (method === "POST") return authorizePost(incoming, deps);
    return json(405, { error: "invalid_request" }, { allow: "GET, POST" });
  }
  if (method !== "POST") return json(405, { error: "invalid_request" }, { allow: "POST" });
  return tokenPost(incoming, deps);
}
