import { writable } from 'svelte/store';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  return {
    subscribe,
    show: (toast: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).slice(2);
      const duration = toast.duration || 3000;

      update(toasts => [...toasts, { ...toast, id }]);

      setTimeout(() => {
        update(toasts => toasts.filter(t => t.id !== id));
      }, duration);
    }
  };
}

export const toast = createToastStore();
