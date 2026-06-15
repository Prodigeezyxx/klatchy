import WebSocket from "ws";
import { encode, decodeServer, RECONNECT_BACKOFF } from "@klatchy/shared";
import type { ClientMessage, ServerMessage } from "@klatchy/shared";
import { useStore } from "./store.js";

export class KlatchyClient {
  private url: string;
  private jwt: string;
  private ws: WebSocket | null = null;
  private _closed = false;
  private _hbTimer?: ReturnType<typeof setInterval>;

  constructor(serverUrl: string, jwt: string) {
    this.url = serverUrl.replace(/\/$/, "") + "/ws";
    this.jwt = jwt;
  }

  async run() {
    let attempt = 0;
    while (!this._closed) {
      try {
        await this._connect();
        attempt = 0;
      } catch (err) {
        if (this._closed) break;
        const delay = RECONNECT_BACKOFF[Math.min(attempt, RECONNECT_BACKOFF.length - 1)]!;
        attempt++;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  stop() {
    this._closed = true;
    if (this._hbTimer) clearInterval(this._hbTimer);
    this.ws?.close();
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(encode(msg));
    }
  }

  // convenience wrappers
  setPresence(status: string) {
    this.send({ op: "presence.set", status: status as any });
  }

  sendVibe(opts: {
    message: string;
    tags?: string[];
    durationSec?: number;
    targetHandle?: string;
    targetRoom?: string;
  }) {
    this.send({
      op: "vibe.send",
      message: opts.message,
      tags: opts.tags ?? [],
      durationSec: opts.durationSec ?? 900,
      targetHandle: opts.targetHandle,
      targetRoom: opts.targetRoom,
    });
  }

  acceptVibe(vibeId: string) {
    this.send({ op: "vibe.accept", vibeId });
  }

  declineVibe(vibeId: string) {
    this.send({ op: "vibe.decline", vibeId });
  }

  sendSessionMessage(sessionId: string, body: string, kind: string = "text", meta: Record<string, unknown> = {}) {
    this.send({
      op: "session.message",
      sessionId,
      body,
      kind: kind as any,
      meta,
    });
  }

  endSession(sessionId: string) {
    this.send({ op: "session.end", sessionId });
  }

  rateSession(sessionId: string, stars: number, comment?: string) {
    this.send({ op: "session.rate", sessionId, stars, comment });
  }

  joinRoom(room: string) {
    this.send({ op: "room.join", room });
  }

  leaveRoom(room: string) {
    this.send({ op: "room.leave", room });
  }

  // ── private ──

  private _connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url, [`bearer.${this.jwt}`]);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("connection timeout"));
      }, 5_000);

      ws.on("open", () => {
        clearTimeout(timeout);
        this.ws = ws;
        this._hbTimer = setInterval(() => this.send({ op: "ping", t: Date.now() }), 25_000);
        resolve();
      });

      ws.on("message", (raw: Buffer) => {
        try {
          const msg = decodeServer(raw.toString()) as ServerMessage;
          useStore.getState().apply(msg);
        } catch {
          // ignore parse errors
        }
      });

      ws.on("close", () => {
        if (this._hbTimer) clearInterval(this._hbTimer);
        if (this.ws === ws) {
          this.ws = null;
          reject(new Error("closed"));
        }
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }
}
