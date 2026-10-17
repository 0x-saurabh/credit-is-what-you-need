import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { closeAllSessions, closeSession, openSession, sessionIsLive } from "./session-store.ts";

const SESSION_COOKIE = "kredit_session";
const SESSION_TTL = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters");
  }
  return new TextEncoder().encode(value);
}

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

async function sign(payload: Record<string, string>, ttl: number) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secret());
}

async function read(name: string) {
  const token = (await cookies()).get(name)?.value;
  if (!token) return null;
  try {
    return (await jwtVerify(token, secret())).payload;
  } catch {
    return null;
  }
}

export type Session = { userId: string };

export async function createSession(userId: string) {
  (await cookies()).set(
    SESSION_COOKIE,
    await sign({ userId, sid: await openSession(userId, SESSION_TTL) }, SESSION_TTL),
    cookieOptions(SESSION_TTL),
  );
}

export async function getSession(): Promise<Session | null> {
  const payload = await read(SESSION_COOKIE);
  if (typeof payload?.userId !== "string" || typeof payload.sid !== "string") return null;
  // The cookie is only as good as its row: signing out ends it at once.
  if (!(await sessionIsLive(payload.sid, payload.userId))) return null;
  return { userId: payload.userId };
}

// `everywhere` also signs the person out of every other browser.
export async function clearSession({ everywhere = false } = {}) {
  const payload = await read(SESSION_COOKIE);
  if (typeof payload?.sid === "string") await closeSession(payload.sid);
  if (everywhere && typeof payload?.userId === "string") await closeAllSessions(payload.userId);
  (await cookies()).delete(SESSION_COOKIE);
}
