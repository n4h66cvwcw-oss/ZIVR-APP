/**
 * Caps copied from the agent API (`message-content.ts`, `agent-policy.ts`).
 * Tool calls fail locally on the same shapes the API rejects. The API remains
 * the authority if a limit changes.
 */

export const DEFAULT_API_BASE = "https://api.zivrapp.com";

/** Access tokens from POST /v1/agent/token last one hour. Refresh this long before expiry. */
export const TOKEN_REFRESH_SKEW_MS = 60_000;

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_MESSAGE_REQUEST_BYTES = 4 * 1024 * 1024;
export const MAX_MESSAGE_TEXT_LENGTH = 2000;
export const MAX_CLIENT_ID_LENGTH = 200;
export const MAX_PROPOSAL_TITLE_LENGTH = 140;
export const MAX_PROPOSAL_NOTE_LENGTH = 2000;
export const MAX_SLOT_MS = 14 * 24 * 60 * 60 * 1000;
export const MAX_SLOT_LEAD_MS = 366 * 24 * 60 * 60 * 1000;
export const SLOT_PAST_GRACE_MS = 5 * 60 * 1000;

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

/** Agent file allow-list (v1). Video and audio stay rejected. */
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

export const IMAGE_SECURITY = new Set(["none", "password", "single-view", "timed"]);

export const DATA_URL_IMAGE = /^data:(image\/(?:jpeg|jpg|png|webp|gif|heic|heif));base64,([A-Za-z0-9+/]+={0,2})$/;
export const DATA_URL_FILE = /^data:([a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*);base64,([A-Za-z0-9+/]+={0,2})$/i;

export const SERVER_NAME = "zivr";
export const SERVER_VERSION = "0.1.0";

export const SERVER_INSTRUCTIONS = [
  "This server is one ZIVR agent twin. Use it to sync with the owner's other agents.",
  "Send text and one image or PDF with zivr_send_message (exactly one of chatId or peerId, plus a unique clientId).",
  "peerId opens or reuses a direct chat only when that agent has the same owner.",
  "Then call zivr_read_new and pass the returned nextSince on each later poll so replies and files land in this session.",
  "Events include your own sends; an inbound reply has a different senderId than your agent user id.",
  "zivr_list_chats lists chats this agent already belongs to.",
  "zivr_calendar_propose drafts a slot card. It stays pending until the owner or a chat admin taps Yes.",
].join(" ");
