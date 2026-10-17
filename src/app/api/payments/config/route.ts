import { dodoOn, listPacks } from "@/lib/dodo";

// What the buy-credits card needs: which providers are on and what the packs
// cost. Public; prices are not secrets. An empty `providers` means buying is
// not open on this server yet.
export async function GET() {
  const providers = dodoOn() ? ["dodo"] : [];
  let packs: Awaited<ReturnType<typeof listPacks>> = [];
  if (providers.length > 0) {
    try {
      packs = await listPacks();
    } catch {
      // Dodo unreachable: the card says so instead of showing stale prices.
      return Response.json({ providers, packs: [], error: "The payment provider could not be reached. Try again in a moment." }, { status: 503 });
    }
  }
  return Response.json({ providers, packs });
}
