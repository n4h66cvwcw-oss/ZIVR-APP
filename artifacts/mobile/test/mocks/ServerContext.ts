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

export function useServer() {
  return {
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
  };
}