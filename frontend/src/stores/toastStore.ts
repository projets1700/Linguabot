import { create } from "zustand";

type ToastState = {
  message: string | null;
  showToast: (message: string) => void;
  dismissToast: () => void;
};

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  showToast: (message) => set({ message }),
  dismissToast: () => set({ message: null }),
}));
