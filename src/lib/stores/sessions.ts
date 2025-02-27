import { writable } from 'svelte/store';

export const sessionsStore = writable<{
  invalidate: () => void;
}>({
  invalidate: () => {}
});
