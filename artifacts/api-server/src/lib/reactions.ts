/**
 * Message emoji reactions.
 *
 * Stored on vm_messages.reactions as JSONB: { "👍": ["user-id", ...] }.
 * The sender's device keeps its local id as the message id, while peers use
 * vm_messages.id. Callers resolve either key before toggling.
 */

export type MessageReactions = Record<string, string[]>;

export type ReactionAction = "added" | "removed";

export type MessageReactionEvent = {
  messageId: string;
  chatId: string;
  emoji: string;
  userId: string;
  action: ReactionAction;
  reactions: MessageReactions;
  /** vm_messages.client_id. Same value history exposes as localId. Null when the row has none. */
  clientId: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMOJI_PART = String.raw`\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\p{Emoji_Component}|\u200D|\uFE0F|\u20E3`;
const EMOJI_ONLY = new RegExp(`^(?:${EMOJI_PART})+$`, "u");
const HAS_EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u;

export type ReactionMessageRow = {
  id: string;
  sender_id: string | null;
  client_id: string | null;
};

export function parseReactionEmoji(value: unknown): { ok: true; emoji: string } | { ok: false; error: string } {
  if (typeof value !== "string") return { ok: false, error: "emoji is required" };
  const count = Array.from(value).length;
  if (count < 1 || count > 32) return { ok: false, error: "emoji must be 1–32 characters" };
  if (!EMOJI_ONLY.test(value) || !HAS_EMOJI.test(value)) return { ok: false, error: "emoji must be an emoji" };
  return { ok: true, emoji: value };
}

/** Drop malformed entries. Empty input becomes an empty map (no reactions). */
export function parseStoredReactions(value: unknown): MessageReactions {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: MessageReactions = {};
  for (const [emoji, users] of Object.entries(raw as Record<string, unknown>)) {
    if (emoji.length === 0 || !Array.isArray(users)) continue;
    const ids: string[] = [];
    for (const id of users) {
      if (typeof id === "string" && id.length > 0 && !ids.includes(id)) ids.push(id);
    }
    if (ids.length > 0) out[emoji] = ids;
  }
  return out;
}

/** Omit the field when a message has no reactions. */
export function historyReactions(value: unknown): MessageReactions | undefined {
  const reactions = parseStoredReactions(value);
  return Object.keys(reactions).length > 0 ? reactions : undefined;
}

/**
 * Toggle one user's emoji. Other emoji and other users stay in their original order.
 * An emoji key is removed when its last user toggles off.
 */
export function toggleReaction(
  current: unknown,
  emoji: string,
  userId: string,
): { reactions: MessageReactions; action: ReactionAction } {
  const parsed = parseStoredReactions(current);
  const already = parsed[emoji]?.includes(userId) ?? false;
  const action: ReactionAction = already ? "removed" : "added";
  const reactions: MessageReactions = {};
  let seen = false;
  for (const [key, ids] of Object.entries(parsed)) {
    if (key !== emoji) {
      reactions[key] = ids;
      continue;
    }
    seen = true;
    if (action === "removed") {
      const remaining = ids.filter((id) => id !== userId);
      if (remaining.length > 0) reactions[key] = remaining;
    } else {
      reactions[key] = [...ids, userId];
    }
  }
  if (!seen && action === "added") reactions[emoji] = [userId];
  return { reactions, action };
}

/**
 * Prefer the server UUID. A non-UUID key is the sender's client id.
 * When several rows share that client id, the actor's own send wins;
 * otherwise the lookup is ambiguous.
 */
export function pickReactionMessage<T extends ReactionMessageRow>(
  rows: T[],
  messageKey: string,
  actorId: string,
): T | "ambiguous" | null {
  if (UUID_PATTERN.test(messageKey)) {
    const byId = rows.filter((row) => row.id.toLowerCase() === messageKey.toLowerCase());
    if (byId.length === 1) return byId[0]!;
    if (byId.length > 1) return "ambiguous";
  }
  const byClient = rows.filter((row) => row.client_id === messageKey);
  if (byClient.length === 1) return byClient[0]!;
  if (byClient.length > 1) {
    const own = byClient.filter((row) => row.sender_id === actorId);
    if (own.length === 1) return own[0]!;
    return "ambiguous";
  }
  return null;
}
