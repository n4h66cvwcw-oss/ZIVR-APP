export type MessageDelivery = "live" | "missed";
export type MockServerMessage = {
  id: string;
  chatId: string;
  senderId: string;
  senderName?: string;
  text: string;
  createdAt: number;
  localId?: string;
};
export type ServerMessage = MockServerMessage;
export type ServerUser = { id: string; displayName: string };

let newMessageHandler: ((message: MockServerMessage, delivery: MessageDelivery) => void) | undefined;

export function resetServerMock() {
  newMessageHandler = undefined;
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