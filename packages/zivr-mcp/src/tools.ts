import { MAX_IMAGE_BYTES, MAX_MESSAGE_TEXT_LENGTH, SERVER_INSTRUCTIONS } from "./limits.js";
import { ZivrApiError, ZivrScopeError, type EventPage, type MutationResult } from "./client.js";
import {
  parseCalendarProposeArgs,
  parseReadNewArgs,
  parseSendMessageArgs,
} from "./validate.js";

export type ToolContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | {
    type: "resource";
    resource: { uri: string; name?: string; mimeType?: string; blob: string };
  };

export type ToolCallResult = {
  content: ToolContent[];
  isError?: boolean;
};

export type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
};

export type ToolSession = { since: number };

export type ZivrToolApi = {
  agentUserId(): Promise<string>;
  scopes(): Promise<string[]>;
  listChats(): Promise<unknown[]>;
  listEvents(since: number): Promise<EventPage>;
  sendMessage(input: {
    chatId?: string;
    peerId?: string;
    text: string;
    clientId: string;
    media?: unknown;
  }): Promise<MutationResult>;
  proposeCalendar(input: {
    chatId: string;
    title: string;
    startsAt: number;
    endsAt: number;
    note?: string;
    clientId: string;
  }): Promise<MutationResult>;
};

const MEDIA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["dataUrl"],
  description: "One image or one document. Video and audio are rejected.",
  properties: {
    kind: { type: "string", enum: ["image", "file"] },
    dataUrl: {
      type: "string",
      description: `data URL. Images: jpeg, png, webp, gif, heic, heif. Documents: PDF, Office, RTF, CSV, plain text, markdown. Decoded size max ${MAX_IMAGE_BYTES} bytes.`,
    },
    mimeType: { type: "string" },
    fileName: { type: "string", description: "Basename only, up to 120 characters." },
    security: {
      type: "string",
      enum: ["none", "password", "single-view", "timed"],
      description: "Images only. Defaults to none.",
    },
    password: { type: "string" },
    viewAfter: { type: "number" },
    width: { type: "number" },
    height: { type: "number" },
  },
} as const;

const CLIENT_ID_SCHEMA = {
  type: "string",
  minLength: 1,
  maxLength: 200,
  description: "Unique idempotency key (1–200 characters). Reuse it to retry the same send.",
} as const;

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: "zivr_read_new",
    title: "Read new ZIVR messages",
    description: [
      "Poll messages this agent can see, including image and PDF attachments.",
      "Use this to receive replies and files from the owner's other agents.",
      "Omit since to continue from the last cursor in this process (0 on the first call).",
      "Pass the previous nextSince to avoid rereading a page.",
      "The page includes messages you sent; inbound replies have a different senderId.",
      "Requires messages:read.",
    ].join(" "),
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        since: {
          type: "integer",
          minimum: 0,
          description: "Epoch-millisecond cursor. Events with createdAt greater than this value are returned.",
        },
      },
    },
  },
  {
    name: "zivr_list_chats",
    title: "List ZIVR chats",
    description: "List chats this agent belongs to. Use an id as chatId with zivr_send_message. Requires chats:list.",
    annotations: { readOnlyHint: true },
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "zivr_send_message",
    title: "Send a ZIVR message",
    description: [
      "Send text and an optional image or PDF as this agent.",
      "Provide exactly one of chatId or peerId.",
      "peerId must be another agent owned by the same person; the API opens or reuses that direct chat.",
      "clientId is required.",
      `text is required when there is no attachment and is at most ${MAX_MESSAGE_TEXT_LENGTH} characters.`,
      "Requires messages:send, and media:send when media is set.",
    ].join(" "),
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["clientId"],
      oneOf: [
        { required: ["chatId", "clientId"] },
        { required: ["peerId", "clientId"] },
      ],
      properties: {
        chatId: { type: "string", format: "uuid", description: "Existing chat. Omit when sending peerId." },
        peerId: {
          type: "string",
          format: "uuid",
          description: "Other same-owner agent's user id. Omit when sending chatId.",
        },
        text: { type: "string", maxLength: MAX_MESSAGE_TEXT_LENGTH },
        clientId: CLIENT_ID_SCHEMA,
        media: MEDIA_SCHEMA,
      },
    },
  },
  {
    name: "zivr_calendar_propose",
    title: "Propose a calendar slot",
    description: [
      "Draft a calendar slot card in a chat this agent already belongs to.",
      "The owner or chat admin must tap Yes before anything is written on the main calendar.",
      "Pass chatId, not peerId.",
      "startsAt and endsAt are epoch milliseconds.",
      "Requires calendar:propose, which new agent keys include unless the owner removed it.",
    ].join(" "),
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["chatId", "title", "startsAt", "endsAt", "clientId"],
      properties: {
        chatId: { type: "string", format: "uuid" },
        title: { type: "string", minLength: 1, maxLength: 140 },
        startsAt: { type: "integer", description: "Slot start, epoch milliseconds." },
        endsAt: { type: "integer", description: "Slot end, epoch milliseconds." },
        note: { type: "string", maxLength: 2000 },
        clientId: CLIENT_ID_SCHEMA,
      },
    },
  },
];

export function createToolSession(): ToolSession {
  return { since: 0 };
}

export async function listToolDefinitions(api: Pick<ZivrToolApi, "scopes">): Promise<ToolDefinition[]> {
  let scopes: string[] | null = null;
  try {
    scopes = await api.scopes();
  } catch {
    scopes = null;
  }
  return TOOL_DEFINITIONS.filter((tool) =>
    tool.name !== "zivr_calendar_propose" || scopes == null || scopes.includes("calendar:propose"),
  );
}

function textResult(text: string, extra: ToolContent[] = [], isError = false): ToolCallResult {
  const content: ToolContent[] = [{ type: "text", text }, ...extra];
  return isError ? { content, isError: true } : { content };
}

function formatFailure(err: unknown): string {
  if (err instanceof ZivrScopeError) {
    return `${err.message}. New keys include the default agent scopes unless the owner narrowed them.`;
  }
  if (err instanceof ZivrApiError) {
    const code = err.code ? ` (${err.code})` : "";
    const retry = err.retryAfter != null ? ` Retry after ${err.retryAfter}s.` : "";
    const base = `ZIVR API ${err.status}${code}: ${err.message}`;
    return `${base.endsWith(".") ? base : `${base}.`}${retry}`;
  }
  return err instanceof Error ? err.message : "ZIVR request failed";
}

const DATA_URL = /^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/i;

function field(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function attachment(message: Record<string, unknown>, index: number): { note: string; blocks: ToolContent[] } {
  const media = message["media"];
  if (!media || typeof media !== "object" || Array.isArray(media)) return { note: "", blocks: [] };
  const record = media as Record<string, unknown>;
  const kind = typeof record["kind"] === "string" ? record["kind"] : "";
  if (kind === "calendar_proposal") {
    const title = field(record, "title") || "untitled";
    const status = field(record, "status") || "pending";
    return { note: `calendar proposal "${title}" (${status})`, blocks: [] };
  }
  const dataUrl = typeof record["dataUrl"] === "string" ? record["dataUrl"] : "";
  const match = DATA_URL.exec(dataUrl);
  if (!match) return { note: kind ? `${kind} attachment (no inline bytes)` : "", blocks: [] };
  const mime = (match[1] ?? "").toLowerCase() === "image/jpg" ? "image/jpeg" : (match[1] ?? "").toLowerCase();
  const payload = match[2] ?? "";
  const messageId = field(message, "id") || String(index);
  if (mime.startsWith("image/")) {
    return {
      note: `image ${mime} (bytes follow)`,
      blocks: [{ type: "image", data: payload, mimeType: mime }],
    };
  }
  const name = field(record, "fileName") || `attachment-${index + 1}`;
  return {
    note: `file ${name} (${mime}, bytes follow)`,
    blocks: [{
      type: "resource",
      resource: { uri: `zivr://messages/${messageId}/file`, name, mimeType: mime, blob: payload },
    }],
  };
}

export function formatEventPage(page: EventPage, agentUserId: string, since: number): ToolCallResult {
  const lines = [
    `You are agent ${agentUserId || "unknown"}. Inbound replies have a different senderId.`,
    `since: ${since}`,
    `nextSince: ${page.nextSince}`,
    `events: ${page.events.length}`,
  ];
  if (page.events.length === 100) {
    lines.push("This page is full (100). Call zivr_read_new again with since set to nextSince.");
  } else if (page.events.length === 0) {
    lines.push("No new messages. Call zivr_read_new again later with since set to nextSince.");
  } else {
    lines.push("Call zivr_read_new again with since set to nextSince.");
  }
  const blocks: ToolContent[] = [];
  page.events.forEach((event, index) => {
    const message = event.message ?? {};
    const attached = event.message ? attachment(event.message, index) : { note: "", blocks: [] };
    const when = field(message, "createdAt");
    const iso = when && Number.isFinite(Number(when)) ? new Date(Number(when)).toISOString() : "";
    lines.push(
      "",
      `${index + 1}. ${event.type || "message.created"}`,
      `chatId: ${field(message, "chatId")}`,
      `messageId: ${field(message, "id")}`,
      `senderId: ${field(message, "senderId")}`,
      `senderName: ${field(message, "senderName")}`,
      `type: ${field(message, "type")}`,
      iso ? `at: ${iso}` : "",
      `text: ${typeof message["text"] === "string" ? message["text"] : ""}`,
      attached.note ? `media: ${attached.note}` : "",
    );
    blocks.push(...attached.blocks);
  });
  return textResult(lines.filter((line) => line !== "").join("\n"), blocks);
}

function formatSend(result: MutationResult): string {
  const record = result.body && typeof result.body === "object" ? result.body as Record<string, unknown> : {};
  const message = record["message"] && typeof record["message"] === "object"
    ? record["message"] as Record<string, unknown>
    : {};
  return [
    "Sent.",
    `chatId: ${field(message, "chatId")}`,
    `messageId: ${field(message, "id")}`,
    `type: ${field(message, "type")}`,
    `text: ${typeof message["text"] === "string" ? message["text"] : ""}`,
  ].join("\n");
}

function formatProposal(result: MutationResult): string {
  const record = result.body && typeof result.body === "object" ? result.body as Record<string, unknown> : {};
  const proposal = record["proposal"] && typeof record["proposal"] === "object"
    ? record["proposal"] as Record<string, unknown>
    : {};
  const message = record["message"] && typeof record["message"] === "object"
    ? record["message"] as Record<string, unknown>
    : {};
  const created = result.status === 201 ? "Proposal posted. It stays pending until the owner or a chat admin taps Yes." : "This clientId already had a proposal. Returning the existing card.";
  return [
    created,
    `proposalId: ${field(proposal, "id")}`,
    `status: ${field(proposal, "status")}`,
    `chatId: ${field(proposal, "chatId")}`,
    `messageId: ${field(message, "id")}`,
    `title: ${field(proposal, "title")}`,
    `startsAt: ${field(proposal, "startsAt")}`,
    `endsAt: ${field(proposal, "endsAt")}`,
  ].join("\n");
}

export async function callTool(
  name: string,
  args: unknown,
  api: ZivrToolApi,
  session: ToolSession,
  now = Date.now(),
): Promise<ToolCallResult> {
  try {
    if (name === "zivr_read_new") {
      const parsed = parseReadNewArgs(args ?? {});
      if (!parsed.ok) return textResult(parsed.error, [], true);
      const since = parsed.value.since ?? session.since;
      const page = await api.listEvents(since);
      session.since = page.nextSince;
      const agentUserId = await api.agentUserId().catch(() => "");
      return formatEventPage(page, agentUserId, since);
    }
    if (name === "zivr_list_chats") {
      if (args != null && (typeof args !== "object" || Array.isArray(args) || Object.keys(args).length > 0)) {
        return textResult("zivr_list_chats takes no arguments", [], true);
      }
      const chats = await api.listChats();
      return textResult(chats.length === 0 ? "No chats yet." : JSON.stringify(chats, null, 2));
    }
    if (name === "zivr_send_message") {
      const parsed = parseSendMessageArgs(args);
      if (!parsed.ok) return textResult(parsed.error, [], true);
      const result = await api.sendMessage(parsed.value);
      return textResult(formatSend(result));
    }
    if (name === "zivr_calendar_propose") {
      const parsed = parseCalendarProposeArgs(args, now);
      if (!parsed.ok) return textResult(parsed.error, [], true);
      const result = await api.proposeCalendar(parsed.value);
      return textResult(formatProposal(result));
    }
    return textResult(`Unknown tool: ${name}`, [], true);
  } catch (err) {
    return textResult(formatFailure(err), [], true);
  }
}

export { SERVER_INSTRUCTIONS };
