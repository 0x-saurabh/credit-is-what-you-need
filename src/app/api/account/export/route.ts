import { listKeys, listLedger, listPurchases, listUsage } from "@/lib/ledger";
import { getSession } from "@/lib/session";
import { getUser } from "@/lib/users";
import { listConversations, listCreations } from "@/lib/workspace";

// Everything Kredit holds about this person, as one JSON file: the profile,
// the ledger, every purchase, every call they paid for, their keys (names and
// prefixes, never the keys), and what the workspace keeps. Prompts sent
// through the API are not here because they were never stored.
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first" }, { status: 401 });
  const { userId } = session;
  const usage: unknown[] = [];
  for (let before: number | null = null; ; ) {
    const page = await listUsage(userId, { limit: 500, before: before ?? undefined });
    usage.push(...page.rows);
    if (!page.next || usage.length >= 20_000) break;
    before = page.next;
  }
  const body = {
    exported_at: new Date().toISOString(),
    user: await getUser(userId),
    ledger: await listLedger(userId, 100_000),
    purchases: await listPurchases(userId, 10_000),
    usage,
    keys: await listKeys(userId),
    workspace: {
      conversations: await listConversations(userId),
      creations: await listCreations(userId, { withFiles: false }), // metadata only; the bytes stay in the library
    },
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="kredit-export.json"`,
    },
  });
}
