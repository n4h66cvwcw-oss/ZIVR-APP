export type MessageDelivery = "live" | "missed";
export type MockServerMessage = {
  id: string;
  chatId: string;
  senderId: string;
  senderName?: string;
  text: string;
  createdAt: number;
  localId?: string;
  clientId?: string;
  reactions?: Record<string, string[]>;
};
export type ServerMessage = MockServerMessage;
export type ServerUser = { id: string; displayName: string };
export type MessageReactionEvent = {
  messageId: string;
  clientId?: string;
  chatId: string;
  emoji: string;
  userId: string;
  action: "added" | "removed";
  reactions: Record<string, string[]>;
};

let newMessageHandler: ((message: MockServerMessage, delivery: MessageDelivery) => void) | undefined;
let reactionHandler: ((event: MessageReactionEvent) => void) | undefined;
let fetchedMessages: MockServerMessage[] = [];

export const reactionPosts: Array<{ chatId: string; messageId: string; emoji: string }> = [];

export function resetServerMock() {
  newMessageHandler = undefined;
  reactionHandler = undefined;
  fetchedMessages = [];
  reactionPosts.length = 0;
}

export function setFetchedMessages(messages: MockServerMessage[]) {
  fetchedMessages = messages;
}

export function emitMessageReaction(event: MessageReactionEvent) {
  if (!reactionHandler) throw new Error("MessagingProvider has not subscribed to reactions");
  reactionHandler(event);
}

export function emitNewMessage(message: MockServerMessage, delivery: MessageDelivery) {
  if (!newMessageHandler) throw new Error("MessagingProvider has not subscribed");
  newMessageHandler(message, delivery);
}

const subscribe = () => () => {};
const asyncEmpty = async () => [];

const serverMock = {
  serverUserId: "me",
  onNewMessage: (handler: typeof newMessageHandler) => {
    newMessageHandler = handler;
    return () => { newMessageHandler = undefined; };
  },
  sendServerMessage: async () => undefined,
  fetchMessages: async () => fetchedMessages,
  postMessageReaction: async (chatId: string, messageId: string, emoji: string) => {
    reactionPosts.push({ chatId, messageId, emoji });
    const postedLocalId = messageId.startsWith("local-");
    return {
      messageId: postedLocalId ? `srv-for-${messageId}` : messageId,
      clientId: postedLocalId ? messageId : undefined,
      chatId,
      emoji,
      userId: "me",
      action: "added" as const,
      reactions: { [emoji]: ["jay", "me"] },
    };
  },
  onMessageReaction: (handler: typeof reactionHandler) => {
    reactionHandler = handler;
    return () => {
      if (reactionHandler === handler) reactionHandler = undefined;
    };
  },
  getOrCreateDirectChat: async () => ({ chatId: "chat" }),
  onReadReceipt: subscribe,
  fetchUserChats: asyncEmpty,
  translateMessage: async (text: string) => text,
  onMessageBlocked: subscribe,
  onContactRequest: subscribe,
  fetchCheckInGroups: async () => ({ ok: true as const, data: [] }),
  fetchCheckInBroadcasts: async () => ({ ok: true as const, data: [] }),
  markCheckInBroadcastsRead: async () => undefined,
  createCheckInGroup: async () => undefined,
  sendCheckinBroadcast: async () => undefined,
  replyToCheckin: async () => undefined,
  onCheckinBroadcast: subscribe,
  onCheckinReply: subscribe,
  onCheckinProgress: subscribe,
};

export function useServer() {
  return serverMock;
}