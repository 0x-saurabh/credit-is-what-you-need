import { createHash, randomBytes, randomUUID } from "node:crypto";
import { all, NOW, one, run, transaction } from "./db.ts";
import { formatMoney } from "./format.ts";

import { MAX_ACTIVE_KEYS } from "./limits.ts";

export { MAX_ACTIVE_KEYS };
const KEY_PREFIX = "kred_sk_";
// Keys made before the rename still work: lookup is by hash, only the prefix check needs both.
const KEY_PREFIXES = [KEY_PREFIX, "kredit_sk_"];

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

export async function getBalance(userId: string) {
  const row = await one<{ balance: number }>("SELECT COALESCE(SUM(amount), 0)::int AS balance FROM ledger WHERE user_id = ?", [userId]);
  return row?.balance ?? 0;
}

// Everything that ever came in, and everything that went out, as positive numbers.
export async function getTotals(userId: string) {
  const row = await one<{ earned: number; spent: number }>(
    "SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::int AS earned, COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)::int AS spent FROM ledger WHERE user_id = ?",
    [userId],
  );
  return { earned: row?.earned ?? 0, spent: row?.spent ?? 0 };
}

export type LedgerEntry = {
  id: number;
  amount: number;
  kind: string;
  memo: string;
  createdAt: string;
};

export function listLedger(userId: string, limit = 20) {
  return all<LedgerEntry>(`SELECT id, amount, kind, memo, created_at AS "createdAt" FROM ledger WHERE user_id = ? ORDER BY id DESC LIMIT ?`, [
    userId,
    limit,
  ]);
}

// --- Buying credits ------------------------------------------------------------

export type PurchaseProvider = "razorpay" | "dodo" | "manual";

export type Purchase = {
  id: string;
  provider: PurchaseProvider;
  amount: number; // smallest unit of `currency`
  currency: string;
  credits: number;
  createdAt: string;
};

export class PurchaseUsedError extends Error {}

// A payment turns into credits exactly once. `paymentId` is the provider's id
// for the payment (Razorpay's pay_…, Dodo's payment id), so a webhook that is
// delivered twice, or a success page that is reloaded, cannot pay twice.
export function recordPurchase(entry: {
  provider: PurchaseProvider;
  paymentId: string;
  userId: string;
  amount: number;
  currency: string;
  credits: number;
}) {
  const id = `${entry.provider}:${entry.paymentId}`;
  return transaction(async () => {
    const written = await run(
      "INSERT INTO purchases (id, user_id, provider, amount, currency, credits) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
      [id, entry.userId, entry.provider, entry.amount, entry.currency.toUpperCase(), entry.credits],
    );
    if (written === 0) throw new PurchaseUsedError("This payment has already been turned into credits.");
    const money = formatMoney(entry.amount, entry.currency);
    await run("INSERT INTO ledger (user_id, amount, kind, memo) VALUES (?, ?, 'purchase', ?)", [
      entry.userId,
      entry.credits,
      `Paid ${money} through ${providerName(entry.provider)}`,
    ]);
    return getBalance(entry.userId);
  }, entry.userId);
}

export function listPurchases(userId: string, limit = 50) {
  return all<Purchase>(
    `SELECT id, provider, amount, currency, credits, created_at AS "createdAt" FROM purchases WHERE user_id = ? ORDER BY created_at DESC, id LIMIT ?`,
    [userId, limit],
  );
}

// Credits given by hand: a welcome bonus, a refund, a correction. Positive or negative.
export function grantCredits(userId: string, credits: number, memo: string) {
  return transaction(async () => {
    await run("INSERT INTO ledger (user_id, amount, kind, memo) VALUES (?, ?, 'grant', ?)", [userId, credits, memo]);
    return getBalance(userId);
  }, userId);
}

const providerName = (provider: PurchaseProvider) => ({ razorpay: "Razorpay", dodo: "Dodo Payments", manual: "Kredit" })[provider];

// --- API keys --------------------------------------------------------------

export type ApiKeyInfo = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export function listKeys(userId: string) {
  return all<ApiKeyInfo>(
    `SELECT id, name, prefix, created_at AS "createdAt", last_used_at AS "lastUsedAt" FROM api_keys WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC, id`,
    [userId],
  );
}

export class KeyLimitError extends Error {}

export function createKey(userId: string, name: string) {
  return transaction(async () => {
    if ((await listKeys(userId)).length >= MAX_ACTIVE_KEYS) {
      throw new KeyLimitError(`You can have at most ${MAX_ACTIVE_KEYS} active keys. Revoke one first.`);
    }
    const key = KEY_PREFIX + randomBytes(24).toString("base64url");
    const id = randomUUID();
    const prefix = `${key.slice(0, KEY_PREFIX.length + 4)}…${key.slice(-4)}`;
    await run("INSERT INTO api_keys (id, user_id, key_hash, prefix, name) VALUES (?, ?, ?, ?, ?)", [id, userId, hashKey(key), prefix, name]);
    return { id, key, prefix, name }; // the only time the full key exists outside the user's hands
  }, userId);
}

export async function revokeKey(userId: string, id: string) {
  const changed = await run(`UPDATE api_keys SET revoked_at = ${NOW} WHERE id = ? AND user_id = ? AND revoked_at IS NULL`, [id, userId]);
  return changed > 0;
}

export async function findKey(key: string) {
  if (!KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) return null;
  const row = await one<{ id: string; userId: string; name: string; prefix: string }>(
    `SELECT id, user_id AS "userId", name, prefix FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL`,
    [hashKey(key)],
  );
  return row ?? null;
}

// --- Spending ----------------------------------------------------------------

export function recordUsage(entry: {
  keyId: string;
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  credits: number;
}) {
  return transaction(async () => {
    await run("INSERT INTO usage (key_id, user_id, model, input_tokens, output_tokens, credits) VALUES (?, ?, ?, ?, ?, ?)", [
      entry.keyId,
      entry.userId,
      entry.model,
      entry.inputTokens,
      entry.outputTokens,
      entry.credits,
    ]);
    await run("INSERT INTO ledger (user_id, amount, kind, memo) VALUES (?, ?, 'spend', ?)", [entry.userId, -entry.credits, entry.model]);
    await run(`UPDATE api_keys SET last_used_at = ${NOW} WHERE id = ?`, [entry.keyId]);
    return getBalance(entry.userId);
  });
}

export type UsageRow = {
  id: number;
  keyId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  credits: number;
  createdAt: string;
};

// A page of a user's calls, newest first. `before` is the id to continue from.
export async function listUsage(userId: string, filter: { from?: string; to?: string; before?: number; limit?: number } = {}) {
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
  const rows = await all<UsageRow>(
    `SELECT id, key_id AS "keyId", model, input_tokens AS "inputTokens", output_tokens AS "outputTokens", credits, created_at AS "createdAt"
     FROM usage WHERE user_id = ? AND (?::text IS NULL OR created_at >= ?) AND (?::text IS NULL OR created_at < ?) AND (?::int IS NULL OR id < ?)
     ORDER BY id DESC LIMIT ?`,
    [
      userId,
      filter.from ?? null, filter.from ?? null,
      filter.to ?? null, filter.to ?? null,
      filter.before ?? null, filter.before ?? null,
      limit + 1,
    ],
  );
  const page = rows.slice(0, limit);
  return { rows: page, next: rows.length > limit ? page[page.length - 1].id : null };
}

// Spend per model over a period.
export function usageByModel(userId: string, filter: { from?: string; to?: string } = {}) {
  return all<{ model: string; calls: number; inputTokens: number; outputTokens: number; credits: number }>(
    `SELECT model, COUNT(*)::int AS calls, SUM(input_tokens)::int AS "inputTokens", SUM(output_tokens)::int AS "outputTokens", SUM(credits)::int AS credits
     FROM usage WHERE user_id = ? AND (?::text IS NULL OR created_at >= ?) AND (?::text IS NULL OR created_at < ?)
     GROUP BY model ORDER BY credits DESC, model`,
    [userId, filter.from ?? null, filter.from ?? null, filter.to ?? null, filter.to ?? null],
  );
}
