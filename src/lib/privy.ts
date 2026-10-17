import type { PrivyClientConfig } from "@privy-io/react-auth";

// The Privy app that signs people in. Public: it is baked into the browser
// bundle. The matching secret (PRIVY_APP_SECRET) stays on the server.
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

// One dialog for everyone: an email code or Google. Privy's user id is the
// Kredit account; no wallet is made or asked for.
export const privyConfig: PrivyClientConfig = {
  loginMethods: ["email", "google"],
  appearance: {
    theme: "light",
    accentColor: "#c2410c",
  },
  embeddedWallets: {
    ethereum: { createOnLogin: "off" },
    solana: { createOnLogin: "off" },
  },
};
