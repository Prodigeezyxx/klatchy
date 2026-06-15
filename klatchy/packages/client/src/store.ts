import { create } from "zustand";
import type { DevPublic, ServerMessage, VibeRequestPublic } from "@klatchy/shared";
import { ChatLine } from "@klatchy/shared";

export interface SessionInfo {
  sessionId: string;
  peer: DevPublic;
  role: "initiator" | "recipient";
  durationSec: number;
}

export interface State {
  me: DevPublic | null;
  pool: DevPublic[];
  incomingVibe: VibeRequestPublic | null;
  activeSession: SessionInfo | null;
  messages: ChatLine[];
  lastError: string | null;
}

interface Actions {
  apply: (msg: ServerMessage) => void;
  appendLocal: (body: string, kind?: "text" | "code" | "diff" | "ai" | "system") => ChatLine;
  reset: () => void;
}

const initialState: State = {
  me: null,
  pool: [],
  incomingVibe: null,
  activeSession: null,
  messages: [],
  lastError: null,
};

export const useStore = create<State & Actions>((set, get) => ({
  ...initialState,

  apply: (msg: ServerMessage) => {
    switch (msg.op) {
      case "hello":
        set({ me: msg.me });
        break;

      case "pool.update":
        set({ pool: msg.users });
        break;

      case "vibe.incoming":
        set({ incomingVibe: msg.request });
        break;

      case "vibe.matched":
        set({
          activeSession: {
            sessionId: msg.sessionId,
            peer: msg.peer,
            role: msg.role,
            durationSec: msg.durationSec,
          },
          incomingVibe: null,
          messages: [
            {
              who: "system",
              body: `matched with @${msg.peer.handle} · ${msg.peer.match}% · karma ${msg.peer.karma.toLocaleString()}`,
              kind: "system",
              ts: Date.now(),
            },
          ],
        });
        break;

      case "vibe.filled":
        set({ incomingVibe: null });
        break;

      case "vibe.expired":
        set({ incomingVibe: null });
        break;

      case "session.message": {
        const line: ChatLine = {
          who: msg.fromHandle,
          body: msg.body,
          kind: msg.kind ?? "text",
          ts: msg.ts,
        };
        set((s) => ({ messages: [...s.messages, line] }));
        break;
      }

      case "session.ended":
        set((s) => ({
          activeSession: null,
          messages: [
            ...s.messages,
            { who: "system", body: `session ended (${msg.reason})`, kind: "system", ts: Date.now() },
          ],
        }));
        break;

      case "karma.update":
        set((s) => ({
          me: s.me ? { ...s.me, karma: msg.newTotal } : s.me,
        }));
        break;

      case "error":
        set({ lastError: msg.message });
        break;

      default:
        break;
    }
  },

  appendLocal: (body: string, kind: "text" | "code" | "diff" | "ai" | "system" = "text") => {
    const state = get();
    const who = state.me?.handle ?? "you";
    const line: ChatLine = { who, body, kind, ts: Date.now() };
    set((s) => ({ messages: [...s.messages, line] }));
    return line;
  },

  reset: () => set(initialState),
}));
