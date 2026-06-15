import postgres from "postgres";
import { settings } from "../settings.js";

export const sql = postgres(settings.databaseUrl, {
  max: 10,
  idle_timeout: 30,
});

export async function initDb() {
  // Create tables if not exist — simple bootstrap for P1.
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      github_id BIGINT UNIQUE NOT NULL,
      handle TEXT UNIQUE NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      bio TEXT,
      timezone TEXT,
      tier TEXT NOT NULL DEFAULT 'free',
      pubkey BYTEA,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS user_tags (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      weight REAL NOT NULL DEFAULT 1.0,
      PRIMARY KEY (user_id, tag)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS vibe_requests (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      tags TEXT[] NOT NULL DEFAULT '{}',
      duration_sec INT NOT NULL DEFAULT 900,
      target_handle TEXT,
      target_room TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      matched_with TEXT REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expired_at TIMESTAMPTZ,
      matched_at TIMESTAMPTZ
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      vibe_request_id TEXT REFERENCES vibe_requests(id) ON DELETE SET NULL,
      initiator_id TEXT NOT NULL REFERENCES users(id),
      recipient_id TEXT NOT NULL REFERENCES users(id),
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ended_at TIMESTAMPTZ,
      duration_sec INT,
      used_turn BOOLEAN NOT NULL DEFAULT false,
      end_reason TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS ratings (
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      rater_id TEXT NOT NULL REFERENCES users(id),
      ratee_id TEXT NOT NULL REFERENCES users(id),
      stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
      comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (session_id, rater_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS karma_events (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      delta INT NOT NULL,
      reason TEXT NOT NULL,
      ref_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS room_members (
      room TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (room, user_id)
    )
  `;
}
