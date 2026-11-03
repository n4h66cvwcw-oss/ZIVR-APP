import pool from "./db";
import {
  pickReactionMessage,
  toggleReaction,
  type MessageReactionEvent,
  type ReactionMessageRow,
} from "./reactions";

type StoredReactionRow = ReactionMessageRow & { reactions: unknown };

/**
 * Atomically toggle a reaction on a message in this chat.
 * messageKey is vm_messages.id or the sender's client_id.
 * The row lock serializes concurrent toggles so two peers cannot drop each other.
 */
export async function toggleMessageReaction(input: {
  chatId: string;
  messageKey: string;
  userId: string;
  emoji: string;
}): Promise<
  | { ok: true; event: MessageReactionEvent }
  | { ok: false; status: 404 | 409; error: string; code: string }
> {
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query("BEGIN");
    const found = await client.query<StoredReactionRow>(
      `SELECT id, sender_id, client_id, reactions
         FROM vm_messages
        WHERE chat_id = $1::uuid
          AND (lower(id::text) = lower($2) OR client_id = $2)
        FOR UPDATE`,
      [input.chatId, input.messageKey],
    );
    const picked = pickReactionMessage(found.rows, input.messageKey, input.userId);
    if (picked === "ambiguous") {
      return { ok: false, status: 409, error: "Message id matches more than one message", code: "ambiguous" };
    }
    if (!picked) {
      return { ok: false, status: 404, error: "Message not found", code: "not_found" };
    }
    const { reactions, action } = toggleReaction(picked.reactions, input.emoji, input.userId);
    await client.query(
      `UPDATE vm_messages SET reactions = $2::jsonb WHERE id = $1`,
      [picked.id, JSON.stringify(reactions)],
    );
    await client.query("COMMIT");
    committed = true;
    return {
      ok: true,
      event: {
        messageId: picked.id,
        chatId: input.chatId,
        emoji: input.emoji,
        userId: input.userId,
        action,
        reactions,
        clientId: picked.client_id,
      },
    };
  } finally {
    if (!committed) {
      try { await client.query("ROLLBACK"); } catch { /* connection already failed */ }
    }
    client.release();
  }
}
