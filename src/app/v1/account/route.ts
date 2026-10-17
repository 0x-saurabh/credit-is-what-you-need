import { heldFor } from "@/lib/budget";
import { authenticate, preflight, RATE_LIMIT, v1 } from "@/lib/gateway";
import { getBalance, getTotals } from "@/lib/ledger";
import { CREDITS_PER_USD } from "@/lib/pricing";
import { getUser } from "@/lib/users";

// The account behind a key, for apps that want to show a balance. Never the
// account's other keys: a key sees only what it needs to spend.
export const GET = v1(async (request) => {
  const caller = await authenticate(request);
  if (caller instanceof Response) return caller;

  const balance = await getBalance(caller.userId);
  const held = heldFor(caller.userId);
  const user = await getUser(caller.userId);
  return Response.json({
    object: "account",
    user_id: caller.userId,
    email: user?.email ?? null,
    key: { name: caller.keyName, prefix: caller.keyPrefix },
    balance,
    held, // promised to calls still running
    available: Math.max(0, balance - held),
    usd_value: balance / CREDITS_PER_USD,
    total_spent: (await getTotals(caller.userId)).spent,
    rate_limit: { requests_per_minute: RATE_LIMIT },
  });
});

export const OPTIONS = preflight;
