import { TOKEN_REFRESH_SKEW_MS, DEFAULT_API_BASE } from "./limits.js";
import type { CalendarProposalInput, SendMessageInput } from "./validate.js";

export class ZivrApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly retryAfter: number | undefined;

  constructor(message: string, status: number, code?: string, retryAfter?: number) {
    super(message);
    this.name = "ZivrApiError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export class ZivrScopeError extends Error {
  readonly scope: string;

  constructor(scope: string) {
    super(`This key does not include ${scope}`);
    this.name = "ZivrScopeError";
    this.scope = scope;
  }
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type AgentEvent = {
  type: string;
  message?: Record<string, unknown>;
};

export type EventPage = {
  events: AgentEvent[];
  nextSince: number;
};

export type MutationResult = {
  status: number;
  body: unknown;
};

type TokenState = {
  accessToken: string;
  issuedAt: number;
  expiresAt: number;
  agentUserId: string;
  scopes: string[];
};

export type ZivrAgentClientOptions = {
  apiKey: string;
  baseUrl?: string;
  fetch?: FetchLike;
  now?: () => number;
  refreshSkewMs?: number;
  timeoutMs?: number;
};

/**
 * Joins a configured base with an agent resource.
 * `https://api.zivrapp.com` and `https://api.zivrapp.com/api` both work.
 * A base that already ends in `/v1` or `/api/v1` is not prefixed twice.
 */
export function resolveAgentUrl(baseUrl: string, resource: string): string {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new Error("ZIVR_API_BASE must be an http(s) URL");
  }
  if (base.protocol !== "https:" && base.protocol !== "http:") {
    throw new Error("ZIVR_API_BASE must be an http(s) URL");
  }
  if (base.username || base.password) throw new Error("ZIVR_API_BASE must not include credentials");
  const trimmed = base.pathname.replace(/\/+$/, "");
  const prefix = trimmed.endsWith("/api/v1") || /(^|\/)v1$/.test(trimmed)
    ? trimmed
    : `${trimmed}/v1`;
  const suffix = resource.replace(/^\/+/, "");
  const pathname = `${prefix}/${suffix}`.replace(/\/{2,}/g, "/");
  base.pathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  base.search = "";
  base.hash = "";
  return base.toString();
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return Math.ceil(seconds);
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text.slice(0, 500);
  }
}

function errorFrom(body: unknown, status: number): { message: string; code?: string } {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    const message = typeof record["error"] === "string" && record["error"].length > 0
      ? record["error"]
      : `ZIVR API returned ${status}`;
    const code = typeof record["code"] === "string" ? record["code"] : undefined;
    return code ? { message, code } : { message };
  }
  if (typeof body === "string" && body.trim()) return { message: body.trim() };
  return { message: `ZIVR API returned ${status}` };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Paste-key client for `/v1/agent/*`.
 * Exchanges `zivr_agent_…` for a one-hour Bearer JWT and refreshes before expiry.
 */
export class ZivrAgentClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => number;
  private readonly refreshSkewMs: number;
  private readonly timeoutMs: number;
  private cached: TokenState | null = null;
  private pending: Promise<TokenState> | null = null;

  constructor(options: ZivrAgentClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl?.trim() || DEFAULT_API_BASE;
    this.fetchImpl = options.fetch ?? ((url, init) => fetch(url, init));
    this.now = options.now ?? (() => Date.now());
    this.refreshSkewMs = options.refreshSkewMs ?? TOKEN_REFRESH_SKEW_MS;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    resolveAgentUrl(this.baseUrl, "agent/token");
  }

  async agentUserId(): Promise<string> {
    return (await this.token()).agentUserId;
  }

  async scopes(): Promise<string[]> {
    return [...(await this.token()).scopes];
  }

  async listChats(): Promise<unknown[]> {
    const body = await this.send("GET", "agent/chats", "chats:list");
    const record = asRecord(body.body);
    if (!record || !Array.isArray(record["chats"])) {
      throw new ZivrApiError("Unexpected chats payload", body.status, "invalid");
    }
    return record["chats"];
  }

  async listEvents(since: number): Promise<EventPage> {
    const url = new URL(resolveAgentUrl(this.baseUrl, "agent/events"));
    url.searchParams.set("since", String(since));
    const body = await this.send("GET", url, "messages:read");
    const record = asRecord(body.body);
    if (!record || !Array.isArray(record["events"])) {
      throw new ZivrApiError("Unexpected events payload", body.status, "invalid");
    }
    const events: AgentEvent[] = [];
    for (const entry of record["events"]) {
      const item = asRecord(entry);
      if (!item) continue;
      const type = typeof item["type"] === "string" ? item["type"] : "message.created";
      const message = asRecord(item["message"]);
      events.push(message ? { type, message } : { type });
    }
    const nextSince = typeof record["nextSince"] === "number" && Number.isFinite(record["nextSince"])
      ? record["nextSince"]
      : since;
    return { events, nextSince };
  }

  async sendMessage(input: SendMessageInput): Promise<MutationResult> {
    const scopes = ["messages:send", ...(input.media ? ["media:send"] : [])];
    return this.send("POST", "agent/messages", scopes, input);
  }

  async proposeCalendar(input: CalendarProposalInput): Promise<MutationResult> {
    return this.send("POST", "agent/calendar/proposals", "calendar:propose", input);
  }

  private async send(
    method: "GET" | "POST",
    resource: string | URL,
    scope: string | string[],
    jsonBody?: unknown,
    allowRetry = true,
  ): Promise<MutationResult> {
    const required = Array.isArray(scope) ? scope : [scope];
    const used = await this.token();
    for (const name of required) {
      if (!used.scopes.includes(name)) throw new ZivrScopeError(name);
    }
    const url = resource instanceof URL ? resource.toString() : resolveAgentUrl(this.baseUrl, resource);
    const headers: Record<string, string> = {
      accept: "application/json",
      authorization: `Bearer ${used.accessToken}`,
    };
    const init: RequestInit = { method, headers };
    if (jsonBody !== undefined) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(jsonBody);
    }
    const result = await this.request(url, init);
    if (result.status === 401 && allowRetry) {
      if (this.cached?.accessToken === used.accessToken) this.cached = null;
      return this.send(method, resource, scope, jsonBody, false);
    }
    if (result.status < 200 || result.status >= 300) {
      const info = errorFrom(result.body, result.status);
      throw new ZivrApiError(info.message, result.status, info.code, result.retryAfter);
    }
    return { status: result.status, body: result.body };
  }

  private async token(): Promise<TokenState> {
    const now = this.now();
    if (this.cached && this.isFresh(this.cached, now)) return this.cached;
    if (!this.pending) {
      let current: Promise<TokenState>;
      current = this.exchange().finally(() => {
        if (this.pending === current) this.pending = null;
      });
      this.pending = current;
    }
    try {
      return await this.pending;
    } catch (err) {
      if (this.cached && this.now() < this.cached.expiresAt) return this.cached;
      throw err;
    }
  }

  private isFresh(token: TokenState, now: number): boolean {
    const ttlMs = token.expiresAt - token.issuedAt;
    const skew = Math.min(this.refreshSkewMs, Math.max(0, Math.floor(ttlMs / 2)));
    return now < token.expiresAt - skew;
  }

  private async exchange(): Promise<TokenState> {
    const url = resolveAgentUrl(this.baseUrl, "agent/token");
    const result = await this.request(url, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ apiKey: this.apiKey }),
    });
    if (result.status < 200 || result.status >= 300) {
      const info = errorFrom(result.body, result.status);
      throw new ZivrApiError(info.message, result.status, info.code, result.retryAfter);
    }
    const record = asRecord(result.body);
    const accessToken = record && typeof record["accessToken"] === "string" ? record["accessToken"] : "";
    if (!accessToken) throw new ZivrApiError("Token response did not include accessToken", result.status, "invalid");
    const expiresIn = record && typeof record["expiresIn"] === "number" && record["expiresIn"] > 0
      ? record["expiresIn"]
      : 60 * 60;
    const issuedAt = this.now();
    const scopes = record && Array.isArray(record["scopes"])
      ? record["scopes"].filter((scope): scope is string => typeof scope === "string")
      : [];
    const agentUserId = record && typeof record["agentUserId"] === "string" ? record["agentUserId"] : "";
    const state: TokenState = {
      accessToken,
      issuedAt,
      expiresAt: issuedAt + expiresIn * 1000,
      agentUserId,
      scopes,
    };
    this.cached = state;
    return state;
  }

  private async request(url: string, init: RequestInit): Promise<{ status: number; body: unknown; retryAfter?: number }> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "TimeoutError" || name === "AbortError") {
        throw new ZivrApiError("ZIVR API request timed out", 0, "timeout");
      }
      const message = err instanceof Error ? err.message : "network error";
      throw new ZivrApiError(`ZIVR API request failed: ${message}`, 0, "network");
    }
    const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
    const body = await readBody(response);
    return retryAfter == null ? { status: response.status, body } : { status: response.status, body, retryAfter };
  }
}
