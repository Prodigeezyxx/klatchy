import { create } from "zustand";
import type { VibeRequestPublic } from "@klatchy/shared";

interface ToastState {
  incoming: VibeRequestPublic | null;
  show: (vibe: VibeRequestPublic) => void;
  dismiss: () => void;
}

export const useToast = create<ToastState>((set) => ({
  incoming: null,
  show: (vibe) => set({ incoming: vibe }),
  dismiss: () => set({ incoming: null }),
}));
