import { writable } from 'svelte/store';

export type Toast = {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
    timeout?: number;
};

function createToastStore() {
    const { subscribe, update } = writable<Toast[]>([]);

    return {
        subscribe,
        add: (toast: Omit<Toast, 'id'>) => {
            const id = crypto.randomUUID();
            update(toasts => [...toasts, { ...toast, id }]);
            if (toast.timeout) {
                setTimeout(() => {
                    update(toasts => toasts.filter(t => t.id !== id));
                }, toast.timeout);
            }
        },
        remove: (id: string) => {
            update(toasts => toasts.filter(toast => toast.id !== id));
        }
    };
}

export const toasts = createToastStore();

export const createToast = (message: string, type: Toast['type'] = 'info', timeout = 3000) => {
    toasts.add({ message, type, timeout });
};
