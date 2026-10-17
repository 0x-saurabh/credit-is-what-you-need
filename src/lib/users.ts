import { all, NOW, one, run, transaction } from "./db.ts";

// Who a person is, as far as Kredit needs to know: the Privy user id that keys
// every table, and the email and name Privy reports so the dashboard can show
// something readable. Nothing here is a wallet.

export type User = { id: string; email: string | null; name: string | null; createdAt: string; lastSeenAt: string };

const COLUMNS = `id, email, name, created_at AS "createdAt", last_seen_at AS "lastSeenAt"`;

export function getUser(id: string) {
  return one<User>(`SELECT ${COLUMNS} FROM users WHERE id = ?`, [id]);
}

// Called on every sign-in: makes the row the first time, refreshes email,
// name and last_seen_at after that.
export async function touchUser(input: { id: string; email?: string | null; name?: string | null }) {
  await run(
    `INSERT INTO users (id, email, name) VALUES (?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       email = COALESCE(EXCLUDED.email, users.email),
       name = COALESCE(EXCLUDED.name, users.name),
       last_seen_at = ${NOW}`,
    [input.id, input.email ?? null, input.name ?? null],
  );
  return (await getUser(input.id))!;
}

// Accounts used to be keyed by a wallet address (Privy's embedded wallet for
// email users, their own for wallet users). The first time such a person
// signs in after the change, everything under their old ids moves under their
// Privy id, so balances, keys and conversations survive. Only runs when the
// Privy id has nothing of its own yet, and only moves ids that have rows.
const TABLES = ["ledger", "api_keys", "usage", "conversations", "creations", "sessions"];

export async function adoptLegacyAccounts(userId: string, legacyIds: string[]) {
  const ids = [...new Set(legacyIds.map((id) => id.trim().toLowerCase()).filter(Boolean))];
  if (ids.length === 0) return 0;
  return transaction(async () => {
    const owned = await one("SELECT 1 FROM ledger WHERE user_id = ? UNION ALL SELECT 1 FROM api_keys WHERE user_id = ? LIMIT 1", [userId, userId]);
    if (owned) return 0;
    let moved = 0;
    for (const table of TABLES) {
      moved += await run(`UPDATE ${table} SET user_id = ? WHERE user_id = ANY(?::text[])`, [userId, ids]);
    }
    return moved;
  }, userId);
}

// For the admin's eyes: how many people have signed in.
export async function countUsers() {
  const rows = await all<{ count: number }>("SELECT COUNT(*)::int AS count FROM users");
  return rows[0]?.count ?? 0;
}
