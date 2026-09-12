let resolveChats: ((value: string) => void) | undefined;
let chatsPromise = new Promise<string>((resolve) => {
  resolveChats = resolve;
});

export function resetStorageMock() {
  chatsPromise = new Promise<string>((resolve) => {
    resolveChats = resolve;
  });
}

export function resolveChatHydration(chats: unknown[]) {
  resolveChats?.(JSON.stringify(chats));
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