import {
  DATA_URL_FILE,
  DATA_URL_IMAGE,
  EXTENSION_MIME,
  FILE_MIME_TYPES,
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_MESSAGE_REQUEST_BYTES,
} from "./limits.js";

export type OutboundImage = {
  kind: "image";
  mimeType: string;
  dataUrl: string;
  security: "none";
};

export type OutboundFile = {
  kind: "file";
  mimeType: string;
  dataUrl: string;
  fileName?: string;
};

export type OutboundMedia = OutboundImage | OutboundFile;

export function decodedBase64Bytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function fail(message: string): never {
  throw new Error(message);
}

export function cleanFileName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const base = value.split(/[/\\]/).pop()?.trim() ?? "";
  if (!base || base.length > 120 || !/^[\w. ()-]+$/.test(base)) return undefined;
  return base;
}

export function normalizeOutboundMedia(input: OutboundMedia): OutboundMedia {
  if (!input || typeof input !== "object") fail("Attachment is invalid");
  if (input.kind !== "image" && input.kind !== "file") fail("Attachment must be an image or a file");
  if (typeof input.dataUrl !== "string" || input.dataUrl.length === 0 || input.dataUrl.length > MAX_MESSAGE_REQUEST_BYTES) {
    fail("Attachment is invalid");
  }
  if (input.kind === "image") {
    const match = DATA_URL_IMAGE.exec(input.dataUrl);
    if (!match) fail("Image attachment is invalid");
    const mime = (match[1] ?? "").toLowerCase() === "image/jpg" ? "image/jpeg" : (match[1] ?? "").toLowerCase();
    const base64 = match[2] ?? "";
    if (!IMAGE_MIME_TYPES.has(mime) || base64.length === 0) fail("Image attachment is invalid");
    if (decodedBase64Bytes(base64) > MAX_IMAGE_BYTES) fail(`Image attachment is too large (max ${MAX_IMAGE_BYTES} bytes)`);
    return { kind: "image", mimeType: mime, dataUrl: `data:${mime};base64,${base64}`, security: "none" };
  }
  const match = DATA_URL_FILE.exec(input.dataUrl);
  if (!match) fail("File attachment is invalid");
  const mime = (match[1] ?? "").toLowerCase();
  const base64 = match[2] ?? "";
  if (mime.startsWith("video/") || mime.startsWith("audio/")) fail("Video and audio are not allowed for agents yet");
  if (!FILE_MIME_TYPES.has(mime)) fail("This file type is not allowed");
  if (base64.length === 0) fail("File attachment is invalid");
  if (decodedBase64Bytes(base64) > MAX_IMAGE_BYTES) fail(`File attachment is too large (max ${MAX_IMAGE_BYTES} bytes)`);
  const fileName = cleanFileName(input.fileName);
  return {
    kind: "file",
    mimeType: mime,
    dataUrl: `data:${mime};base64,${base64}`,
    ...(fileName ? { fileName } : {}),
  };
}

export function mediaFromFile(fileName: string, bytes: Buffer): OutboundMedia {
  const base = cleanFileName(fileName) ?? "";
  const ext = base.includes(".") ? base.split(".").pop()?.toLowerCase() ?? "" : "";
  const mime = EXTENSION_MIME[ext];
  if (!mime || !base) {
    fail("This file type is not allowed. Use an image, PDF, Office document, RTF, CSV, or text file.");
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) fail(`File attachment is too large (max ${MAX_IMAGE_BYTES} bytes)`);
  const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
  if (mime.startsWith("image/")) {
    return normalizeOutboundMedia({ kind: "image", mimeType: mime, dataUrl, security: "none" });
  }
  return normalizeOutboundMedia({ kind: "file", mimeType: mime, dataUrl, fileName: base });
}
