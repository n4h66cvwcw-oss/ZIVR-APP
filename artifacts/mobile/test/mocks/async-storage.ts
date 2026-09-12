let resolveChats: ((value: string) => void) | undefined;
let rejectChats: ((reason: Error) => void) | undefined;
let chatsPromise = new Promise<string>((resolve, reject) => {
  resolveChats = resolve;
  rejectChats = reject;
});

export function resetStorageMock() {
  chatsPromise = new Promise<string>((resolve, reject) => {
    resolveChats = resolve;
    rejectChats = reject;
  });
}

export function resolveChatHydration(chats: unknown[]) {
  resolveChats?.(JSON.stringify(chats));
}

export function rejectChatHydration(error = new Error("AsyncStorage read failed")) {
  rejectChats?.(error);
}

const AsyncStorage = {
  getItem(key: string): Promise<string | null> {
    if (key === "@zivr_chats") return chatsPromise;
    if (key === "@zivr_messages") return Promise.resolve(JSON.stringify({}));
    return Promise.resolve(null);
  },
  setItem(): Promise<void> {
    return Promise.resolve();
  },
};

export default AsyncStorage;