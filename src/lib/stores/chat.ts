import { writable } from 'svelte/store';

export function createChatStore() {
  const sessions = writable([]);
  const currentSessionId = writable(null);

  return {
    sessions,
    currentSessionId,
    createNewSession: () => {
      // 简单实现
      currentSessionId.set(Date.now().toString());
    },
    setCurrentSession: (id: string) => {
      currentSessionId.set(id);
    },
    deleteSession: async (id: string) => {
      // 简单实现
      currentSessionId.set(null);
    }
  };
}