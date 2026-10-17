import { randomUUID } from "node:crypto";
import { NOW, one, run } from "./db.ts";

// The server's side of sign-in: which sessions are alive. Kept in the database
// so a restart does not sign everyone out, and signing out can end a session
// before its cookie expires.

const now = () => Math.floor(Date.now() / 1000);

export async function openSession(userId: string, ttlSeconds: number) {
  const id = randomUUID();
  await run("DELETE FROM sessions WHERE expires_at < ?", [now()]);
  await run("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [id, userId, now() + ttlSeconds]);
  return id;
}

export async function sessionIsLive(id: string, userId: string) {
  const row = await one("SELECT 1 AS live FROM sessions WHERE id = ? AND user_id = ? AND revoked_at IS NULL AND expires_at >= ?", [id, userId, now()]);
  return row !== undefined;
}

const REVOKE = `UPDATE sessions SET revoked_at = ${NOW} WHERE revoked_at IS NULL AND`;

export async function closeSession(id: string) {
  await run(`${REVOKE} id = ?`, [id]);
}

// Signs the person out of every browser, e.g. after a laptop is lost.
export function closeAllSessions(userId: string) {
  return run(`${REVOKE} user_id = ?`, [userId]);
}
