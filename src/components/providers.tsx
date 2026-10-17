"use client";

import { PrivyProvider, useLogin, usePrivy } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PRIVY_APP_ID, privyConfig } from "@/lib/privy";
import { post, SESSION_KEY, SIGNED_OUT, useSession, type Session } from "@/lib/use-session";

// Keeps the server session in step with the Privy login.
//
// Privy says who the person is; the server only trusts that once it has seen
// Privy's access token, so after a login (or on a return visit whose cookie
// has expired) the token goes to /api/auth/privy, which answers with the
// session cookie. Signing out of Kredit also signs out of Privy, and a Privy
// logout elsewhere ends the Kredit session here.
function SessionBridge({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const privy = usePrivy();
  const session = useSession();
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const fresh = useRef(false);

  // A login that just happened leads to the dashboard, unless the person was
  // signing in to keep using the page they are on.
  useLogin({
    onComplete: ({ wasAlreadyAuthenticated }) => {
      if (!wasAlreadyAuthenticated) fresh.current = true;
    },
  });

  useEffect(() => {
    if (!privy.ready || session.isLoading || busy.current) return;

    if (privy.authenticated && !session.userId) {
      busy.current = true;
      (async () => {
        const token = await privy.getAccessToken();
        if (!token) throw new Error("Privy gave no access token");
        const data = (await post("/api/auth/privy", { token })) as Session;
        queryClient.setQueryData(SESSION_KEY, data);
        queryClient.invalidateQueries({ queryKey: ["account"] });
        setError(null);
        if (fresh.current) {
          fresh.current = false;
          const { pathname } = window.location;
          const staysHere = pathname === "/playground" || pathname === "/docs" || pathname.startsWith("/docs/") || pathname.startsWith("/cli/");
          if (!staysHere) router.push("/dashboard");
        }
      })()
        .catch((caught: Error) => setError(caught.message))
        .finally(() => {
          busy.current = false;
        });
      return;
    }

    if (!privy.authenticated && session.userId) {
      // Privy was signed out (another tab, or the login expired): end the
      // server session too, so the two never disagree about who this is.
      busy.current = true;
      post("/api/auth/logout")
        .then(() => queryClient.setQueryData(SESSION_KEY, SIGNED_OUT))
        .catch(() => {})
        .finally(() => {
          busy.current = false;
        });
    }
  }, [privy, privy.ready, privy.authenticated, session.userId, session.isLoading, queryClient, router]);

  return (
    <>
      {error && (
        <p role="alert" className="fixed inset-x-0 top-16 z-50 mx-auto w-fit rounded-full border border-line bg-surface px-4 py-2 text-sm text-fog shadow">
          Sign-in did not finish: {error}
        </p>
      )}
      {children}
    </>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // Without an app id (a build or a dev server with no NEXT_PUBLIC_PRIVY_APP_ID)
  // the site still renders; only signing in is off. Privy's hooks answer with
  // "not ready" outside its provider, and the sign-in button says so.
  if (!PRIVY_APP_ID) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return (
    <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
      <QueryClientProvider client={queryClient}>
        <SessionBridge>{children}</SessionBridge>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
