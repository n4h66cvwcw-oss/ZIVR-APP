/**
 * Durable send queue for server chats.
 *
 * Image bytes travel inside the outbox entry as a data URL and are stored in
 * Postgres `vm_messages.media`. Caps match artifacts/api-server message-content.ts:
 * decoded image max 2 MiB. There is no object store on the Render Starter deploy.
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

export type ServerImageMedia = {
  kind: "image";
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "image/heic" | "image/heif";
  dataUrl: string;
  width?: number;
  height?: number;
  security: "none" | "password" | "single-view" | "timed";
  password?: string;
  viewAfter?: number;
};

export type MessageOutboxEntry = {
  chatId: string;
  text: string;
  localId: string;
  ownerUserId: string;
  media?: ServerImageMedia;
};

const SECURITY = new Set(["none", "password", "single-view", "timed"]);

export function outboxStorageKey(ownerUserId: string): string {
  return `@zivr_message_outbox:${ownerUserId}`;
}

export function upsertOutboxEntry(entries: MessageOutboxEntry[], entry: MessageOutboxEntry): MessageOutboxEntry[] {
  return [
    ...entries.filter((item) => item.ownerUserId !== entry.ownerUserId || item.localId !== entry.localId),
    entry,
  ];
}

export function removeOutboxEntry(
  entries: MessageOutboxEntry[],
  ownerUserId: string,
  localId: string,
): MessageOutboxEntry[] {
  return entries.filter((item) => item.ownerUserId !== ownerUserId || item.localId !== localId);
}

/** Socket `message:send` body. Image-only sends keep an empty caption and `media`. */
export function socketMessagePayload(entry: Pick<MessageOutboxEntry, "chatId" | "text" | "localId" | "media">) {
  return {
    chatId: entry.chatId,
    text: entry.text,
    type: entry.media ? "image" as const : "text" as const,
    localId: entry.localId,
    ...(entry.media ? { media: entry.media } : {}),
  };
}

/** REST POST /chats/:id/messages body. Same media data URL as the socket payload. */
export function restMessageBody(entry: Pick<MessageOutboxEntry, "text" | "localId" | "media">) {
  return {
    text: entry.text,
    type: entry.media ? "image" as const : "text" as const,
    clientId: entry.localId,
    ...(entry.media ? { media: entry.media } : {}),
  };
}

function normalizeMime(mime: string): ServerImageMedia["mimeType"] | null {
  const lowered = mime.toLowerCase() === "image/jpg" ? "image/jpeg" : mime.toLowerCase();
  if (!MIME_TYPES.has(lowered)) return null;
  return lowered as ServerImageMedia["mimeType"];
}

function decodedBase64Bytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export function imageMediaFromParts(input: {
  dataUrl?: string;
  base64?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  security?: string;
  password?: string;
  viewAfter?: number;
}): { ok: true; media: ServerImageMedia } | { ok: false; error: string } {
  let mimeType = input.mimeType ?? "image/jpeg";
  let base64 = input.base64?.replace(/\s/g, "") ?? "";
  if (input.dataUrl) {
    const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(input.dataUrl.trim());
    if (!match?.[1] || !match[2]) return { ok: false, error: "Image attachment is invalid" };
    mimeType = match[1];
    base64 = match[2];
  }
  const normalized = normalizeMime(mimeType);
  if (!normalized || !base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    return { ok: false, error: "Image attachment is invalid" };
  }
  if (decodedBase64Bytes(base64) > MAX_IMAGE_BYTES) {
    return { ok: false, error: `Image attachment is too large (max ${MAX_IMAGE_BYTES} bytes)` };
  }
  const security = input.security ?? "none";
  if (!SECURITY.has(security)) return { ok: false, error: "Image attachment is invalid" };
  if (security === "password" && (!input.password || input.password.trim().length === 0 || input.password.length > 200)) {
    return { ok: false, error: "Image attachment is invalid" };
  }
  if (security === "timed" && (typeof input.viewAfter !== "number" || !Number.isFinite(input.viewAfter))) {
    return { ok: false, error: "Image attachment is invalid" };
  }
  const width = typeof input.width === "number" && input.width > 0 ? Math.round(input.width) : undefined;
  const height = typeof input.height === "number" && input.height > 0 ? Math.round(input.height) : undefined;
  return {
    ok: true,
    media: {
      kind: "image",
      mimeType: normalized,
      dataUrl: `data:${normalized};base64,${base64}`,
      ...(width != null ? { width } : {}),
      ...(height != null ? { height } : {}),
      security: security as ServerImageMedia["security"],
      ...(security === "password" && input.password ? { password: input.password } : {}),
      ...(security === "timed" && input.viewAfter != null ? { viewAfter: input.viewAfter } : {}),
    },
  };
}
