"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export const SESSION_KEY = ["session"];

export type Session = { userId: string | null; email: string | null; name: string | null };

export const SIGNED_OUT: Session = { userId: null, email: null, name: null };

export async function post(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

const fetchSession = async () => (await (await fetch("/api/auth/me")).json()) as Session;

// The Kredit session is a cookie the server issues once Privy has vouched for
// the person. Privy handles who they are; this hook handles whether the server
// currently has a session for them.
export function useSession() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const privy = usePrivy();

  const session = useQuery({ queryKey: SESSION_KEY, queryFn: fetchSession });

  // Signing out ends both halves: the server session and the Privy login, so
  // the next visit starts from the sign-in dialog again.
  const signOut = useMutation({
    mutationFn: async () => {
      await post("/api/auth/logout");
      await privy.logout().catch(() => {});
    },
    onSuccess: () => {
      queryClient.setQueryData(SESSION_KEY, SIGNED_OUT);
      router.push("/");
      router.refresh();
    },
  });

  return {
    userId: session.data?.userId ?? null,
    email: session.data?.email ?? null,
    name: session.data?.name ?? null,
    isLoading: session.isLoading,
    signOut,
  };
}
