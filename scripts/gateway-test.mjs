// End-to-end check of purchase -> key -> gateway -> balance.
// Needs a server started with the same SESSION_SECRET and DATABASE_URL as .env.local:
//   DATABASE_URL=postgres://… npx next start -p 3458
//   DATABASE_URL=postgres://… BASE_URL=http://localhost:3458 node scripts/gateway-test.mjs
// Credits are seeded the way the payment webhook writes them (local testing only).
import { query } from "./lib/db.mjs";
import { sessionCookie, testUserId } from "./lib/test-session.mjs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const USER = testUserId("gateway");
const cookie = await sessionCookie(USER);

const results = [];
const check = (name, pass, detail = "") => { results.push(pass); console.log(`${pass ? "PASS" : "FAIL"}  ${name} ${detail}`); };
const app = (path, init = {}) => fetch(base + path, { ...init, headers: { cookie, "content-type": "application/json", ...init.headers } });
const chat = (key, body) => fetch(`${base}/v1/chat/completions`, {
  method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body),
});
const hello = { model: "kredit/echo", messages: [{ role: "user", content: "hello kredit" }] };

// --- before any credits
const start = await (await app("/api/account")).json();
check("new account starts at zero", start.balance === 0 && start.keys.length === 0);

const created = await (await app("/api/keys", { method: "POST", body: JSON.stringify({ name: "test" }) })).json();
check("key is created and shown once", created.key?.startsWith("kred_sk_"));
const broke = await chat(created.key, hello);
check("gateway refuses an account with no credits", broke.status === 402, `(${(await broke.json()).error.code})`);

// --- a purchase lands
const BOUGHT = 2000;
const paymentId = `gateway-test-${Date.now()}`;
await query("INSERT INTO purchases (id, user_id, provider, amount, currency, credits) VALUES (?, ?, 'manual', 200, 'USD', ?)", [`manual:${paymentId}`, USER, BOUGHT]);
await query("INSERT INTO ledger (user_id, amount, kind, memo) VALUES (?, ?, 'purchase', 'Paid $2.00 through Kredit')", [USER, BOUGHT]);
const funded = await (await app("/api/account")).json();
check("the purchase is on the balance and in the list", funded.balance === BOUGHT && funded.purchases[0]?.id === `manual:${paymentId}`);
const twice = await query("INSERT INTO purchases (id, user_id, provider, amount, currency, credits) VALUES (?, ?, 'manual', 200, 'USD', ?) ON CONFLICT DO NOTHING", [`manual:${paymentId}`, USER, BOUGHT]);
check("the same payment cannot be written twice", twice.rowCount === 0);

// --- gateway
const noKey = await fetch(`${base}/v1/chat/completions`, { method: "POST", body: JSON.stringify(hello) });
check("gateway rejects a missing key", noKey.status === 401);
const wrongKey = await chat("kred_sk_not_a_real_key", hello);
check("gateway rejects a wrong key", wrongKey.status === 401);
const bad = await chat(created.key, { model: "kredit/echo" });
check("gateway rejects a body without messages", bad.status === 400);

const reply = await chat(created.key, hello);
const replyBody = await reply.json();
check("echo model answers in OpenAI format", reply.status === 200 && replyBody.choices[0].message.content === "Kredit echo: hello kredit");
check("response reports the charge", reply.headers.get("x-kredit-credits-charged") === "1" && reply.headers.get("x-kredit-balance") === String(BOUGHT - 1));

const streamed = await chat(created.key, { ...hello, stream: true });
const sse = await streamed.text();
check("streaming works", streamed.headers.get("content-type").includes("text/event-stream") && sse.includes("Kredit echo: hello kredit") && sse.trim().endsWith("data: [DONE]"));

const real = await chat(created.key, { ...hello, model: "some/real-model" });
const realCode = (await real.json()).error.code;
// Without a provider: 503. With one (CI runs a mock): the made-up model is unknown.
check("an unlisted model is refused with a clear reason", (real.status === 503 && realCode === "provider_not_configured") || (real.status === 404 && realCode === "model_not_found"), `(${realCode})`);

const models = await (await fetch(`${base}/v1/models`, { headers: { authorization: `Bearer ${created.key}` } })).json();
check("/v1/models lists the echo model", models.data.some((m) => m.id === "kredit/echo"));

const v1Account = await (await fetch(`${base}/v1/account`, { headers: { authorization: `Bearer ${created.key}` } })).json();
check("/v1/account names the user behind the key", v1Account.user_id === USER && typeof v1Account.email === "string" && v1Account.balance === BOUGHT - 2);

const after = await (await app("/api/account")).json();
check("balance dropped by the two paid calls", after.balance === BOUGHT - 2, `(${BOUGHT} -> ${after.balance})`);
check("activity shows the purchase and the spending", after.activity.some((e) => e.kind === "purchase") && after.activity.filter((e) => e.kind === "spend").length === 2);
check("key shows as used", Boolean(after.keys[0].lastUsedAt));

// --- revoke
const revoked = await app(`/api/keys/${created.id}`, { method: "DELETE" });
check("key can be revoked", revoked.status === 200);
check("revoked key stops working at once", (await chat(created.key, hello)).status === 401);

// --- other people can't touch this account
const stranger = await fetch(`${base}/api/account`);
check("account is private without a session", stranger.status === 401);

process.exit(results.every(Boolean) ? 0 : 1);
