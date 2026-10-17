// A signed-in cookie for the end-to-end scripts, without going through Privy
// (local testing only: real users sign in with an email code or Google). A
// session is a signed cookie plus a row in the server's database, so the
// script and the server must share SESSION_SECRET and DATABASE_URL.
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { SignJWT } from "jose";
import { query } from "./db.mjs";

export const secret =
  process.env.SESSION_SECRET ?? fs.readFileSync(".env.local", "utf8").match(/SESSION_SECRET=(.+)/)[1].trim();

// A user id that cannot collide with a real Privy id.
export const testUserId = (tag = "t") => `did:privy:test-${tag}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export async function sessionCookie(userId) {
  const sid = randomUUID();
  // The server creates the tables on its first request; make sure that has happened.
  await fetch(`${process.env.BASE_URL ?? "http://localhost:3000"}/api/health`);
  await query("INSERT INTO users (id, email) VALUES (?, ?) ON CONFLICT (id) DO NOTHING", [userId, `${userId.slice(-8)}@example.test`]);
  await query("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [sid, userId, Math.floor(Date.now() / 1000) + 600]);

  const jwt = await new SignJWT({ userId, sid })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m")
    .sign(new TextEncoder().encode(secret));
  return `kredit_session=${jwt}`;
}
