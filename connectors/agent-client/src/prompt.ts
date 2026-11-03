import { randomBytes } from "node:crypto";
import { ZivrApiError, ZivrScopeError, asRecord, type AgentEvent, type EventPage, type MutationResult, type ZivrAgentApi } from "./client.js";
import {
  EVENT_PAGE_SIZE,
  MAX_CLIENT_ID_LENGTH,
  MAX_MESSAGE_TEXT_LENGTH,
  MAX_TEXT_EXCERPT,
  MAX_TOOL_TEXT_LENGTH,
  TEXT_MIME_TYPES,
  UUID_PATTERN,
} from "./limits.js";
import { normalizeOutboundMedia, type OutboundMedia } from "./media.js";

export type PromptFile = {
  mimeType: string;
  fileName?: string;
  base64: string;
  mediaRef: string;
};

export type TurnInput = {
  text: string;
  files: PromptFile[];
};

export type TurnResult = {
  text: string;
  toolCalls: number;
  sends: number;
};

export type TurnSession = {
  runTurn(input: TurnInput): Promise<TurnResult>;
};

export type ToolMemory = { since: number };

export type ZivrFunctionDeclaration = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

const DATA_URL = /^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/i;

export const ZIVR_FUNCTIONS: readonly ZivrFunctionDeclaration[] = [
  {
    name: "zivr_send_message",
    description: "Send text and an optional bridged attachment as this ZIVR agent. Provide exactly one of chatId or peerId.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        chatId: { type: "string", description: "Existing chat UUID. Omit when peerId is set." },
        peerId: { type: "string", description: "Same-owner agent user id. Omit when chatId is set." },
        text: { type: "string", description: `Message text, at most ${MAX_MESSAGE_TEXT_LENGTH} characters. Required when mediaRef is omitted.` },
        clientId: { type: "string", description: "Idempotency key, 1–200 characters. Omit to let the bridge generate one." },
        mediaRef: { type: "string", description: "Local attachment id such as file:1. The bridge resolves it. Do not paste bytes." },
      },
    },
  },
  {
    name: "zivr_list_chats",
    description: "List chats this agent already belongs to.",
    parameters: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "zivr_read_new",
    description: "Poll messages this agent can see. Pass since from the previous nextSince. File bytes are returned beside this result when the provider call can carry them.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        since: { type: "integer", description: "Epoch-millisecond cursor. Omit to continue from this process." },
      },
    },
  },
];

export class AttachmentStash {
  private seq = 0;
  private readonly items = new Map<string, OutboundMedia>();

  put(media: OutboundMedia): string {
    const normalized = normalizeOutboundMedia(media);
    this.seq += 1;
    const ref = `file:${this.seq}`;
    this.items.set(ref, normalized);
    return ref;
  }

  get(ref: string): OutboundMedia | undefined {
    return this.items.get(ref);
  }
}

export function createToolMemory(): ToolMemory {
  return { since: 0 };
}

export function senderIdOf(message: unknown): string | null {
  const record = asRecord(message);
  const senderId = record?.["senderId"];
  return typeof senderId === "string" && senderId.length > 0 ? senderId : null;
}

export function inboundEvents(page: EventPage, ownSenderId: string): AgentEvent[] {
  if (!ownSenderId) return page.events.filter((event) => event.message != null);
  return page.events.filter((event) => event.message != null && senderIdOf(event.message) !== ownSenderId);
}

function field(record: Record<string, unknown> | undefined, key: string): string {
  if (!record) return "";
  const value = record[key];
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function messageKey(event: AgentEvent): string {
  const id = field(event.message, "id");
  if (id) return id;
  return [
    field(event.message, "chatId"),
    field(event.message, "senderId"),
    field(event.message, "createdAt"),
    field(event.message, "text").slice(0, 40),
  ].join(":");
}

type RawFile = { mimeType: string; fileName?: string; base64: string };

function filesInMessage(message: Record<string, unknown> | undefined): RawFile[] {
  if (!message) return [];
  const media = asRecord(message["media"]);
  if (!media) return [];
  const kind = typeof media["kind"] === "string" ? media["kind"] : "";
  if (kind === "calendar_proposal") return [];
  const dataUrl = typeof media["dataUrl"] === "string" ? media["dataUrl"] : "";
  const match = DATA_URL.exec(dataUrl);
  if (!match) return [];
  const mime = (match[1] ?? "").toLowerCase() === "image/jpg" ? "image/jpeg" : (match[1] ?? "").toLowerCase();
  const base64 = match[2] ?? "";
  if (!mime || !base64) return [];
  const fileName = typeof media["fileName"] === "string" ? media["fileName"] : undefined;
  return [{ mimeType: mime, ...(fileName ? { fileName } : {}), base64 }];
}

function excerpt(base64: string, mime: string): string {
  if (!TEXT_MIME_TYPES.has(mime)) return "";
  let text: string;
  try {
    text = Buffer.from(base64, "base64").toString("utf8");
  } catch {
    return "";
  }
  if (text.includes("\u0000")) return "";
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.length > MAX_TEXT_EXCERPT ? `${trimmed.slice(0, MAX_TEXT_EXCERPT)}…` : trimmed;
}

function stashFiles(message: Record<string, unknown> | undefined, stash: AttachmentStash): PromptFile[] {
  const stored: PromptFile[] = [];
  for (const file of filesInMessage(message)) {
    try {
      const media: OutboundMedia = file.mimeType.startsWith("image/")
        ? { kind: "image", mimeType: file.mimeType, dataUrl: `data:${file.mimeType};base64,${file.base64}`, security: "none" }
        : {
          kind: "file",
          mimeType: file.mimeType,
          dataUrl: `data:${file.mimeType};base64,${file.base64}`,
          ...(file.fileName ? { fileName: file.fileName } : {}),
        };
      const mediaRef = stash.put(media);
      stored.push({ ...file, mediaRef });
    } catch {
      /* The event listed an attachment this bridge will not re-send. */
    }
  }
  return stored;
}

function mediaLine(message: Record<string, unknown> | undefined, files: PromptFile[]): string {
  const media = asRecord(message?.["media"]);
  if (!media) return "";
  const kind = typeof media["kind"] === "string" ? media["kind"] : "";
  if (kind === "calendar_proposal") {
    const title = field(media, "title") || "untitled";
    const status = field(media, "status") || "pending";
    return `media: calendar proposal "${title}" (${status})`;
  }
  if (files.length === 0) {
    if (!kind && !field(media, "mimeType")) return "";
    const bits = [kind, field(media, "fileName"), field(media, "mimeType")].filter((bit) => bit !== "");
    return `media: ${bits.join(" ")} (bytes omitted)`;
  }
  return files.map((file) => {
    const name = file.fileName ? `${file.fileName} ` : "";
    return `media: ${name}${file.mimeType} stored as ${file.mediaRef}`;
  }).join("\n");
}

export function prepareInboundTurn(event: AgentEvent, stash: AttachmentStash, agentUserId: string): TurnInput | null {
  if (!event.message) return null;
  const files = stashFiles(event.message, stash);
  const when = field(event.message, "createdAt");
  const iso = when && Number.isFinite(Number(when)) ? new Date(Number(when)).toISOString() : "";
  const lines = [
    `Inbound ${event.type || "message.created"}.`,
    agentUserId ? `You are agent ${agentUserId}. This message is from someone else.` : "This message is from someone else.",
    `chatId: ${field(event.message, "chatId")}`,
    `messageId: ${field(event.message, "id")}`,
    `senderId: ${field(event.message, "senderId")}`,
    `senderName: ${field(event.message, "senderName")}`,
    iso ? `at: ${iso}` : "",
    `text: ${typeof event.message["text"] === "string" ? event.message["text"] : ""}`,
    mediaLine(event.message, files),
    ...files.map((file) => {
      const quote = excerpt(file.base64, file.mimeType);
      return quote ? `excerpt ${file.mediaRef}:\n${quote}` : "";
    }),
    "Reply in this chat only by calling zivr_send_message with this chatId.",
    "Text you return is shown to the operator and is not delivered unless you call the tool.",
  ];
  return { text: lines.filter((line) => line !== "").join("\n"), files };
}

function clip(text: string): string {
  return text.length > MAX_TOOL_TEXT_LENGTH ? `${text.slice(0, MAX_TOOL_TEXT_LENGTH)}…` : text;
}

export function formatSendResult(result: MutationResult): string {
  const record = asRecord(result.body) ?? {};
  const message = asRecord(record["message"]) ?? {};
  return [
    "Sent.",
    `chatId: ${field(message, "chatId")}`,
    `messageId: ${field(message, "id")}`,
    `type: ${field(message, "type")}`,
  ].join("\n");
}

export function formatEventPage(page: EventPage, agentUserId: string, since: number, filesByMessage: Map<string, PromptFile[]>): string {
  const lines = [
    `You are agent ${agentUserId || "unknown"}. Inbound replies have a different senderId.`,
    `since: ${since}`,
    `nextSince: ${page.nextSince}`,
    `events: ${page.events.length}`,
  ];
  if (page.events.length >= EVENT_PAGE_SIZE) {
    lines.push(`This page is full (${EVENT_PAGE_SIZE}). Call zivr_read_new again with since set to nextSince.`);
  } else if (page.events.length === 0) {
    lines.push("No new messages. Call zivr_read_new again later with since set to nextSince.");
  } else {
    lines.push("Call zivr_read_new again with since set to nextSince.");
  }
  page.events.forEach((event, index) => {
    const message = event.message;
    const id = field(message, "id");
    const files = filesByMessage.get(id || `index:${index}`) ?? [];
    const when = field(message, "createdAt");
    const iso = when && Number.isFinite(Number(when)) ? new Date(Number(when)).toISOString() : "";
    lines.push(
      "",
      `${index + 1}. ${event.type || "message.created"}`,
      `chatId: ${field(message, "chatId")}`,
      `messageId: ${id}`,
      `senderId: ${field(message, "senderId")}`,
      `senderName: ${field(message, "senderName")}`,
      iso ? `at: ${iso}` : "",
      `text: ${typeof message?.["text"] === "string" ? message["text"] : ""}`,
      mediaLine(message, files),
    );
  });
  return lines.filter((line) => line !== "").join("\n");
}

export type ToolOutcome = {
  result: Record<string, unknown>;
  files: PromptFile[];
};

function toolError(error: string): ToolOutcome {
  return { result: { ok: false, error }, files: [] };
}

function newClientId(now: number): string {
  return `bridge-${now.toString(36)}-${randomBytes(4).toString("hex")}`;
}

function optionalUuid(value: unknown, name: string): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new Error(`${name} must be a UUID`);
  }
  return value;
}

export async function executeZivrTool(
  name: string,
  args: unknown,
  ctx: { zivr: ZivrAgentApi; stash: AttachmentStash; memory: ToolMemory; now?: () => number },
): Promise<ToolOutcome> {
  const now = ctx.now ?? (() => Date.now());
  try {
    if (name === "zivr_list_chats") {
      const record = asRecord(args) ?? {};
      if (Object.keys(record).length > 0) return toolError("zivr_list_chats takes no arguments");
      const chats = await ctx.zivr.listChats();
      const text = chats.length === 0 ? "No chats yet." : JSON.stringify(chats);
      return { result: { ok: true, text: clip(text) }, files: [] };
    }
    if (name === "zivr_read_new") {
      const record = asRecord(args) ?? {};
      if (args != null && !record) return toolError("zivr_read_new arguments must be an object");
      let since = ctx.memory.since;
      if (record["since"] != null) {
        const raw = typeof record["since"] === "string" && /^\d+$/.test(record["since"])
          ? Number(record["since"])
          : record["since"];
        if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) {
          return toolError("since must be an epoch millisecond cursor");
        }
        since = raw;
      }
      const page = await ctx.zivr.listEvents(since);
      ctx.memory.since = page.nextSince;
      const agentUserId = await ctx.zivr.agentUserId().catch(() => "");
      const files: PromptFile[] = [];
      const byMessage = new Map<string, PromptFile[]>();
      page.events.forEach((event, index) => {
        if (!event.message) return;
        if (agentUserId && senderIdOf(event.message) === agentUserId) return;
        const stored = stashFiles(event.message, ctx.stash);
        if (stored.length === 0) return;
        files.push(...stored);
        byMessage.set(field(event.message, "id") || `index:${index}`, stored);
      });
      return {
        result: { ok: true, text: clip(formatEventPage(page, agentUserId, since, byMessage)) },
        files,
      };
    }
    if (name === "zivr_send_message") {
      const record = asRecord(args);
      if (!record) return toolError("zivr_send_message arguments must be an object");
      const chatId = optionalUuid(record["chatId"], "chatId");
      const peerId = optionalUuid(record["peerId"], "peerId");
      if ((chatId == null) === (peerId == null)) return toolError("Provide exactly one of chatId or peerId");
      const mediaRef = record["mediaRef"];
      let media: OutboundMedia | undefined;
      if (mediaRef != null && mediaRef !== "") {
        if (typeof mediaRef !== "string") return toolError("mediaRef must be a string such as file:1");
        media = ctx.stash.get(mediaRef);
        if (!media) return toolError(`Unknown mediaRef ${mediaRef}`);
      }
      const text = typeof record["text"] === "string" ? record["text"] : "";
      if (!text.trim() && !media) return toolError("text is required when there is no attachment");
      if (text.length > MAX_MESSAGE_TEXT_LENGTH) {
        return toolError(`text must be at most ${MAX_MESSAGE_TEXT_LENGTH} characters`);
      }
      let clientId = typeof record["clientId"] === "string" ? record["clientId"].trim() : "";
      if (!clientId) clientId = newClientId(now());
      if (clientId.length > MAX_CLIENT_ID_LENGTH) {
        return toolError(`clientId must be 1–${MAX_CLIENT_ID_LENGTH} characters`);
      }
      const sent = await ctx.zivr.sendMessage({
        ...(chatId ? { chatId } : {}),
        ...(peerId ? { peerId } : {}),
        ...(text ? { text } : {}),
        clientId,
        ...(media ? { media } : {}),
      });
      return { result: { ok: true, text: formatSendResult(sent) }, files: [] };
    }
    return toolError(`Unknown tool: ${name}`);
  } catch (err) {
    if (err instanceof ZivrScopeError) return toolError(err.message);
    if (err instanceof ZivrApiError) {
      const retry = err.retryAfter != null ? ` Retry after ${err.retryAfter}s.` : "";
      const detail = err.message.endsWith(".") ? err.message : `${err.message}.`;
      return toolError(`ZIVR API ${err.status}${err.code ? ` (${err.code})` : ""}: ${detail}${retry}`);
    }
    return toolError(err instanceof Error ? err.message : "ZIVR request failed");
  }
}
