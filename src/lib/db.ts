import { AsyncLocalStorage } from "node:async_hooks";
import { Pool } from "pg";

// Postgres, hosted on Neon. DATABASE_URL is the connection string; the tables
// are created on first use, so a fresh database needs no setup step.

// The current UTC time as an ISO string, the shape every timestamp here has.
export const NOW = `to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

const SCHEMA = `
  -- Who signs in. The id is Privy's user id (did:privy:…); email and name are
  -- what Privy knows about the person, refreshed on every sign-in.
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW},
    last_seen_at TEXT NOT NULL DEFAULT ${NOW}
  );

  -- Every credit movement. A user's balance is the sum of their rows.
  CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    kind TEXT NOT NULL,          -- purchase | grant | spend (older rows: claim, milestone, streak, referral, topup)
    memo TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );

  -- Only the hash of a key is stored; the key itself is shown once.
  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    prefix TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT ${NOW},
    last_used_at TEXT,
    revoked_at TEXT
  );

  -- A payment buys credits exactly once: the id is the payment provider's own
  -- id for it, so a webhook delivered twice cannot pay twice.
  CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,           -- "<provider>:<payment id>"
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,        -- razorpay | dodo | manual
    amount INTEGER NOT NULL,       -- in the currency's smallest unit (paise, cents)
    currency TEXT NOT NULL,        -- INR, USD, …
    credits INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );

  -- A signed-in browser. The cookie only names a row here, so signing out
  -- (here or everywhere) ends the session before the cookie expires.
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT ${NOW},
    expires_at INTEGER NOT NULL,   -- unix seconds
    revoked_at TEXT
  );

  -- The workspace: a user's conversations, their messages, and their library
  -- of pictures and clips. Deleting a conversation deletes its messages.
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    model TEXT NOT NULL,
    system TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW},
    updated_at TEXT NOT NULL DEFAULT ${NOW}
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    model TEXT,
    credits INTEGER,
    ms INTEGER,
    attachments TEXT,              -- JSON list of file names, never the bytes
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX IF NOT EXISTS messages_conversation ON messages (conversation_id, id);

  CREATE TABLE IF NOT EXISTS creations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,            -- image | video
    prompt TEXT NOT NULL,
    model TEXT NOT NULL,
    credits INTEGER,
    files TEXT NOT NULL,           -- JSON [{ base64, mediaType }]
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );

  -- A CLI login in progress: the terminal shows a code, the browser approves
  -- it, and the terminal collects the key once. The key sits here only between
  -- approval and pickup, and rows die after ten minutes.
  CREATE TABLE IF NOT EXISTS cli_logins (
    code TEXT PRIMARY KEY,
    host TEXT,
    user_id TEXT,
    key_id TEXT,
    key_value TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW},
    expires_at INTEGER NOT NULL,   -- unix seconds
    approved_at TEXT,
    claimed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS usage (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    credits INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );

  -- Accounts used to be wallet addresses, in a column called "address". A
  -- database from that time is brought across here: the column is renamed and
  -- the rows keep their old ids until the person signs in again, when
  -- users.ts moves them under their Privy id. Tables that only served on-chain
  -- earning (claimed_txs, pending_claims, referrals, topups, …) are left
  -- alone; drop them by hand once the data is no longer wanted.
  DO $$
  DECLARE t TEXT;
  BEGIN
    FOREACH t IN ARRAY ARRAY['ledger', 'api_keys', 'sessions', 'conversations', 'creations', 'cli_logins', 'usage'] LOOP
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'address') THEN
        EXECUTE format('ALTER TABLE %I RENAME COLUMN address TO user_id', t);
      END IF;
    END LOOP;
    ALTER INDEX IF EXISTS ledger_address RENAME TO ledger_user;
    ALTER INDEX IF EXISTS api_keys_address RENAME TO api_keys_user;
    ALTER INDEX IF EXISTS sessions_address RENAME TO sessions_user;
    ALTER INDEX IF EXISTS conversations_address RENAME TO conversations_user;
    ALTER INDEX IF EXISTS creations_address RENAME TO creations_user;
    ALTER INDEX IF EXISTS usage_address RENAME TO usage_user;
  END $$;

  CREATE INDEX IF NOT EXISTS ledger_user ON ledger (user_id, id);
  CREATE INDEX IF NOT EXISTS api_keys_user ON api_keys (user_id);
  CREATE INDEX IF NOT EXISTS purchases_user ON purchases (user_id, created_at);
  CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);
  CREATE INDEX IF NOT EXISTS conversations_user ON conversations (user_id, updated_at);
  CREATE INDEX IF NOT EXISTS creations_user ON creations (user_id, created_at);
  CREATE INDEX IF NOT EXISTS usage_user ON usage (user_id, id);
`;

export type Row = Record<string, unknown>;
export type QueryResult<T> = { rows: T[]; rowCount: number };

// Runs one statement. Parameters are written as `?` and bound in order.
export interface Sql {
  query<T = Row>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

// What a database has to provide: shared queries, one dedicated connection
// per transaction, and a way to run the schema (several statements at once).
export interface Backend extends Sql {
  exec(text: string): Promise<void>;
  transaction<T>(work: (tx: Sql) => Promise<T>): Promise<T>;
}

// `?` placeholders become Postgres's $1, $2, ... so the statements read plainly.
export const numbered = (text: string) => {
  let n = 0;
  return text.replace(/\?/g, () => `$${++n}`);
};

const holder = globalThis as { kreditBackend?: Backend; kreditReady?: Promise<void> };
// The transaction the current call is part of, if any.
const current = new AsyncLocalStorage<Sql>();

// Tests plug in an embedded Postgres here; the server uses DATABASE_URL.
export function configureDb(backend: Backend) {
  holder.kreditBackend = backend;
  holder.kreditReady = undefined;
}

function backend(): Backend {
  if (!holder.kreditBackend) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Copy your Neon connection string into .env.local.");
    holder.kreditBackend = postgres(url);
  }
  return holder.kreditBackend;
}

// The tables exist before the first query runs; once per process.
function ready() {
  if (!holder.kreditReady) {
    holder.kreditReady = backend()
      .exec(SCHEMA)
      .catch((error) => {
        holder.kreditReady = undefined; // so the next call tries again
        throw error;
      });
  }
  return holder.kreditReady;
}

export function db(): Sql {
  return {
    async query(text, params = []) {
      await ready();
      const client = current.getStore() ?? backend();
      return client.query(numbered(text), params);
    },
  };
}

// The three shapes a statement comes in: every row, the first row, or how many rows it touched.
export const all = async <T = Row>(text: string, params?: unknown[]) => (await db().query<T>(text, params)).rows;
export const one = async <T = Row>(text: string, params?: unknown[]) =>
  (await db().query<T>(text, params)).rows[0] as T | undefined;
export const run = async (text: string, params?: unknown[]) => (await db().query(text, params)).rowCount;

// Runs `work` in one transaction: every db() call inside it goes through the
// same connection, and it is committed only if `work` returns. `lock` names a
// row (a user, say) whose transactions must not overlap: two purchases racing
// each other are then run one after the other, not interleaved.
export async function transaction<T>(work: () => Promise<T>, lock?: string): Promise<T> {
  if (current.getStore()) {
    if (lock) await db().query("SELECT pg_advisory_xact_lock(hashtext(?))", [lock]);
    return work(); // already inside one
  }
  await ready();
  return backend().transaction((tx) =>
    current.run(tx, async () => {
      if (lock) await db().query("SELECT pg_advisory_xact_lock(hashtext(?))", [lock]);
      return work();
    }),
  );
}

// --- Postgres over the network (Neon) ------------------------------------------

function postgres(url: string): Backend {
  // Neon's URL says sslmode=require; pg treats that as full verification anyway,
  // and saying so keeps it that way (and quiet) in the next pg release.
  const connectionString = url.replace(/sslmode=(prefer|require|verify-ca)\b/, "sslmode=verify-full");
  const pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000 });
  const wrap = (client: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }> }): Sql => ({
    async query<T>(text: string, params: unknown[] = []) {
      const result = await client.query(text, params);
      return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
    },
  });
  return {
    ...wrap(pool),
    async exec(text) {
      await pool.query(text);
    },
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await work(wrap(client));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
