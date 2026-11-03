/**
 * Caps copied from the agent API (`message-content.ts`, `agent-policy.ts`)
 * and from ChatGPT Actions production limits. The agent API remains the
 * authority if a send limit changes. The Actions character cap is ChatGPT's.
 */

export const DEFAULT_API_BASE = "https://api.zivrapp.com";
export const DEFAULT_SERVER_ORIGIN = "https://api.zivrapp.com";

/** ChatGPT Actions reject a request or response at this size. */
export const GPT_ACTION_MAX_CHARS = 100_000;

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_MESSAGE_TEXT_LENGTH = 2000;
export const MAX_CLIENT_ID_LENGTH = 200;
export const MAX_PROPOSAL_TITLE_LENGTH = 140;
export const MAX_PROPOSAL_NOTE_LENGTH = 2000;
export const MAX_SLOT_MS = 14 * 24 * 60 * 60 * 1000;
export const MAX_SLOT_LEAD_MS = 366 * 24 * 60 * 60 * 1000;
export const SLOT_PAST_GRACE_MS = 5 * 60 * 1000;

export const CODE_TTL_MS = 5 * 60 * 1000;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_AUTH_CODES = 200;
export const MAX_REFRESH_TOKENS = 500;

export const API_KEY_PATTERN = /^zivr_agent_[A-Za-z0-9_-]{20,200}$/;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const MIN_OAUTH_CLIENT_ID_LENGTH = 8;
export const MIN_OAUTH_CLIENT_SECRET_LENGTH = 16;

/**
 * Scopes this action set asks ChatGPT to request. The agent JWT still carries
 * whatever the pasted key was minted with; the API enforces each call.
 */
export const ACTION_SCOPES = [
  "messages:send",
  "messages:read",
  "media:send",
  "chats:list",
  "calendar:propose",
] as const;

export const ACTION_SCOPE_STRING = ACTION_SCOPES.join(" ");

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

export const IMAGE_SECURITY = new Set(["none", "password", "single-view", "timed"]);

export const DATA_URL_IMAGE = /^data:(image\/(?:jpeg|jpg|png|webp|gif|heic|heif));base64,([A-Za-z0-9+/]+={0,2})$/;
export const DATA_URL_FILE = /^data:([a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*);base64,([A-Za-z0-9+/]+={0,2})$/i;

/** OpenAI's published cap for an operation summary or description. */
export const GPT_ENDPOINT_TEXT_MAX = 300;
/** OpenAI's published cap for a parameter description. */
export const GPT_PARAM_TEXT_MAX = 700;

export const AUTHORIZE_PATH = "/v1/gpt-actions/oauth/authorize";
export const TOKEN_PATH = "/v1/gpt-actions/oauth/token";
