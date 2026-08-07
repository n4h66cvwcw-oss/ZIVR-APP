import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import { query, queryOne } from "./db";

export type ServerMessage = {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  type: string;
  createdAt: number;
};

const onlineUsers = new Map<string, string>();

async function sendExpoPush(tokens: string[], title: string, body: string, sound: string) {
  if (!tokens.length) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(
        tokens.map((to) => ({
          to,
          title,
          body,
          sound: sound === "none" ? undefined : "default",
          data: { sound },
        }))
      ),
    });
  } catch (err) {
    console.warn("[push] failed to send:", err);
  }
}

export function attachSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    path: "/api/socket.io",
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    let currentUserId: string | null = null;

    socket.on("user:join", async (payload: string | { userId: string; since?: number }) => {
      // Accept both legacy string form and new object form { userId, since }
      const userId = typeof payload === "string" ? payload : payload.userId;
      const since = typeof payload === "object" ? payload.since : undefined;

      currentUserId = userId;
      onlineUsers.set(userId, socket.id);

      await query(
        `UPDATE vm_users SET is_online = true, last_seen = $1 WHERE id = $2`,
        [Date.now(), userId]
      );

      const chats = await query<{ id: string }>(
        `SELECT chat_id as id FROM vm_chat_members WHERE user_id = $1`,
        [userId]
      );
      chats.forEach(({ id }) => { void socket.join(`chat:${id}`); });
      socket.join(`user:${userId}`);

      io.to(`user:${userId}`).emit("user:online", { userId, online: true });
      socket.emit("user:joined", { userId, chatRooms: chats.map((c) => c.id) });

      // If the client provided a `since` timestamp, send any messages they may
      // have missed while the socket was disconnected (e.g. app was backgrounded).
      if (since && chats.length > 0) {
        try {
          const chatIds = chats.map((c) => c.id);
          // Build a parameterised query for all chat rooms the user belongs to
          const placeholders = chatIds.map((_, i) => `$${i + 2}`).join(", ");
          const missed = await query<{
            id: string;
            chat_id: string;
            sender_id: string;
            sender_name: string;
            text: string;
            type: string;
            created_at: number;
          }>(
            `SELECT m.id, m.chat_id, m.sender_id,
                    u.display_name AS sender_name,
                    m.text, m.type, m.created_at
             FROM vm_messages m
             JOIN vm_users u ON u.id = m.sender_id
             WHERE m.created_at > $1
               AND m.chat_id IN (${placeholders})
             ORDER BY m.created_at ASC`,
            [since, ...chatIds]
          );

          if (missed.length > 0) {
            socket.emit("missed_messages", {
              messages: missed.map((m) => ({
                id: m.id,
                chatId: m.chat_id,
                senderId: m.sender_id,
                senderName: m.sender_name,
                text: m.text,
                type: m.type,
                createdAt: m.created_at,
              })),
            });
          }
        } catch (err) {
          console.error("[socket] missed_messages query error:", err);
        }
      }
    });

    socket.on("message:send", async (payload: {
      chatId: string;
      senderId: string;
      text: string;
      type?: string;
      localId?: string;
    }) => {
      try {
        const { chatId, senderId, text, type = "text", localId } = payload;

        const isMember = await queryOne<{ user_id: string }>(
          `SELECT user_id FROM vm_chat_members WHERE chat_id = $1 AND user_id = $2`,
          [chatId, senderId]
        );
        if (!isMember) { socket.emit("error", { message: "Not a member of this chat" }); return; }

        const sender = await queryOne<{ display_name: string; avatar: string }>(
          `SELECT display_name, avatar FROM vm_users WHERE id = $1`,
          [senderId]
        );

        const now = Date.now();
        const msg = await queryOne<{ id: string }>(
          `INSERT INTO vm_messages (chat_id, sender_id, text, type, created_at)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [chatId, senderId, text, type, now]
        );

        await query(
          `UPDATE vm_chats SET last_message_at = $1 WHERE id = $2`,
          [now, chatId]
        );

        const outgoing: ServerMessage = {
          id: msg!.id,
          chatId,
          senderId,
          senderName: sender?.display_name ?? "Unknown",
          text,
          type,
          createdAt: now,
        };

        io.to(`chat:${chatId}`).emit("message:new", { ...outgoing, localId });

        const offlineMembers = await query<{ id: string; push_token: string | null }>(
          `SELECT u.id, u.push_token
           FROM vm_chat_members cm
           JOIN vm_users u ON u.id = cm.user_id
           WHERE cm.chat_id = $1 AND cm.user_id != $2 AND u.is_online = false`,
          [chatId, senderId]
        );

        const tokens = offlineMembers
          .map((m) => m.push_token)
          .filter((t): t is string => !!t && t.startsWith("ExponentPushToken"));

        if (tokens.length > 0) {
          const preview = text.length > 80 ? text.slice(0, 80) + "…" : text;
          await sendExpoPush(tokens, sender?.display_name ?? "New message", preview, "default");
        }
      } catch (err) {
        console.error("message:send error", err);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    socket.on("chat:read", async (payload: { chatId: string; userId: string; lastMessageId?: string }) => {
      try {
        const { chatId, userId } = payload;
        const now = Date.now();

        const unread = await query<{ id: string; sender_id: string }>(
          `SELECT m.id, m.sender_id FROM vm_messages m
           WHERE m.chat_id = $1 AND m.sender_id != $2 AND m.read_at IS NULL`,
          [chatId, userId]
        );

        if (unread.length > 0) {
          await query(
            `UPDATE vm_messages SET read_at = $1
             WHERE chat_id = $2 AND sender_id != $3 AND read_at IS NULL`,
            [now, chatId, userId]
          );

          const senderIds = [...new Set(unread.map((m) => m.sender_id))];
          for (const sid of senderIds) {
            io.to(`user:${sid}`).emit("message:read", {
              chatId,
              readByUserId: userId,
              readAt: now,
            });
          }
        }
      } catch (err) {
        console.error("chat:read error", err);
      }
    });

    socket.on("chat:join", (chatId: string) => {
      void socket.join(`chat:${chatId}`);
    });

    socket.on("typing:start", (payload: { chatId: string; userId: string; name: string }) => {
      socket.to(`chat:${payload.chatId}`).emit("typing:update", { ...payload, typing: true });
    });

    socket.on("typing:stop", (payload: { chatId: string; userId: string }) => {
      socket.to(`chat:${payload.chatId}`).emit("typing:update", { ...payload, typing: false });
    });

    socket.on("disconnect", async () => {
      if (currentUserId) {
        onlineUsers.delete(currentUserId);
        const now = Date.now();
        await query(
          `UPDATE vm_users SET is_online = false, last_seen = $1 WHERE id = $2`,
          [now, currentUserId]
        );
        io.emit("user:offline", { userId: currentUserId, lastSeen: now });
      }
    });
  });

  return io;
}
