import {
  AGENT_FILE_MIME_TYPES,
  DATA_URL_FILE,
  DATA_URL_IMAGE,
  IMAGE_MIME_TYPES,
  IMAGE_SECURITY,
  MAX_IMAGE_BYTES,
  MAX_MESSAGE_REQUEST_BYTES,
} from "./limits.js";

export type ImageMime = "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "image/heic" | "image/heif";
export type ImageSecurity = "none" | "password" | "single-view" | "timed";

export type NormalizedImage = {
  kind: "image";
  mimeType: ImageMime;
  dataUrl: string;
  width?: number;
  height?: number;
  security: ImageSecurity;
  password?: string;
  viewAfter?: number;
};

export type NormalizedFile = {
  kind: "file";
  mimeType: string;
  dataUrl: string;
  fileName?: string;
};

export type NormalizedMedia = NormalizedImage | NormalizedFile;

export type MediaResult = { ok: true; media: NormalizedMedia } | { ok: false; error: string };

export function decodedBase64Bytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function invalid(error: string): MediaResult {
  return { ok: false, error };
}

function dataUrlMime(value: Record<string, unknown>): string | null {
  const dataUrl = value["dataUrl"];
  if (typeof dataUrl !== "string") return null;
  const match = /^data:([^;,]+);base64,/i.exec(dataUrl);
  return match?.[1]?.toLowerCase() ?? null;
}

function normalizeImageMime(mime: string): ImageMime | null {
  const lowered = mime.toLowerCase() === "image/jpg" ? "image/jpeg" : mime.toLowerCase();
  if (!IMAGE_MIME_TYPES.has(lowered)) return null;
  return lowered as ImageMime;
}

function optionalPositiveInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value);
}

function cleanFileName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const base = value.split(/[/\\]/).pop()?.trim() ?? "";
  if (!base || base.length > 120 || !/^[\w. ()-]+$/.test(base)) return undefined;
  return base;
}

function parseImage(record: Record<string, unknown>): MediaResult {
  if (record["kind"] != null && record["kind"] !== "image") return invalid("Image attachment is invalid");
  if (typeof record["dataUrl"] !== "string" || record["dataUrl"].length > MAX_MESSAGE_REQUEST_BYTES) {
    return invalid("Image attachment is invalid");
  }
  const match = DATA_URL_IMAGE.exec(record["dataUrl"]);
  if (!match) return invalid("Image attachment is invalid");
  const mimeType = normalizeImageMime(match[1] ?? "");
  const base64 = match[2] ?? "";
  if (!mimeType || base64.length === 0) return invalid("Image attachment is invalid");
  if (decodedBase64Bytes(base64) > MAX_IMAGE_BYTES) {
    return invalid(`Image attachment is too large (max ${MAX_IMAGE_BYTES} bytes)`);
  }
  const security = record["security"] == null ? "none" : record["security"];
  if (typeof security !== "string" || !IMAGE_SECURITY.has(security)) return invalid("Image attachment is invalid");
  const password = typeof record["password"] === "string" ? record["password"] : undefined;
  if (security === "password" && (!password || password.trim().length === 0 || password.length > 200)) {
    return invalid("Image attachment is invalid");
  }
  const viewAfter = typeof record["viewAfter"] === "number" && Number.isFinite(record["viewAfter"])
    ? record["viewAfter"]
    : undefined;
  if (security === "timed" && viewAfter == null) return invalid("Image attachment is invalid");
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
      security: security as ImageSecurity,
      ...(security === "password" && password ? { password } : {}),
      ...(security === "timed" && viewAfter != null ? { viewAfter } : {}),
    },
  };
}

function parseFile(record: Record<string, unknown>): MediaResult {
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

/** One image or one allow-listed document. Calendar cards are not attachments. */
export function normalizeAgentMedia(media: unknown): MediaResult {
  if (Array.isArray(media)) {
    if (media.length > 1) return invalid("One attachment per message");
    return normalizeAgentMedia(media[0] ?? null);
  }
  if (!media || typeof media !== "object") return invalid("Attachment is invalid");
  const record = media as Record<string, unknown>;
  const kind = record["kind"];
  if (kind === "calendar_proposal") return invalid("Calendar cards are created by the proposal endpoint");
  const mime = dataUrlMime(record);
  if (mime && (mime.startsWith("video/") || mime.startsWith("audio/"))) {
    return invalid("Video and audio are not allowed for agents yet");
  }
  if (kind === "file" || (mime != null && AGENT_FILE_MIME_TYPES.has(mime))) return parseFile(record);
  return parseImage(record);
}
