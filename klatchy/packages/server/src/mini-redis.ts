import EventEmitter from "node:events";

type Value = string | number | null;
type Cb = (channel: string, message: string) => void;

export class MiniRedis extends EventEmitter {
  private _store = new Map<string, Value>();
  private _sets = new Map<string, Set<string>>();
  private _subscriptions = new Map<string, Set<MiniRedis>>();
  private _subs = new Set<string>();

  static instances: MiniRedis[] = [];

  constructor() {
    super();
    MiniRedis.instances.push(this);
  }

  async connect() {}
  async quit() {
    for (const ch of this._subs) {
      this._unsub(ch);
    }
    this._subs.clear();
    this.removeAllListeners();
  }

  // Key-value
  async set(key: string, value: Value, ...args: string[]) {
    this._store.set(key, value);
    if (args[0] === "EX") {
      const ttl = Number(args[1]) * 1000;
      setTimeout(() => this._store.delete(key), ttl).unref();
    }
    return "OK";
  }

  async get(key: string): Promise<Value | undefined> {
    return this._store.get(key);
  }

  async exists(key: string): Promise<number> {
    return this._store.has(key) ? 1 : 0;
  }

  async expire(key: string, _sec: number) {
    if (this._store.has(key)) {
      setTimeout(() => this._store.delete(key), _sec * 1000).unref();
      return 1;
    }
    return 0;
  }

  async mget(...keys: string[]): Promise<(Value | undefined)[]> {
    return keys.map((k) => this._store.get(k));
  }

  async del(...keys: string[]) {
    let n = 0;
    for (const k of keys) {
      if (this._store.delete(k)) n++;
    }
    return n;
  }

  // Sets
  async sadd(key: string, val: string) {
    if (!this._sets.has(key)) this._sets.set(key, new Set());
    const s = this._sets.get(key)!;
    if (s.has(val)) return 0;
    s.add(val);
    return 1;
  }

  async srem(key: string, val: string) {
    const s = this._sets.get(key);
    if (!s) return 0;
    const ok = s.delete(val);
    if (s.size === 0) this._sets.delete(key);
    return ok ? 1 : 0;
  }

  async smembers(key: string): Promise<string[]> {
    return [...(this._sets.get(key) ?? [])];
  }

  // Pipeline (minimal)
  pipeline(): any {
    const self = this;
    const ops: Array<() => Promise<any>> = [];
    const api: any = {
      set(...args: any[]) {
        ops.push(() => self.set(args[0], args[1], ...args.slice(2)));
        return api;
      },
      sadd(...args: any[]) {
        ops.push(() => self.sadd(args[0], args[1]));
        return api;
      },
      srem(...args: any[]) {
        ops.push(() => self.srem(args[0], args[1]));
        return api;
      },
      async exec() {
        const results: Array<[null | Error, any]> = [];
        for (const fn of ops) {
          try {
            results.push([null, await fn()]);
          } catch (e: any) {
            results.push([e, null]);
          }
        }
        return results;
      },
      get length() {
        return ops.length;
      },
    };
    return api;
  }

  // Pub/sub (cross-instance via static registry)
  async publish(channel: string, message: string) {
    for (const inst of MiniRedis.instances) {
      if (inst._subs.has(channel)) {
        inst.emit("message", channel, message);
      }
    }
    return 0;
  }

  async subscribe(...channels: string[]) {
    for (const ch of channels) {
      this._subs.add(ch);
    }
  }

  async unsubscribe(...channels: string[]) {
    for (const ch of channels) {
      this._subs.delete(ch);
      this._unsub(ch);
    }
  }

  private _unsub(channel: string) {
    // no-op for mock, we just won't emit
  }
}
