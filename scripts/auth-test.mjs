// End-to-end check of sign-in and sessions against a running server.
//
// Privy issues the login, so the happy path (a real Privy token) cannot run
// from a script. What is checked here: the sign-in route refuses everything
// that is not a valid Privy token, and sessions behave once one exists (made
// directly in the database, the same way the other e2e scripts do).
//   SESSION_SECRET=… DATABASE_URL=postgres://… BASE_URL=http://localhost:3458 node scripts/auth-test.mjs
import { sessionCookie, testUserId } from "./lib/test-session.mjs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const results = [];
const check = (name, pass, detail = "") => { results.push(pass); console.log(`${pass ? "PASS" : "FAIL"}  ${name} ${detail}`); };
const json = { "content-type": "application/json" };

const alice = testUserId("alice");

// 1. no session -> dashboard redirects home
const anon = await fetch(`${base}/dashboard`, { redirect: "manual" });
check("dashboard blocked without session", anon.status === 307, `(status ${anon.status} -> ${anon.headers.get("location")})`);

// 2. the sign-in route only takes a real Privy token
const empty = await fetch(`${base}/api/auth/privy`, { method: "POST", headers: json, body: "{}" });
check("sign-in without a token is refused", empty.status === 400 || empty.status === 503, `(status ${empty.status})`);
const junk = await fetch(`${base}/api/auth/privy`, { method: "POST", headers: json, body: JSON.stringify({ token: "not.a.jwt" }) });
check("sign-in with a made-up token is refused", junk.status === 401 || junk.status === 503, `(status ${junk.status})`);
const forged = await fetch(`${base}/api/auth/privy`, {
  method: "POST",
  headers: json,
  // A well-formed JWT signed by nobody Privy knows.
  body: JSON.stringify({ token: "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6cHJpdnk6eCIsImlzcyI6InByaXZ5LmlvIn0.AAAA" }),
});
check("sign-in with a forged token is refused", forged.status === 401 || forged.status === 503, `(status ${forged.status})`);
const none = await fetch(`${base}/api/auth/me`);
check("/me is null before signing in", (await none.json()).userId === null);

// 3. a session works
const session = await sessionCookie(alice);
const me = await (await fetch(`${base}/api/auth/me`, { headers: { cookie: session } })).json();
check("/me returns the signed-in user", me.userId === alice && typeof me.email === "string");
const dash = await fetch(`${base}/dashboard`, { headers: { cookie: session }, redirect: "manual" });
check("dashboard opens with session", dash.status === 200 && (await dash.text()).includes(me.email));

// 4. the account is private and starts empty
const anonAccount = await fetch(`${base}/api/account`);
check("account blocked without session", anonAccount.status === 401);
const account = await (await fetch(`${base}/api/account`, { headers: { cookie: session } })).json();
check("a new account has no credits, keys or purchases", account.balance === 0 && account.keys.length === 0 && account.purchases.length === 0 && account.userId === alice);

// 5. logout
const out = await fetch(`${base}/api/auth/logout`, { method: "POST", headers: { cookie: session } });
check("logout clears cookie", out.headers.getSetCookie().some((c) => c.startsWith("kredit_session=;")));
const stale = await (await fetch(`${base}/api/auth/me`, { headers: { cookie: session } })).json();
check("a copy of the old cookie is dead after logout", stale.userId === null);

// 6. signing out everywhere ends the account's other sessions too
const laptop = await sessionCookie(alice);
const phone = await sessionCookie(alice);
await fetch(`${base}/api/auth/logout?everywhere=1`, { method: "POST", headers: { cookie: laptop } });
const other = await (await fetch(`${base}/api/auth/me`, { headers: { cookie: phone } })).json();
check("logout everywhere ends the other browser's session", other.userId === null);

process.exit(results.every(Boolean) ? 0 : 1);
