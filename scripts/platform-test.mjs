// End-to-end check of the public platform pieces: the pages, the playground and purchases.
// Needs a server and this script to share SESSION_SECRET and DATABASE_URL:
//   SESSION_SECRET=… DATABASE_URL=postgres://… npx next start -p 3458
//   SESSION_SECRET=… DATABASE_URL=postgres://… BASE_URL=http://localhost:3458 node scripts/platform-test.mjs
// Credits are seeded straight into the database (local testing only).
import { query } from "./lib/db.mjs";
import { sessionCookie, testUserId } from "./lib/test-session.mjs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const USER = testUserId("platform"); // a fresh account every run
const cookie = await sessionCookie(USER);

const results = [];
const check = (name, pass, detail = "") => { results.push(pass); console.log(`${pass ? "PASS" : "FAIL"}  ${name} ${detail}`); };
const app = (path, init = {}) => fetch(base + path, { ...init, headers: { cookie, "content-type": "application/json", ...init.headers } });
const json = async (response) => response.json();

// --- pages render
for (const page of ["/", "/docs", "/docs/credits/buying", "/catalog", "/playground"]) {
  check(`${page} renders`, (await fetch(base + page)).status === 200);
}
check("the old earn docs are gone", (await fetch(`${base}/docs/earn/scoring`)).status === 404);

// --- the signed-in product
for (const page of ["/dashboard", "/dashboard/keys", "/dashboard/activity", "/dashboard/credits", "/dashboard/settings"]) {
  check(`${page} renders for a signed-in user`, (await app(page)).status === 200);
}
check("the earn page is gone", (await app("/dashboard/earn")).status === 404);
const stranger = await fetch(`${base}/dashboard/keys`, { redirect: "manual" });
check("dashboard pages send signed-out visitors away", stranger.status >= 300 && stranger.status < 400);

// --- playground
const hello = { model: "kredit/echo", stream: true, messages: [{ role: "user", content: "hi" }] };
const signedOut = await fetch(`${base}/api/playground`, { method: "POST", body: JSON.stringify(hello) });
check("playground needs a session", signedOut.status === 401);
const broke = await app("/api/playground", { method: "POST", body: JSON.stringify(hello) });
check("playground refuses an empty balance", broke.status === 402, `(${(await json(broke)).error.code})`);

// A purchase, as the payment webhook would write it.
await query("INSERT INTO purchases (id, user_id, provider, amount, currency, credits) VALUES (?, ?, 'manual', 50, 'USD', 500)", [`manual:platform-test-${Date.now()}`, USER]);
await query("INSERT INTO ledger (user_id, amount, kind, memo) VALUES (?, 500, 'purchase', 'platform-test')", [USER]);

const reply = await app("/api/playground", { method: "POST", body: JSON.stringify(hello) });
const stream = await reply.text();
check("playground streams the model's answer", reply.status === 200 && stream.includes("Kredit echo: hi") && stream.includes("[DONE]"));
const account = await json(await app("/api/account"));
check("the reply was paid from the account's balance", account.balance === 499, `(balance ${account.balance})`);
check("the purchase shows on the account", account.purchases.length === 1 && account.purchases[0].credits === 500 && account.purchases[0].currency === "USD");
check("the ledger shows the purchase and the spend", account.activity.some((e) => e.kind === "purchase") && account.activity.some((e) => e.kind === "spend"));
const essay = { ...hello, messages: [{ role: "user", content: "Explain rate limiting in depth. ".repeat(300) }] };
await (await app("/api/playground", { method: "POST", body: JSON.stringify(essay) })).text();
const afterEssay = (await json(await app("/api/account"))).balance;
check("a long request costs more than a short one", 499 - afterEssay > 10, `(${499 - afterEssay} credits vs 1)`);
const usage = (await query("SELECT key_id FROM usage WHERE user_id = ?", [USER])).rows[0];
check("usage is recorded under the playground, not a key", usage?.key_id === "playground");

// --- export carries everything
const exported = await json(await app("/api/account/export"));
check("the export has the profile, ledger, purchases and usage", exported.user?.id === USER && exported.ledger.length >= 2 && exported.purchases.length === 1 && exported.usage.length >= 1);

// --- buying credits
const paymentsConfig = await json(await fetch(`${base}/api/payments/config`));
check("the payments config lists providers and packs", Array.isArray(paymentsConfig.providers) && Array.isArray(paymentsConfig.packs));
const anonCheckout = await fetch(`${base}/api/payments/checkout`, { method: "POST", body: JSON.stringify({ credits: 1000 }) });
check("checkout needs a session", anonCheckout.status === 401);
const badPack = await app("/api/payments/checkout", { method: "POST", body: JSON.stringify({ credits: 7 }) });
check("checkout refuses a pack that is not for sale", badPack.status === 400 || badPack.status === 503, `(${badPack.status})`);
const unsigned = await fetch(`${base}/api/payments/dodo/webhook`, { method: "POST", body: "{}" });
check("an unsigned webhook is refused", unsigned.status === 401 || unsigned.status === 503, `(${unsigned.status})`);

// --- models
const models = await json(await fetch(`${base}/api/models`));
check("the model catalog always has the test model", models.models.some((model) => model.id === "kredit/echo"));

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
