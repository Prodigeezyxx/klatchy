import { sql } from "./db/client.js";

export async function roomMembers(room: string): Promise<string[]> {
  const rows = await sql`SELECT user_id FROM room_members WHERE room = ${room}`;
  return rows.map((r: any) => r.user_id);
}

export async function joinRoom(room: string, userId: string) {
  await sql`
    INSERT INTO room_members (room, user_id)
    VALUES (${room}, ${userId})
    ON CONFLICT DO NOTHING
  `;
}

export async function leaveRoom(room: string, userId: string) {
  await sql`
    DELETE FROM room_members WHERE room = ${room} AND user_id = ${userId}
  `;
}
