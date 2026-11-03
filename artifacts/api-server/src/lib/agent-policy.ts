/**
 * Sub-profile rules that do not touch the database.
 * Calendar Yes/No is a single owner or chat-admin tap. There is no tally.
 */

export const AGENT_SCOPES = [
  "messages:send",
  "messages:read",
  "media:send",
  "chats:list",
  "calendar:read",
  "calendar:propose",
] as const;

export type AgentScope = (typeof AGENT_SCOPES)[number];

/** Jay locked read + propose on, so new keys include both unless the owner narrows them. */
export const DEFAULT_AGENT_KEY_SCOPES: readonly AgentScope[] = AGENT_SCOPES;

export const MAX_AGENTS_PER_OWNER = 5;
export const AGENT_MESSAGES_PER_MINUTE = 30;
export const AGENT_MESSAGES_PER_DAY = 500;
export const AGENT_MEDIA_PER_DAY = 50;
export const AGENT_TOKEN_TTL_SECONDS = 60 * 60;

/** CryptoJS OpenSSL salted ciphertext, which is how the mobile app stores E2E text. */
export const DEVICE_E2E_PREFIX = "U2FsdGVkX1";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type Gate = { ok: false; status: number; error: string; code: string; retryAfter?: number };

function deny(status: number, error: string, code: string, retryAfter?: number): Gate {
  return retryAfter == null
    ? { ok: false, status, error, code }
    : { ok: false, status, error, code, retryAfter };
}

export function isAgentScope(value: string): value is AgentScope {
  return (AGENT_SCOPES as readonly string[]).includes(value);
}

/**
 * Propose is on unless AGENT_CALENDAR_PROPOSE is explicitly disabled
 * (0, false, no, off). Unset means on.
 */
export function calendarProposeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env["AGENT_CALENDAR_PROPOSE"];
  if (raw == null || raw.trim() === "") return true;
  const value = raw.trim().toLowerCase();
  if (value === "0" || value === "false" || value === "no" || value === "off") return false;
  return true;
}

export function looksLikeDeviceCiphertext(text: string): boolean {
  return text.startsWith(DEVICE_E2E_PREFIX);
}

export function parseScopes(input: unknown, fallback: readonly AgentScope[]): AgentScope[] | null {
  if (input == null) return [...fallback];
  if (!Array.isArray(input) || input.length === 0 || input.length > AGENT_SCOPES.length) return null;
  const scopes: AgentScope[] = [];
  for (const item of input) {
    if (typeof item !== "string" || !isAgentScope(item) || scopes.includes(item)) return null;
    scopes.push(item);
  }
  return scopes;
}

export function hasScope(scopes: readonly string[], scope: AgentScope): boolean {
  return scopes.includes(scope);
}

export function parseDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 80) return null;
  return trimmed;
}

/** null = omit. undefined = invalid. */
export function parseUsername(value: unknown): string | null | undefined {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(trimmed)) return undefined;
  return trimmed;
}

export function parseProvider(value: unknown, mode: "persona" | "agent"): string | null | undefined {
  if (mode === "persona") {
    if (value == null || value === "") return null;
    return undefined;
  }
  if (value == null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(trimmed)) return undefined;
  return trimmed;
}

export function parseProfileMode(value: unknown): "persona" | "agent" | null {
  if (value === "persona" || value === "agent") return value;
  return null;
}

export function parseAvatar(value: unknown): string | null | undefined {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > 300_000) return undefined;
  return value;
}

export function parseClientId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 200) return null;
  return trimmed;
}

export function parseUuid(value: unknown): string | null {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) return null;
  return value;
}

export function parseWebhookUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.username || url.password || url.hash) return null;
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol === "https:") return url.toString();
  if (url.protocol === "http:" && local) return url.toString();
  return null;
}

export function ownerMayCreateSubProfile(owner: {
  accountType: string | null;
  supervised: boolean;
}): Gate | { ok: true } {
  if (owner.accountType === "agent") {
    return deny(403, "Agents cannot create sub-profiles", "agent");
  }
  if (owner.accountType === "child" || owner.supervised) {
    return deny(403, "Supervised accounts cannot create or assign agents", "kids");
  }
  return { ok: true };
}

/**
 * Agent-to-agent rule: two Agent-mode profiles may DM or share a thread when
 * they have the same owner_user_id, or when an owner/admin already added them
 * to a chat. A different owner's agent is a cold DM and stays blocked.
 * Persona profiles, paused profiles, kids, and E2E chats stay blocked.
 */
export type AgentPeerIdentity = {
  id: string;
  accountType: string | null;
  ownerUserId: string | null;
  profileMode: "persona" | "agent" | null;
  agentStatus: "active" | "paused" | "revoked" | null;
};

export function agentMayMessagePeer(self: AgentPeerIdentity, peer: AgentPeerIdentity): Gate | { ok: true } {
  if (self.id === peer.id) return deny(400, "Choose a different agent", "invalid");
  if (self.accountType !== "agent" || peer.accountType !== "agent") {
    return deny(403, "Only agent profiles can open an agent-to-agent chat", "forbidden");
  }
  if (self.profileMode !== "agent" || peer.profileMode !== "agent") {
    return deny(403, "Persona profiles cannot open agent-to-agent chats", "persona");
  }
  if (self.agentStatus !== "active" || peer.agentStatus !== "active") {
    return deny(403, "Both agents must be active", "paused");
  }
  if (!self.ownerUserId || self.ownerUserId !== peer.ownerUserId) {
    return deny(403, "Agents cannot start a chat with another owner's agent", "cold_dm");
  }
  return { ok: true };
}

export function ownerMayIncludeOwnAgents(
  creatorId: string,
  creator: { accountType: string | null; supervised: boolean },
  agents: Array<Pick<AgentPeerIdentity, "ownerUserId" | "profileMode" | "agentStatus">>,
): Gate | { ok: true } {
  if (agents.length === 0) return { ok: true };
  if (creator.accountType === "agent") return deny(403, "Agents cannot start chats", "agent_cannot_start");
  if (creator.accountType === "child" || creator.supervised) {
    return deny(403, "Supervised accounts cannot create or assign agents", "kids");
  }
  for (const agent of agents) {
    if (agent.profileMode !== "agent" || agent.agentStatus !== "active") {
      return deny(403, "This profile cannot be added to a chat", "agent_unavailable");
    }
    if (agent.ownerUserId !== creatorId) {
      return deny(403, "Add another owner's agent with the sub-profile chat endpoint", "agent_membership");
    }
  }
  return { ok: true };
}

export function chatAllowsAgent(chat: {
  isE2e: boolean;
  hasE2eMessage: boolean;
  hasChild: boolean;
}): Gate | { ok: true } {
  if (chat.isE2e || chat.hasE2eMessage) {
    return deny(403, "Agents cannot join or send in end-to-end encrypted chats", "e2e");
  }
  if (chat.hasChild) {
    return deny(403, "Agents cannot join or send in chats with a supervised account", "kids");
  }
  return { ok: true };
}

export type ProposalStatus = "pending" | "approved" | "declined";

/**
 * The only people who can tap Yes or No are the sub-profile owner and the
 * chat admin (vm_chats.created_by). Other members do not vote.
 */
export function canDecideProposal(input: {
  callerId: string;
  callerAccountType: string | null;
  callerSupervised: boolean;
  ownerUserId: string;
  chatCreatedBy: string | null;
}): { ok: true; role: "owner" | "admin" } | { ok: false; status: number; error: string; code: string } {
  if (input.callerAccountType === "agent") {
    return { ok: false, status: 403, error: "Agents cannot respond to calendar proposals", code: "agent" };
  }
  if (input.callerAccountType === "child" || input.callerSupervised) {
    return { ok: false, status: 403, error: "Supervised accounts cannot respond to calendar proposals", code: "kids" };
  }
  if (input.callerId === input.ownerUserId) return { ok: true, role: "owner" };
  if (input.chatCreatedBy && input.callerId === input.chatCreatedBy && input.callerId !== input.ownerUserId) {
    return { ok: true, role: "admin" };
  }
  return {
    ok: false,
    status: 403,
    error: "Only the profile owner or the chat admin can respond",
    code: "forbidden",
  };
}

export function nextProposalStatus(
  current: ProposalStatus,
  decision: "yes" | "no",
): { ok: true; status: "approved" | "declined"; idempotent: boolean } | { ok: false; status: number; error: string; code: string } {
  const status = decision === "yes" ? "approved" : "declined";
  if (current === status) return { ok: true, status, idempotent: true };
  if (current !== "pending") {
    return { ok: false, status: 409, error: "This proposal was already decided", code: "conflict" };
  }
  return { ok: true, status, idempotent: false };
}

export function validateProposalSlot(
  startsAt: unknown,
  endsAt: unknown,
  now = Date.now(),
): { ok: true; startsAt: number; endsAt: number } | { ok: false; error: string } {
  if (typeof startsAt !== "number" || typeof endsAt !== "number" || !Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    return { ok: false, error: "startsAt and endsAt must be epoch milliseconds" };
  }
  if (endsAt <= startsAt) return { ok: false, error: "The slot must end after it starts" };
  const duration = endsAt - startsAt;
  if (duration > 14 * 24 * 60 * 60 * 1000) return { ok: false, error: "The slot is too long" };
  if (startsAt < now - 5 * 60 * 1000) return { ok: false, error: "The slot is in the past" };
  if (startsAt > now + 366 * 24 * 60 * 60 * 1000) return { ok: false, error: "The slot is too far in the future" };
  return { ok: true, startsAt, endsAt };
}

export function parseProposalTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 140) return null;
  return trimmed;
}

export function parseProposalNote(value: unknown): string | null | undefined {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length > 2000) return undefined;
  return trimmed.length === 0 ? null : trimmed;
}

export function proposalSummary(title: string, startsAt: number, endsAt: number): string {
  return `Proposal: ${title}\n${new Date(startsAt).toISOString()} – ${new Date(endsAt).toISOString()}\nYes adds this to the owner's calendar. No dismisses it.`;
}

export function proposalDecisionText(input: {
  decision: "yes" | "no";
  title: string;
  actorName: string;
  calendarWrite: "pending_oauth" | "written" | "dismissed";
}): string {
  if (input.decision === "no") return `${input.actorName} dismissed "${input.title}".`;
  if (input.calendarWrite === "written") {
    return `${input.actorName} approved "${input.title}". It was added to the main calendar.`;
  }
  return `${input.actorName} approved "${input.title}". It will be added to the main calendar when that calendar is connected.`;
}

export function utcDayStart(now: number): number {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function secondsUntilNextUtcDay(now: number): number {
  const next = utcDayStart(now) + 24 * 60 * 60 * 1000;
  return Math.max(1, Math.ceil((next - now) / 1000));
}

export function rateLimitDecision(input: {
  sentLastMinute: number;
  sentToday: number;
  mediaToday: number;
  isMedia: boolean;
  now: number;
}): Gate | { ok: true } {
  if (input.sentLastMinute >= AGENT_MESSAGES_PER_MINUTE) {
    return deny(429, "This profile reached the per-minute message limit", "rate_limited", 60);
  }
  if (input.sentToday >= AGENT_MESSAGES_PER_DAY) {
    return deny(429, "This profile reached the daily message limit", "rate_limited", secondsUntilNextUtcDay(input.now));
  }
  if (input.isMedia && input.mediaToday >= AGENT_MEDIA_PER_DAY) {
    return deny(429, "This profile reached the daily file limit", "rate_limited", secondsUntilNextUtcDay(input.now));
  }
  return { ok: true };
}

export function assistantLabel(ownerDisplayName: string): string {
  const name = ownerDisplayName.trim() || "Owner";
  return `${name}'s assistant`;
}
