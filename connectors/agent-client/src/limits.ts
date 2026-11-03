/**
 * Caps copied from the agent API (`message-content.ts`, `agent-policy.ts`).
 * The API remains the authority if a limit changes.
 */

export const DEFAULT_API_BASE = "https://api.zivrapp.com";

/** Access tokens from POST /v1/agent/token last one hour. Refresh this long before expiry. */
export const TOKEN_REFRESH_SKEW_MS = 60_000;

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_MESSAGE_REQUEST_BYTES = 4 * 1024 * 1024;
export const MAX_MESSAGE_TEXT_LENGTH = 2000;
export const MAX_CLIENT_ID_LENGTH = 200;
export const MAX_TOOL_TEXT_LENGTH = 8_000;
export const MAX_TEXT_EXCERPT = 2_000;
export const MAX_INLINE_FILES = 4;
export const MAX_TOOL_STEPS = 4;
export const EVENT_PAGE_SIZE = 100;
export const DEFAULT_BRIDGE_INTERVAL_MS = 5_000;
export const MIN_BRIDGE_INTERVAL_MS = 500;
export const MAX_BRIDGE_INTERVAL_MS = 10 * 60 * 1000;
export const MAX_WEBHOOK_BODY_BYTES = 4 * 1024 * 1024;

export const API_KEY_PATTERN = /^zivr_agent_[A-Za-z0-9_-]{20,200}$/;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

export const FILE_MIME_TYPES = new Set([
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

export const TEXT_MIME_TYPES = new Set(["text/plain", "text/csv", "text/markdown"]);

export const EXTENSION_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  rtf: "application/rtf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
};

export const DATA_URL_IMAGE = /^data:(image\/(?:jpeg|jpg|png|webp|gif|heic|heif));base64,([A-Za-z0-9+/]+={0,2})$/;
export const DATA_URL_FILE = /^data:([a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*);base64,([A-Za-z0-9+/]+={0,2})$/i;

export const BRIDGE_INSTRUCTIONS = [
  "You are one ZIVR agent twin.",
  "Send and read as that agent only through the zivr_send_message, zivr_list_chats, and zivr_read_new functions.",
  "Those functions run in this process against the ZIVR agent HTTP API.",
  "This provider does not call ZIVR on its own, and it cannot receive ZIVR webhooks.",
  "zivr_send_message takes exactly one of chatId or peerId.",
  "peerId must be another agent owned by the same person.",
  "clientId may be omitted; the bridge will fill one.",
  "To attach a file the bridge registered, pass mediaRef (for example file:1).",
  "Do not invent data URLs or paste file bytes into the tool.",
  "zivr_list_chats lists chats this agent already belongs to.",
  "zivr_read_new polls. Pass the previous nextSince. Omit since to continue from this process's cursor.",
  "Events include your own sends. A reply has a different senderId.",
  "When an inbound ZIVR message is shown to you, deliver a reply only by calling zivr_send_message with that chatId.",
  "Plain text you return is shown to the operator and is not delivered on ZIVR.",
].join(" ");
