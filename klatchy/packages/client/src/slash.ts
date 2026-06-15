import { readFileSync } from "node:fs";
import type { KlatchyClient } from "./ws.js";
import type { SessionInfo } from "./store.js";
import { useStore } from "./store.js";
import { captureDiff } from "./git.js";

export interface ParsedCommand {
  cmd: string;
  arg: string;
}

export function parseSlash(raw: string): ParsedCommand | null {
  if (!raw.startsWith("/")) return null;
  const rest = raw.slice(1);
  const parts = rest.split(/\s+/);
  return {
    cmd: (parts[0] ?? "").toLowerCase(),
    arg: parts.slice(1).join(" "),
  };
}

export function dispatchSlash(
  client: KlatchyClient,
  parsed: ParsedCommand,
): string | null {
  const { cmd, arg } = parsed;
  const state = useStore.getState();
  const sess = state.activeSession;

  if (cmd === "pair" && arg) {
    const handle = arg.split(/\s+/)[0]?.replace(/^@/, "") ?? "";
    const msg = arg.split(/\s+/).slice(1).join(" ") || `vibe with @${handle}?`;
    client.sendVibe({ message: msg, targetHandle: handle });
    return `vibing @${handle}…`;
  }

  if (cmd === "ask" && arg) {
    const parts = arg.split(/\s+/);
    const room = parts[0] ?? "";
    const msg = parts.slice(1).join(" ") || "anyone around?";
    client.sendVibe({ message: msg, targetRoom: room });
    return `posted to ${room}`;
  }

  if (!sess) {
    return "not in a session — try /pair @handle first";
  }

  switch (cmd) {
    case "end":
      client.endSession(sess.sessionId);
      return "ending session…";

    case "rate": {
      const stars = parseInt(arg);
      if (isNaN(stars) || stars < 1 || stars > 5) return "usage: /rate 1..5";
      client.rateSession(sess.sessionId, stars);
      return `rated ${stars}★`;
    }

    case "diff": {
      const diff = captureDiff();
      state.appendLocal(diff, "diff");
      client.sendSessionMessage(sess.sessionId, diff, "diff");
      return null;
    }

    case "share": {
      if (!arg) return "usage: /share <path>";
      try {
        const body = readFileSync(arg, "utf-8").slice(0, 4000);
        const payload = `# ${arg}\n\n${body}`;
        state.appendLocal(payload, "code");
        client.sendSessionMessage(sess.sessionId, payload, "code");
      } catch (e: any) {
        return `share failed: ${e.message}`;
      }
      return null;
    }

    case "ai": {
      const stub = arg || "(claude code transcript bridge not yet wired — stub)";
      state.appendLocal(stub, "ai");
      client.sendSessionMessage(sess.sessionId, stub, "ai");
      return null;
    }

    case "timer":
      return `timer command stub: ${arg || "15m"}`;

    default:
      return `unknown command: /${cmd}`;
  }
}
