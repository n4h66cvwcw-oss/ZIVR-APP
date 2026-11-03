import { historyReactions, type MessageReactions } from "./reactions.ts";

/**
 * Chat message text + image payload rules.
 *
 * Images are stored inline in `vm_messages.media` (JSONB) as a data URL.
 * Render Starter has no object storage in this deploy, and the service disk
 * is ephemeral, so Postgres is the durable copy. Do not add a bucket credential.
 *
 * Size limits (keep the mobile outbox in sync):
 * - Decoded image bytes: MAX_IMAGE_BYTES (2 MiB).
 * - JSON request body / Socket.IO packet: MAX_MESSAGE_REQUEST_BYTES (4 MiB),
 *   which fits a 2 MiB image after base64 (~2.7 MiB) plus the JSON envelope.
 * - Caption text: 2000 characters (same as text-only messages).
 *
 * Allowed image types: jpeg, png, webp, gif, heic, heif.
 */

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_MESSAGE_REQUEST_BYTES = 4 * 1024 * 1024;
export const MAX_MESSAGE_TEXT_LENGTH = 2000;

const MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

/**
 * Agent file allow-list (v1). Images stay on the existing image path.
 * Video and audio are rejected until object storage exists.
 */
export const AGENT_FILE_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/rtf",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "text/plain",
  "text/csv",
  "text/markdown",
]);

const SECURITY = new Set(["none", "password", "single-view", "timed"]);

const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|jpg|png|webp|gif|heic|heif));base64,([A-Za-z0-9+/]+={0,2})$/;
const DATA_URL_FILE = /^data:([a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*);base64,([A-Za-z0-9+/]+={0,2})$/i;

export type ImageMedia = {
  kind: "image";
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "image/heic" | "image/heif";
  dataUrl: string;
  width?: number;
  height?: number;
  security: "none" | "password" | "single-view" | "timed";
  password?: string;
  viewAfter?: number;
};

export type FileMedia = {
  kind: "file";
  mimeType: string;
  dataUrl: string;
  fileName?: string;
};

/** In-chat slot card. One owner or chat-admin Yes/No — not a member tally. */
export type CalendarProposalMedia = {
  kind: "calendar_proposal";
  proposalId: string;
  title: string;
  startsAt: number;
  endsAt: number;
  status: "pending" | "approved" | "declined";
  approval: "owner_or_admin";
  note?: string;
};

export type MessageMedia = ImageMedia | FileMedia | CalendarProposalMedia;

export type PreparedMessage = {
  text: string;
  type: string;
  media: MessageMedia | null;
};

export type PrepareMessageResult =
  | { ok: true; message: PreparedMessage }
  | { ok: false; error: string; status: "invalid" };

export type SerializedMessage = {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  type: string;
  createdAt: number;
  localId?: string;
  media?: MessageMedia;
  isEncrypted?: boolean;
  senderAvatar?: string | null;
  reactions?: MessageReactions;
};

type PrepareInput = {
  text?: unknown;
  type?: unknown;
  media?: unknown;
};

function invalid(error: string): { ok: false; error: string; status: "invalid" } {
  return { ok: false, error, status: "invalid" };
}

function normalizeMime(mime: string): ImageMedia["mimeType"] | null {
  const lowered = mime.toLowerCase() === "image/jpg" ? "image/jpeg" : mime.toLowerCase();
  if (!MIME_TYPES.has(lowered)) return null;
  return lowered as ImageMedia["mimeType"];
}

export function decodedBase64Bytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function optionalPositiveInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value);
}

/**
 * Accept a text message, or an image (with or without a caption).
 * Empty / whitespace text is rejected unless a valid image is attached.
 * The empty-text error string is part of the mobile contract.
 */
export function prepareOutgoingMessage(input: PrepareInput): PrepareMessageResult {
  const rawText = typeof input.text === "string" ? input.text : input.text == null ? "" : null;
  if (rawText == null || rawText.length > MAX_MESSAGE_TEXT_LENGTH) {
    return invalid("Message text is required");
  }

  const mediaResult = input.media == null ? { ok: true as const, media: null } : parseMediaInput(input.media);
  if (!mediaResult.ok) return mediaResult;

  const trimmed = rawText.trim();
  if (!trimmed && !mediaResult.media) {
    return invalid("Message text is required");
  }

  if (!mediaResult.media && input.type === "image") {
    return invalid("Image attachment is required");
  }

  const type = mediaResult.media
    ? "image"
    : typeof input.type === "string" && /^[a-z0-9_-]{1,32}$/i.test(input.type)
      ? input.type
      : "text";

  return {
    ok: true,
    message: {
      text: mediaResult.media ? trimmed : rawText,
      type,
      media: mediaResult.media,
    },
  };
}

function parseMediaInput(value: unknown): { ok: true; media: ImageMedia } | { ok: false; error: string; status: "invalid" } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid("Image attachment is invalid");
  }
  const record = value as Record<string, unknown>;
  if (record["kind"] != null && record["kind"] !== "image") {
    return invalid("Image attachment is invalid");
  }
  if (typeof record["dataUrl"] !== "string" || record["dataUrl"].length > MAX_MESSAGE_REQUEST_BYTES) {
    return invalid("Image attachment is invalid");
  }
  const match = DATA_URL_PATTERN.exec(record["dataUrl"]);
  if (!match) return invalid("Image attachment is invalid");
  const mimeType = normalizeMime(match[1] ?? "");
  const base64 = match[2] ?? "";
  if (!mimeType || base64.length === 0) return invalid("Image attachment is invalid");
  if (decodedBase64Bytes(base64) > MAX_IMAGE_BYTES) {
    return invalid(`Image attachment is too large (max ${MAX_IMAGE_BYTES} bytes)`);
  }

  const security = record["security"] == null ? "none" : record["security"];
  if (typeof security !== "string" || !SECURITY.has(security)) {
    return invalid("Image attachment is invalid");
  }
  const password = typeof record["password"] === "string" ? record["password"] : undefined;
  if (security === "password" && (!password || password.trim().length === 0 || password.length > 200)) {
    return invalid("Image attachment is invalid");
  }
  const viewAfter = typeof record["viewAfter"] === "number" && Number.isFinite(record["viewAfter"])
    ? record["viewAfter"]
    : undefined;
  if (security === "timed" && viewAfter == null) {
    return invalid("Image attachment is invalid");
  }

  const width = optionalPositiveInt(record["width"]);
  const height = optionalPositiveInt(record["height"]);
  return {
    ok: true,
    media: {
      kind: "image",
      mimeType,
      dataUrl: `data:${mimeType};base64,${base64}`,
      ...(width != null ? { width } : {}),
      ...(height != null ? { height } : {}),
      security: security as ImageMedia["security"],
      ...(security === "password" && password ? { password } : {}),
      ...(security === "timed" && viewAfter != null ? { viewAfter } : {}),
    },
  };
}

const PROPOSAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function calendarProposalCard(input: {
  proposalId: string;
  title: string;
  startsAt: number;
  endsAt: number;
  status: "pending" | "approved" | "declined";
  note?: string | null;
}): CalendarProposalMedia {
  return {
    kind: "calendar_proposal",
    proposalId: input.proposalId,
    title: input.title,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: input.status,
    approval: "owner_or_admin",
    ...(input.note ? { note: input.note } : {}),
  };
}

export function parseCalendarProposalCard(value: unknown): CalendarProposalMedia | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (record["kind"] !== "calendar_proposal") return undefined;
  if (typeof record["proposalId"] !== "string" || !PROPOSAL_UUID.test(record["proposalId"])) return undefined;
  if (typeof record["title"] !== "string" || record["title"].trim().length === 0 || record["title"].length > 140) return undefined;
  if (typeof record["startsAt"] !== "number" || typeof record["endsAt"] !== "number") return undefined;
  if (!Number.isFinite(record["startsAt"]) || !Number.isFinite(record["endsAt"]) || record["endsAt"] <= record["startsAt"]) return undefined;
  if (record["status"] !== "pending" && record["status"] !== "approved" && record["status"] !== "declined") return undefined;
  if (record["approval"] != null && record["approval"] !== "owner_or_admin") return undefined;
  const note = typeof record["note"] === "string" && record["note"].trim() ? record["note"].trim() : undefined;
  if (note && note.length > 2000) return undefined;
  return calendarProposalCard({
    proposalId: record["proposalId"],
    title: record["title"].trim(),
    startsAt: record["startsAt"],
    endsAt: record["endsAt"],
    status: record["status"],
    note,
  });
}

function dataUrlMime(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const dataUrl = (value as Record<string, unknown>)["dataUrl"];
  if (typeof dataUrl !== "string") return null;
  const match = /^data:([^;,]+);base64,/i.exec(dataUrl);
  return match?.[1]?.toLowerCase() ?? null;
}

function cleanFileName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const base = value.split(/[/\\]/).pop()?.trim() ?? "";
  if (!base || base.length > 120 || !/^[\w. ()-]+$/.test(base)) return undefined;
  return base;
}

function parseAgentFile(value: unknown): { ok: true; media: FileMedia } | { ok: false; error: string; status: "invalid" } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid("File attachment is invalid");
  const record = value as Record<string, unknown>;
  if (typeof record["dataUrl"] !== "string" || record["dataUrl"].length > MAX_MESSAGE_REQUEST_BYTES) {
    return invalid("File attachment is invalid");
  }
  const match = DATA_URL_FILE.exec(record["dataUrl"]);
  if (!match) return invalid("File attachment is invalid");
  const mimeType = (match[1] ?? "").toLowerCase();
  const base64 = match[2] ?? "";
  if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) {
    return invalid("Video and audio are not allowed for agents yet");
  }
  if (!AGENT_FILE_MIME_TYPES.has(mimeType)) return invalid("This file type is not allowed");
  if (base64.length === 0) return invalid("File attachment is invalid");
  if (decodedBase64Bytes(base64) > MAX_IMAGE_BYTES) {
    return invalid(`File attachment is too large (max ${MAX_IMAGE_BYTES} bytes)`);
  }
  const fileName = cleanFileName(record["fileName"]);
  return {
    ok: true,
    media: {
      kind: "file",
      mimeType,
      dataUrl: `data:${mimeType};base64,${base64}`,
      ...(fileName ? { fileName } : {}),
    },
  };
}

/**
 * Sub-profile send path. Humans stay on prepareOutgoingMessage (images only).
 * Agents may attach one image or one allow-listed document. They cannot mint
 * calendar cards here; those are written only by the proposal endpoint.
 */
export function prepareAgentOutgoingMessage(input: PrepareInput): PrepareMessageResult {
  const media = input.media;
  if (media && typeof media === "object" && !Array.isArray(media)) {
    const kind = (media as Record<string, unknown>)["kind"];
    if (kind === "calendar_proposal") return invalid("Calendar cards are created by the proposal endpoint");
    const mime = dataUrlMime(media);
    if (mime && (mime.startsWith("video/") || mime.startsWith("audio/"))) {
      return invalid("Video and audio are not allowed for agents yet");
    }
    if (kind === "file" || (mime != null && AGENT_FILE_MIME_TYPES.has(mime))) {
      const parsed = parseAgentFile(media);
      if (!parsed.ok) return parsed;
      const rawText = typeof input.text === "string" ? input.text : input.text == null ? "" : null;
      if (rawText == null || rawText.length > MAX_MESSAGE_TEXT_LENGTH) return invalid("Message text is required");
      return { ok: true, message: { text: rawText.trim(), type: "file", media: parsed.media } };
    }
  }
  return prepareOutgoingMessage(input);
}

/** Re-validate JSONB (or a JSON string) before it is returned to clients. */
export function parseStoredMedia(value: unknown): MessageMedia | undefined {
  let raw = value;
  if (raw == null) return undefined;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  }
  const card = parseCalendarProposalCard(raw);
  if (card) return card;
  if (raw && typeof raw === "object" && !Array.isArray(raw) && (raw as Record<string, unknown>)["kind"] === "file") {
    const parsed = parseAgentFile(raw);
    return parsed.ok ? parsed.media : undefined;
  }
  const prepared = prepareOutgoingMessage({ text: "", type: "image", media: raw });
  if (!prepared.ok || !prepared.message.media) return undefined;
  return prepared.message.media;
}

export function mediaJsonParam(media: MessageMedia | null): string | null {
  return media ? JSON.stringify(media) : null;
}

/**
 * History / list rows must emit numeric createdAt. node-pg returns BIGINT as a
 * string, and `new Date("1793663279877")` is Invalid Date.
 */
export function coerceCreatedAt(value: unknown): number {
  const createdAt = Number(value);
  return Number.isFinite(createdAt) ? createdAt : 0;
}

export function serializeHistoryMessage(row: {
  id: string;
  chatId?: string;
  senderId: string;
  senderName?: string | null;
  text: string;
  type: string;
  createdAt: unknown;
  localId?: string | null;
  isEncrypted?: boolean;
  senderAvatar?: string | null;
  media?: unknown;
  reactions?: unknown;
}): SerializedMessage {
  const media = parseStoredMedia(row.media);
  const reactions = historyReactions(row.reactions);
  return {
    id: row.id,
    chatId: row.chatId ?? "",
    senderId: row.senderId,
    senderName: row.senderName ?? "Unknown",
    text: row.text ?? "",
    type: row.type,
    createdAt: coerceCreatedAt(row.createdAt),
    ...(row.localId ? { localId: row.localId } : {}),
    ...(media ? { media } : {}),
    ...(row.isEncrypted != null ? { isEncrypted: row.isEncrypted } : {}),
    ...(row.senderAvatar !== undefined ? { senderAvatar: row.senderAvatar } : {}),
    ...(reactions ? { reactions } : {}),
  };
}

export function serializedMessageFromRow(
  row: {
    id: string;
    chat_id: string;
    text: string;
    type: string;
    media: unknown;
    created_at: unknown;
    reactions?: unknown;
  },
  fields: { senderId: string; senderName: string; localId?: string | null },
): SerializedMessage {
  return serializeHistoryMessage({
    id: row.id,
    chatId: row.chat_id,
    senderId: fields.senderId,
    senderName: fields.senderName,
    text: row.text,
    type: row.type,
    createdAt: row.created_at,
    localId: fields.localId,
    media: row.media,
    reactions: row.reactions,
  });
}

export function messagePreview(text: string, type: string): string {
  const trimmed = text.trim();
  if (trimmed) return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
  if (type === "image") return "Photo";
  if (type === "file") return "File";
  if (type === "calendar_proposal") return "Calendar proposal";
  return "New message";
}
