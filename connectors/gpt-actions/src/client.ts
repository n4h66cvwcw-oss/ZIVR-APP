import {
  API_KEY_PATTERN,
  DATA_URL_FILE,
  DATA_URL_IMAGE,
  DEFAULT_API_BASE,
  FILE_MIME_TYPES,
  GPT_ACTION_MAX_CHARS,
  IMAGE_MIME_TYPES,
  IMAGE_SECURITY,
  MAX_CLIENT_ID_LENGTH,
  MAX_IMAGE_BYTES,
  MAX_MESSAGE_TEXT_LENGTH,
  MAX_PROPOSAL_NOTE_LENGTH,
  MAX_PROPOSAL_TITLE_LENGTH,
  MAX_SLOT_LEAD_MS,
  MAX_SLOT_MS,
  SLOT_PAST_GRACE_MS,
  UUID_PATTERN,
} from "./limits.js";

export class GptActionsError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly retryAfter: number | undefined;

  constructor(message: string, status: number, code?: string, retryAfter?: number) {
    super(message);
    this.name = "GptActionsError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type AgentAccessToken = {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  agentUserId: string;
  scopes: string[];
};

export type ExchangeResult =
  | { ok: true; token: AgentAccessToken }
  | { ok: false; status: number; error: string; code: string };

export type TokenExchanger = (apiKey: string) => Promise<ExchangeResult>;

export type OutboundImage = {
  kind: "image";
  mimeType: string;
  dataUrl: string;
  security: "none" | "password" | "single-view" | "timed";
  width?: number;
  height?: number;
  password?: string;
  viewAfter?: number;
};

export type OutboundFile = {
  kind: "file";
  mimeType: string;
  dataUrl: string;
  fileName?: string;
};

export type OutboundMedia = OutboundImage | OutboundFile;

export type SendMessageInput = {
  chatId?: string;
  peerId?: string;
  text?: string;
  clientId: string;
  media?: OutboundMedia;
};

export type CalendarProposalInput = {
  chatId: string;
  title: string;
  startsAt: number;
  endsAt: number;
  note?: string;
  clientId: string;
};

export type AgentEvent = {
  type: string;
  message?: Record<string, unknown>;
};

export type EventPage = {
  events: AgentEvent[];
  nextSince: number;
};

export type GptActionsClientOptions = {
  accessToken: string;
  baseUrl?: string;
  fetch?: FetchLike;
  timeoutMs?: number;
  /** When set, a send or proposal whose JSON exceeds this many characters is rejected. */
  maxPayloadChars?: number;
  now?: () => number;
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
    throw new GptActionsError("API base must be an http(s) URL", 0, "invalid");
  }
  if (base.protocol !== "https:" && base.protocol !== "http:") {
    throw new GptActionsError("API base must be an http(s) URL", 0, "invalid");
  }
  if (base.username || base.password) {
    throw new GptActionsError("API base must not include credentials", 0, "invalid");
  }
  const trimmed = base.pathname.replace(/\/+$/, "");
  const prefix = trimmed.endsWith("/api/v1") || /(^|\/)v1$/.test(trimmed) ? trimmed : `${trimmed}/v1`;
  const suffix = resource.replace(/^\/+/, "");
  const pathname = `${prefix}/${suffix}`.replace(/\/{2,}/g, "/");
  base.pathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  base.search = "";
  base.hash = "";
  return base.toString();
}

export function senderIdOf(message: unknown): string | null {
  if (!message || typeof message !== "object" || Array.isArray(message)) return null;
  const senderId = (message as Record<string, unknown>)["senderId"];
  return typeof senderId === "string" && senderId.length > 0 ? senderId : null;
}

/** Drops this agent's own echoes so a poll can show the other twin's replies. */
export function inboundMessages(page: EventPage, ownSenderId: string): AgentEvent[] {
  if (!ownSenderId) return page.events;
  return page.events.filter((event) => senderIdOf(event.message) !== ownSenderId);
}

function decodedBase64Bytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function cleanFileName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const base = value.split(/[/\\]/).pop()?.trim() ?? "";
  if (!base || base.length > 120 || !/^[\w. ()-]+$/.test(base)) return undefined;
  return base;
}

function invalid(message: string): never {
  throw new GptActionsError(message, 400, "invalid");
}

export function normalizeOutboundMedia(input: OutboundMedia): OutboundMedia {
  if (!input || typeof input !== "object") invalid("Attachment is invalid");
  if (input.kind !== "image" && input.kind !== "file") invalid("Attachment must be an image or a file");
  if (typeof input.dataUrl !== "string" || input.dataUrl.length === 0) invalid("Attachment is invalid");
  if (input.kind === "image") {
    const match = DATA_URL_IMAGE.exec(input.dataUrl);
    if (!match) invalid("Image attachment is invalid");
    const mime = (match[1] ?? "").toLowerCase() === "image/jpg" ? "image/jpeg" : (match[1] ?? "").toLowerCase();
    const base64 = match[2] ?? "";
    if (!IMAGE_MIME_TYPES.has(mime) || base64.length === 0) invalid("Image attachment is invalid");
    if (decodedBase64Bytes(base64) > MAX_IMAGE_BYTES) invalid(`Image attachment is too large (max ${MAX_IMAGE_BYTES} bytes)`);
    const security = input.security ?? "none";
    if (!IMAGE_SECURITY.has(security)) invalid("Image attachment is invalid");
    if (security === "password" && (!input.password || input.password.trim().length === 0 || input.password.length > 200)) {
      invalid("Image attachment is invalid");
    }
    if (security === "timed" && (typeof input.viewAfter !== "number" || !Number.isFinite(input.viewAfter))) {
      invalid("Image attachment is invalid");
    }
    return {
      kind: "image",
      mimeType: mime,
      dataUrl: `data:${mime};base64,${base64}`,
      security,
      ...(typeof input.width === "number" && input.width > 0 ? { width: Math.round(input.width) } : {}),
      ...(typeof input.height === "number" && input.height > 0 ? { height: Math.round(input.height) } : {}),
      ...(security === "password" && input.password ? { password: input.password } : {}),
      ...(security === "timed" && input.viewAfter != null ? { viewAfter: input.viewAfter } : {}),
    };
  }
  const match = DATA_URL_FILE.exec(input.dataUrl);
  if (!match) invalid("File attachment is invalid");
  const mime = (match[1] ?? "").toLowerCase();
  const base64 = match[2] ?? "";
  if (mime.startsWith("video/") || mime.startsWith("audio/")) invalid("Video and audio are not allowed for agents yet");
  if (!FILE_MIME_TYPES.has(mime)) invalid("This file type is not allowed");
  if (base64.length === 0) invalid("File attachment is invalid");
  if (decodedBase64Bytes(base64) > MAX_IMAGE_BYTES) invalid(`File attachment is too large (max ${MAX_IMAGE_BYTES} bytes)`);
  const fileName = cleanFileName(input.fileName);
  return {
    kind: "file",
    mimeType: mime,
    dataUrl: `data:${mime};base64,${base64}`,
    ...(fileName ? { fileName } : {}),
  };
}

function requireClientId(clientId: string): string {
  if (typeof clientId !== "string") invalid("clientId is required");
  const trimmed = clientId.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_CLIENT_ID_LENGTH) {
    invalid(`clientId must be 1–${MAX_CLIENT_ID_LENGTH} characters`);
  }
  return trimmed;
}

function requireUuid(value: string | undefined, name: string): string {
  if (!value || !UUID_PATTERN.test(value)) invalid(`${name} must be a UUID`);
  return value;
}

export function normalizeSendInput(input: SendMessageInput): SendMessageInput {
  const hasChat = input.chatId != null && input.chatId !== "";
  const hasPeer = input.peerId != null && input.peerId !== "";
  if (hasChat === hasPeer) invalid("Provide exactly one of chatId or peerId");
  const clientId = requireClientId(input.clientId);
  const text = input.text ?? "";
  if (typeof text !== "string") invalid("text must be a string");
  if (text.length > MAX_MESSAGE_TEXT_LENGTH) invalid(`text must be at most ${MAX_MESSAGE_TEXT_LENGTH} characters`);
  const media = input.media == null ? undefined : normalizeOutboundMedia(input.media);
  if (!text.trim() && !media) invalid("text or an image/PDF is required");
  return {
    ...(hasChat ? { chatId: requireUuid(input.chatId, "chatId") } : {}),
    ...(hasPeer ? { peerId: requireUuid(input.peerId, "peerId") } : {}),
    text: media ? text.trim() : text,
    clientId,
    ...(media ? { media } : {}),
  };
}

export function normalizeProposalInput(input: CalendarProposalInput, now = Date.now()): CalendarProposalInput {
  if ("peerId" in input) invalid("Calendar proposals need chatId");
  const chatId = requireUuid(input.chatId, "chatId");
  const clientId = requireClientId(input.clientId);
  if (typeof input.title !== "string" || input.title.trim().length < 1 || input.title.trim().length > MAX_PROPOSAL_TITLE_LENGTH) {
    invalid("title is required");
  }
  if (typeof input.startsAt !== "number" || typeof input.endsAt !== "number" || !Number.isFinite(input.startsAt) || !Number.isFinite(input.endsAt)) {
    invalid("startsAt and endsAt must be epoch milliseconds");
  }
  if (input.endsAt <= input.startsAt) invalid("The slot must end after it starts");
  if (input.endsAt - input.startsAt > MAX_SLOT_MS) invalid("The slot is too long");
  if (input.startsAt < now - SLOT_PAST_GRACE_MS) invalid("The slot is in the past");
  if (input.startsAt > now + MAX_SLOT_LEAD_MS) invalid("The slot is too far in the future");
  let note: string | undefined;
  if (input.note != null && input.note !== "") {
    if (typeof input.note !== "string" || input.note.trim().length > MAX_PROPOSAL_NOTE_LENGTH) invalid("note is too long");
    const trimmed = input.note.trim();
    if (trimmed) note = trimmed;
  }
  return {
    chatId,
    title: input.title.trim(),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    clientId,
    ...(note ? { note } : {}),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function errorFrom(body: unknown, status: number): { message: string; code?: string } {
  const record = asRecord(body);
  if (record) {
    const message = typeof record["error"] === "string" && record["error"].length > 0
      ? record["error"]
      : `ZIVR API returned ${status}`;
    const code = typeof record["code"] === "string" ? record["code"] : undefined;
    return code ? { message, code } : { message };
  }
  if (typeof body === "string" && body.trim()) return { message: body.trim() };
  return { message: `ZIVR API returned ${status}` };
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

function parseToken(body: unknown, status: number): AgentAccessToken {
  const record = asRecord(body);
  const accessToken = record && typeof record["accessToken"] === "string" ? record["accessToken"] : "";
  if (!accessToken) throw new GptActionsError("Token response did not include accessToken", status, "invalid");
  const expiresIn = record && typeof record["expiresIn"] === "number" && record["expiresIn"] > 0
    ? record["expiresIn"]
    : 60 * 60;
  const scopes = record && Array.isArray(record["scopes"])
    ? record["scopes"].filter((scope): scope is string => typeof scope === "string")
    : [];
  const agentUserId = record && typeof record["agentUserId"] === "string" ? record["agentUserId"] : "";
  return { accessToken, tokenType: "Bearer", expiresIn, agentUserId, scopes };
}

/**
 * Paste-key exchange against `POST /v1/agent/token`. Local and MCP clients use
 * this directly. Custom GPT Actions do not: ChatGPT would send the same key
 * on every action, and those routes accept only the JWT.
 */
export async function exchangeAgentApiKey(
  apiKey: string,
  options: { baseUrl?: string; fetch?: FetchLike; timeoutMs?: number } = {},
): Promise<ExchangeResult> {
  if (!API_KEY_PATTERN.test(apiKey)) {
    return { ok: false, status: 401, error: "API key is invalid", code: "auth" };
  }
  const fetchImpl = options.fetch ?? ((url, init) => fetch(url, init));
  const url = resolveAgentUrl(options.baseUrl?.trim() || DEFAULT_API_BASE, "agent/token");
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ apiKey }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return { ok: false, status: 504, error: "Agent token exchange timed out", code: "timeout" };
    }
    return { ok: false, status: 502, error: "Agent token exchange failed", code: "upstream" };
  }
  const body = await readBody(response);
  if (response.status < 200 || response.status >= 300) {
    const info = errorFrom(body, response.status);
    return { ok: false, status: response.status, error: info.message, code: info.code ?? "upstream" };
  }
  try {
    return { ok: true, token: parseToken(body, response.status) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token response was invalid";
    return { ok: false, status: 502, error: message, code: "invalid" };
  }
}

export function createHttpTokenExchanger(options: {
  baseUrl?: string;
  fetch?: FetchLike;
  timeoutMs?: number;
} = {}): TokenExchanger {
  return (apiKey) => exchangeAgentApiKey(apiKey, options);
}

/**
 * Calls `/v1/agent/*` with an agent JWT. ChatGPT holds that JWT as the OAuth
 * access token and refreshes it through the connector, not through this class.
 */
export class GptActionsClient {
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly maxPayloadChars: number;
  private readonly now: () => number;

  constructor(options: GptActionsClientOptions) {
    if (!options.accessToken.trim()) throw new GptActionsError("An access token is required", 401, "auth");
    this.accessToken = options.accessToken.trim();
    this.baseUrl = options.baseUrl?.trim() || DEFAULT_API_BASE;
    this.fetchImpl = options.fetch ?? ((url, init) => fetch(url, init));
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxPayloadChars = options.maxPayloadChars ?? GPT_ACTION_MAX_CHARS;
    this.now = options.now ?? (() => Date.now());
    resolveAgentUrl(this.baseUrl, "agent/chats");
  }

  async listChats(): Promise<unknown[]> {
    const result = await this.send("GET", "agent/chats");
    const record = asRecord(result.body);
    if (!record || !Array.isArray(record["chats"])) throw new GptActionsError("Unexpected chats payload", 502, "invalid");
    return record["chats"];
  }

  async listEvents(since = 0): Promise<EventPage> {
    if (!Number.isInteger(since) || since < 0) invalid("since must be an epoch millisecond cursor");
    const url = new URL(resolveAgentUrl(this.baseUrl, "agent/events"));
    url.searchParams.set("since", String(since));
    const result = await this.send("GET", url);
    const record = asRecord(result.body);
    if (!record || !Array.isArray(record["events"])) throw new GptActionsError("Unexpected events payload", 502, "invalid");
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

  async sendMessage(input: SendMessageInput): Promise<{ status: number; message: unknown }> {
    const body = normalizeSendInput(input);
    this.assertPayload(body);
    const result = await this.send("POST", "agent/messages", body, true);
    const record = asRecord(result.body);
    if (!record || !("message" in record)) throw new GptActionsError("Unexpected message payload", result.status, "invalid");
    return { status: result.status, message: record["message"] };
  }

  async proposeCalendar(input: CalendarProposalInput): Promise<{ status: number; proposal: unknown; message: unknown }> {
    const body = normalizeProposalInput(input, this.now());
    this.assertPayload(body);
    const result = await this.send("POST", "agent/calendar/proposals", body, true);
    const record = asRecord(result.body);
    if (!record || !("proposal" in record) || !("message" in record)) {
      throw new GptActionsError("Unexpected proposal payload", result.status, "invalid");
    }
    return { status: result.status, proposal: record["proposal"], message: record["message"] };
  }

  private assertPayload(body: unknown): void {
    const encoded = JSON.stringify(body);
    if (encoded.length >= this.maxPayloadChars) {
      invalid(`ChatGPT Actions reject payloads of ${this.maxPayloadChars} characters or more. Shrink the attachment.`);
    }
  }

  private async send(
    method: "GET" | "POST",
    resource: string | URL,
    jsonBody?: unknown,
    measured = false,
  ): Promise<{ status: number; body: unknown }> {
    if (jsonBody !== undefined && !measured) this.assertPayload(jsonBody);
    const url = resource instanceof URL ? resource.toString() : resolveAgentUrl(this.baseUrl, resource);
    const headers: Record<string, string> = {
      accept: "application/json",
      authorization: `Bearer ${this.accessToken}`,
    };
    const init: RequestInit = { method, headers };
    if (jsonBody !== undefined) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(jsonBody);
    }
    let response: Response;
    try {
      response = await this.fetchImpl(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "TimeoutError" || name === "AbortError") {
        throw new GptActionsError("ZIVR API request timed out", 0, "timeout");
      }
      const message = err instanceof Error ? err.message : "network error";
      throw new GptActionsError(`ZIVR API request failed: ${message}`, 0, "network");
    }
    const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
    const body = await readBody(response);
    if (response.status < 200 || response.status >= 300) {
      const info = errorFrom(body, response.status);
      throw new GptActionsError(info.message, response.status, info.code, retryAfter);
    }
    return { status: response.status, body };
  }
}
