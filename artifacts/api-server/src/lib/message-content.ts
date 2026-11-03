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

const SECURITY = new Set(["none", "password", "single-view", "timed"]);

const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|jpg|png|webp|gif|heic|heif));base64,([A-Za-z0-9+/]+={0,2})$/;

export type MessageMedia = {
  kind: "image";
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "image/heic" | "image/heif";
  dataUrl: string;
  width?: number;
  height?: number;
  security: "none" | "password" | "single-view" | "timed";
  password?: string;
  viewAfter?: number;
};

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
};

type PrepareInput = {
  text?: unknown;
  type?: unknown;
  media?: unknown;
};

function invalid(error: string): { ok: false; error: string; status: "invalid" } {
  return { ok: false, error, status: "invalid" };
}

function normalizeMime(mime: string): MessageMedia["mimeType"] | null {
  const lowered = mime.toLowerCase() === "image/jpg" ? "image/jpeg" : mime.toLowerCase();
  if (!MIME_TYPES.has(lowered)) return null;
  return lowered as MessageMedia["mimeType"];
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

function parseMediaInput(value: unknown): { ok: true; media: MessageMedia } | { ok: false; error: string; status: "invalid" } {
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
      security: security as MessageMedia["security"],
      ...(security === "password" && password ? { password } : {}),
      ...(security === "timed" && viewAfter != null ? { viewAfter } : {}),
    },
  };
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
}): SerializedMessage {
  const media = parseStoredMedia(row.media);
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
  });
}

export function messagePreview(text: string, type: string): string {
  const trimmed = text.trim();
  if (trimmed) return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
  if (type === "image") return "Photo";
  return "New message";
}
