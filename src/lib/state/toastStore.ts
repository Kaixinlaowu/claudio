import { create } from 'zustand';

interface ToastState {
  message: string;
  visible: boolean;
  show: (msg: string) => void;
  hide: () => void;
}

let timer: ReturnType<typeof setTimeout>;

export const useToastStore = create<ToastState>((set) => ({
  message: '',
  visible: false,
  show: (msg) => {
    clearTimeout(timer);
    set({ message: msg, visible: true });
    timer = setTimeout(() => set({ visible: false }), 2000);
  },
  hide: () => { clearTimeout(timer); set({ visible: false }); },
}));
