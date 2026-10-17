import { createCheckout, dodoOn, listPacks } from "@/lib/dodo";
import { rateLimited } from "@/lib/gateway";
import { getSession } from "@/lib/session";
import { getUser } from "@/lib/users";

// Starts a purchase: { credits } in, { url } out. The browser goes to the URL
// (Dodo's hosted checkout) and comes back to the Credits page. Nothing is
// credited here; the webhook does that once Dodo confirms the payment.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first" }, { status: 401 });
  if (!dodoOn()) return Response.json({ error: "Buying credits is not open on this server yet." }, { status: 503 });
  if (rateLimited(`checkout:${session.userId}`, undefined, 10)) return Response.json({ error: "Too many checkout attempts. Wait a minute." }, { status: 429 });

  const body = (await request.json().catch(() => null)) as { credits?: unknown } | null;
  const credits = typeof body?.credits === "number" ? body.credits : Number(body?.credits);
  // The browser names a pack by its size, never a product id or a price.
  const pack = (await listPacks()).find((candidate) => candidate.credits === credits);
  if (!pack) return Response.json({ error: "That pack is not for sale. Pick one of the packs shown." }, { status: 400 });

  const user = await getUser(session.userId);
  try {
    const checkout = await createCheckout({ id: session.userId, email: user?.email ?? null, name: user?.name ?? null }, pack);
    return Response.json(checkout);
  } catch (error) {
    console.error("Dodo checkout failed", error);
    return Response.json({ error: "The payment provider could not start a checkout. Try again in a moment." }, { status: 502 });
  }
}
