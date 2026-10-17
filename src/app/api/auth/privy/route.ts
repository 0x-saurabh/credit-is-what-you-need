import { createRemoteJWKSet, jwtVerify } from "jose";
import { createSession } from "@/lib/session";
import { adoptLegacyAccounts, touchUser } from "@/lib/users";

// Turns a Privy login into a Kredit session.
//
// The browser sends Privy's access token. The token is checked against Privy's
// public keys for this app; its subject is Privy's user id, and that id is the
// account. The user is then fetched from Privy with the app secret for their
// email and name, which the dashboard shows.

const fail = (error: string, status = 400) => Response.json({ error }, { status });

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;

// Privy publishes each app's verification key as a JWK set; jose caches it.
const jwks = appId ? createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`)) : null;

type LinkedAccount = {
  type: string;
  address?: string; // for "email" this is the email address; for wallets, the wallet
  email?: string;
  name?: string;
  chain_type?: string;
};

async function profileOf(userId: string) {
  const response = await fetch(`https://api.privy.io/v1/users/${encodeURIComponent(userId)}`, {
    headers: {
      authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`,
      "privy-app-id": appId!,
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Privy user lookup failed (${response.status})`);
  const user = (await response.json()) as { linked_accounts?: LinkedAccount[] };
  const accounts = user.linked_accounts ?? [];
  const email = accounts.find((account) => account.type === "email")?.address ?? accounts.find((account) => account.email)?.email ?? null;
  const name = accounts.find((account) => account.name)?.name ?? null;
  // Wallets Privy still lists for people who signed up when accounts were
  // wallet addresses. Only used to carry their old rows across; see users.ts.
  const legacyWallets = accounts
    .filter((account) => account.type === "wallet" && account.chain_type === "ethereum" && account.address)
    .map((account) => account.address!);
  return { email, name, legacyWallets };
}

export async function POST(request: Request) {
  if (!appId || !appSecret || !jwks) return fail("Sign-in is not configured on this server", 503);

  const body = await request.json().catch(() => null);
  const token: unknown = body?.token;
  if (typeof token !== "string" || !token) return fail("token is required");

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: "privy.io", audience: appId });
    if (!payload.sub) throw new Error("no subject");
    userId = payload.sub;
  } catch {
    return fail("Privy login is invalid or expired", 401);
  }

  let profile: Awaited<ReturnType<typeof profileOf>>;
  try {
    profile = await profileOf(userId);
  } catch {
    return fail("Could not read the account from Privy, please try again", 502);
  }

  const user = await touchUser({ id: userId, email: profile.email, name: profile.name });
  await adoptLegacyAccounts(userId, profile.legacyWallets);
  await createSession(userId);
  return Response.json({ userId: user.id, email: user.email, name: user.name });
}
