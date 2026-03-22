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

export function attachSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    let currentUserId: string | null = null;

    socket.on("user:join", async (userId: string) => {
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

      io.to(`user:${userId}`).emit("user:online", { userId, online: true });
      socket.emit("user:joined", { userId, chatRooms: chats.map((c) => c.id) });
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
      } catch (err) {
        console.error("message:send error", err);
        socket.emit("error", { message: "Failed to send message" });
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
