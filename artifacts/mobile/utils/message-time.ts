/**
 * Message timestamps are epoch milliseconds. History JSON used to send BIGINT
 * values as strings (`"1793663279877"`). `new Date(numericString)` is Invalid
 * Date; `new Date(Number(numericString))` is the real time. Coerce both shapes
 * so bubbles cached before the server fix still render.
 */
export function coerceEpochMillis(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return Number.NaN;
}

export function formatMessageTime(timestamp: unknown): string {
  const millis = coerceEpochMillis(timestamp);
  if (!Number.isFinite(millis)) return "";
  return new Date(millis).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SECURITY = new Set(["none", "password", "single-view", "timed"]);

export type InboundImageAttachment = {
  uri: string;
  width?: number;
  height?: number;
  security: "none" | "password" | "single-view" | "timed";
  password?: string;
  viewAfter?: number;
  viewedBy?: string[];
};

export type InboundServerMessage = {
  id: string;
  chatId: string;
  senderId: string;
  senderName?: string;
  text?: string;
  type?: string;
  createdAt: unknown;
  localId?: string;
  media?: unknown;
};

export function imageAttachmentFromServerMedia(media: unknown): InboundImageAttachment | undefined {
  if (!media || typeof media !== "object") return undefined;
  const record = media as Record<string, unknown>;
  if (record["kind"] !== "image" || typeof record["dataUrl"] !== "string" || !record["dataUrl"].startsWith("data:image/")) {
    return undefined;
  }
  const security = typeof record["security"] === "string" && SECURITY.has(record["security"])
    ? record["security"] as InboundImageAttachment["security"]
    : "none";
  return {
    uri: record["dataUrl"],
    ...(typeof record["width"] === "number" ? { width: record["width"] } : {}),
    ...(typeof record["height"] === "number" ? { height: record["height"] } : {}),
    security,
    ...(typeof record["password"] === "string" ? { password: record["password"] } : {}),
    ...(typeof record["viewAfter"] === "number" ? { viewAfter: record["viewAfter"] } : {}),
    viewedBy: [],
  };
}

export function localMessageFromServer(msg: InboundServerMessage): {
  id: string;
  chatId: string;
  text: string;
  senderId: string;
  timestamp: number;
  read: boolean;
  imageAttachment?: InboundImageAttachment;
} {
  const timestamp = coerceEpochMillis(msg.createdAt);
  return {
    id: msg.id,
    chatId: msg.chatId,
    text: typeof msg.text === "string" ? msg.text : "",
    senderId: msg.senderId,
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    read: false,
    imageAttachment: imageAttachmentFromServerMedia(msg.media),
  };
}

export function hasServerMessage(existing: Array<{ id: string }>, msg: { id: string; localId?: string }): boolean {
  return existing.some((item) => item.id === msg.id || (!!msg.localId && item.id === msg.localId));
}

export function messagePreviewText(message: { text?: string; imageAttachment?: unknown; type?: string }): string {
  const text = message.text?.trim();
  if (text) return text;
  if (message.imageAttachment || message.type === "image") return "📷 Photo";
  return "";
}

export function reviveCachedMessage<T extends { timestamp: unknown }>(message: T): T {
  const timestamp = coerceEpochMillis(message.timestamp);
  if (!Number.isFinite(timestamp)) return message;
  return { ...message, timestamp };
}
