import { getBalance, getTotals, listKeys, listLedger, listPurchases } from "@/lib/ledger";
import { getSession } from "@/lib/session";
import { getUser } from "@/lib/users";

// Everything the dashboard shows about the signed-in person, in one call.
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first" }, { status: 401 });
  const user = await getUser(session.userId);
  return Response.json({
    userId: session.userId,
    email: user?.email ?? null,
    name: user?.name ?? null,
    balance: await getBalance(session.userId),
    ...(await getTotals(session.userId)),
    keys: await listKeys(session.userId),
    activity: await listLedger(session.userId),
    purchases: await listPurchases(session.userId),
  });
}
