import assert from "node:assert/strict";
import { test } from "node:test";

await (await import("./test-db.ts")).useTestDatabase();
const { createKey, findKey, getBalance, getTotals, grantCredits, KeyLimitError, listKeys, listLedger, listPurchases, MAX_ACTIVE_KEYS, PurchaseUsedError, recordPurchase, recordUsage, revokeKey } =
  await import("./ledger.ts");
const { adoptLegacyAccounts, getUser, touchUser } = await import("./users.ts");
const { run } = await import("./db.ts");

const ALICE = "did:privy:alice";
const BOB = "did:privy:bob";

test("a purchase credits once and is listed with what it cost", async () => {
  const entry = { provider: "razorpay" as const, paymentId: "pay_001", userId: ALICE, amount: 85_000, currency: "inr", credits: 1000 };
  assert.equal(await recordPurchase(entry), 1000);
  const [row] = await listLedger(ALICE, 1);
  assert.equal(row.kind, "purchase");
  assert.equal(row.amount, 1000);
  assert.match(row.memo, /₹850\.00/);
  assert.match(row.memo, /Razorpay/);
  await assert.rejects(recordPurchase(entry), PurchaseUsedError); // the webhook came twice
  assert.equal(await getBalance(ALICE), 1000);
  assert.deepEqual(
    (await listPurchases(ALICE)).map((purchase) => [purchase.id, purchase.provider, purchase.amount, purchase.currency, purchase.credits]),
    [["razorpay:pay_001", "razorpay", 85_000, "INR", 1000]],
  );
});

test("the same payment id from another provider is a different purchase", async () => {
  await recordPurchase({ provider: "dodo", paymentId: "pay_001", userId: ALICE, amount: 1000, currency: "USD", credits: 1000 });
  assert.equal(await getBalance(ALICE), 2000);
});

test("two purchases racing each other both land, once each", async () => {
  const frank = "did:privy:frank";
  const buy = (id: string) => recordPurchase({ provider: "manual", paymentId: id, userId: frank, amount: 100, currency: "USD", credits: 100 });
  const results = await Promise.allSettled([buy("a"), buy("a"), buy("b")]);
  assert.deepEqual(results.map((result) => result.status).sort(), ["fulfilled", "fulfilled", "rejected"]);
  assert.equal(await getBalance(frank), 200);
});

test("grants move the balance and show in the totals", async () => {
  assert.equal(await grantCredits(BOB, 500, "Welcome credits"), 500);
  assert.equal(await grantCredits(BOB, -100, "Correction"), 400);
  assert.deepEqual(await getTotals(BOB), { earned: 500, spent: 100 });
  assert.deepEqual((await listLedger(BOB)).map((entry) => entry.kind), ["grant", "grant"]);
});

test("user ids are exact, not case-folded", async () => {
  assert.equal(await getBalance(ALICE.toUpperCase()), 0);
  assert.equal(await getBalance(ALICE), 2000);
});

test("keys: created once, found by value, gone when revoked", async () => {
  const created = await createKey(ALICE, "postman");
  assert.ok(created.key.startsWith("kred_sk_"));
  assert.ok(created.prefix.startsWith(created.key.slice(0, "kred_sk_".length + 4)));
  assert.equal((await findKey(created.key))?.userId, ALICE);
  assert.equal(await findKey("kred_sk_wrong"), null);
  assert.equal(await findKey("not-a-kredit-key"), null);

  assert.equal(await revokeKey(BOB, created.id), false); // someone else can't revoke it
  assert.equal(await revokeKey(ALICE, created.id), true);
  assert.equal(await findKey(created.key), null);
  assert.equal((await listKeys(ALICE)).length, 0);
});

test("the full key is never stored", async () => {
  const created = await createKey(ALICE, "secret-check");
  const { all } = await import("./db.ts");
  const dump = JSON.stringify(await all("SELECT * FROM api_keys"));
  assert.ok(!dump.includes(created.key));
  await revokeKey(ALICE, created.id);
});

test("active keys are limited", async () => {
  const dave = "did:privy:dave";
  for (let i = 0; i < MAX_ACTIVE_KEYS; i++) await createKey(dave, `key ${i}`);
  await assert.rejects(() => createKey(dave, "one too many"), KeyLimitError);
});

test("spending lowers the balance and is written to the ledger", async () => {
  const before = await getBalance(ALICE);
  const key = await createKey(ALICE, "spender");
  const after = await recordUsage({ keyId: key.id, userId: ALICE, model: "kredit/echo", inputTokens: 10, outputTokens: 5, credits: 7 });
  assert.equal(after, before - 7);
  assert.equal((await listLedger(ALICE, 1))[0].amount, -7);
  assert.ok((await listKeys(ALICE)).find((k) => k.id === key.id)?.lastUsedAt);
});

// --- Users: who signed in, and bringing wallet-era accounts across.
test("a user is made on first sign-in and refreshed after", async () => {
  const first = await touchUser({ id: "did:privy:erin", email: "erin@example.com" });
  assert.equal(first.email, "erin@example.com");
  assert.equal(first.name, null);
  const again = await touchUser({ id: "did:privy:erin", name: "Erin" });
  assert.equal(again.email, "erin@example.com"); // a missing field never erases a known one
  assert.equal(again.name, "Erin");
  assert.equal((await getUser("did:privy:nobody")), undefined);
});

test("rows under an old wallet address move under the Privy id once", async () => {
  const wallet = "0xAbCdEf0000000000000000000000000000000001";
  const hank = "did:privy:hank";
  // What the wallet era left behind: credits and a key under the address.
  await run("INSERT INTO ledger (user_id, amount, kind, memo) VALUES (?, 300, 'claim', 'old times')", [wallet.toLowerCase()]);
  const key = await createKey(wallet.toLowerCase(), "old key");

  assert.equal(await adoptLegacyAccounts(hank, [wallet]), 2);
  assert.equal(await getBalance(hank), 300);
  assert.equal(await getBalance(wallet.toLowerCase()), 0);
  assert.equal((await findKey(key.key))?.userId, hank);
  // Signing in again finds the Privy id already owns rows, so nothing moves.
  assert.equal(await adoptLegacyAccounts(hank, [wallet]), 0);
  // An id with nothing behind it moves nothing.
  assert.equal(await adoptLegacyAccounts("did:privy:ivy", ["0x0000000000000000000000000000000000000002"]), 0);
});
