import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const DEFAULT_DURATION = 4500;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const toast: Toast = { id, duration: DEFAULT_DURATION, ...t };
    set((s) => ({ toasts: [...s.toasts, toast] }));

    if (toast.duration && toast.duration > 0) {
      window.setTimeout(() => {
        get().dismiss(id);
      }, toast.duration);
    }

    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

// Convenience helpers (can be imported anywhere, no hook required)
export const toast = {
  success: (title: string, description?: string, duration?: number) =>
    useToastStore.getState().push({ tone: 'success', title, description, duration }),
  error: (title: string, description?: string, duration?: number) =>
    useToastStore.getState().push({ tone: 'error', title, description, duration }),
  info: (title: string, description?: string, duration?: number) =>
    useToastStore.getState().push({ tone: 'info', title, description, duration }),
  warning: (title: string, description?: string, duration?: number) =>
    useToastStore.getState().push({ tone: 'warning', title, description, duration }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};
