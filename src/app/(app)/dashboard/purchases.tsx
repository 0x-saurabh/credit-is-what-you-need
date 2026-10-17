"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CoinsIcon } from "@/components/icons";
import { formatCredits, formatMoney } from "@/lib/format";
import { CREDITS_PER_USD } from "@/lib/pricing";
import { ACCOUNT_KEY, api, useKreditAccount } from "@/lib/use-kredit-account";
import { when } from "./activity-table";

const providerLabel: Record<string, string> = { razorpay: "Razorpay", dodo: "Dodo Payments", manual: "Kredit" };

type Pack = { credits: number; productId: string; amount: number; currency: string };
type Config = { providers: string[]; packs: Pack[]; error?: string };

// Dodo sends the person back here with ?paid=1&payment_id=…&status=…. That is
// a hint, not proof: the page waits for the webhook to land the purchase.
function returnedPayment(search: string) {
  const params = new URLSearchParams(search);
  if (params.get("paid") !== "1") return null;
  return { paymentId: params.get("payment_id"), status: params.get("status") };
}

// The query string, read the same way on the server (empty) and in the browser.
const noop = () => () => {};
const useSearch = () => useSyncExternalStore(noop, () => window.location.search, () => "");

// Buying credits: the packs Dodo sells, each a button that opens Dodo's hosted
// checkout. Until a provider is connected the card says so plainly.
export function BuyCredits() {
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: ["payments-config"], queryFn: () => api<Config>("/api/payments/config"), staleTime: 300_000, retry: 1 });
  const account = useKreditAccount();
  const search = useSearch();
  const returned = useMemo(() => returnedPayment(search), [search]);
  const [waitedMs, setWaitedMs] = useState(0);

  // While a payment is on its way, ask for the account every two seconds for
  // up to a minute. The webhook usually lands within a few seconds.
  const landed = Boolean(returned?.paymentId && account.data?.purchases.some((purchase) => purchase.id === `dodo:${returned.paymentId}`));
  useEffect(() => {
    if (!returned || landed || returned.status === "failed" || waitedMs >= 60_000) return;
    const timer = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ACCOUNT_KEY });
      setWaitedMs((ms) => ms + 2000);
    }, 2000);
    return () => clearTimeout(timer);
  }, [returned, landed, waitedMs, queryClient]);

  const checkout = useMutation({
    mutationFn: (credits: number) => api<{ url: string }>("/api/payments/checkout", { method: "POST", body: JSON.stringify({ credits }) }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  const open = (config.data?.providers.length ?? 0) > 0;
  const packs = config.data?.packs ?? [];

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Buy credits</h2>
        <span className="chip">
          <span className={`size-1.5 rounded-full ${open ? "bg-accent" : "bg-mist"} breathe`} />
          {config.isLoading ? "Checking" : open ? "Open now" : "Opening soon"}
        </span>
      </div>
      <p className="mt-1 text-sm text-mist">
        Pay by card, UPI or your local method and the credits land in your balance the moment the payment is confirmed.{" "}
        {formatCredits(CREDITS_PER_USD)} credits buy $1 of AI usage. Credits do not expire.
      </p>

      {returned && (
        <p role="status" className={`mt-4 rounded-lg px-4 py-3 text-sm ${landed ? "border border-accent/40 bg-accent/5 text-fog" : returned.status === "failed" ? "bg-danger/10 text-danger" : "border border-line bg-raised text-mist"}`}>
          {landed
            ? "Paid. The credits are in your balance and the purchase is listed below."
            : returned.status === "failed"
              ? "The payment did not go through. Nothing was charged; try again when you are ready."
              : waitedMs >= 60_000
                ? "The payment is taking longer than usual to confirm. The credits will appear here as soon as it does; you can leave this page."
                : "Payment received. Waiting for the provider to confirm it…"}
        </p>
      )}

      {open && packs.length > 0 && (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {packs.map((pack) => (
            <li key={pack.productId}>
              <button
                type="button"
                disabled={checkout.isPending}
                onClick={() => checkout.mutate(pack.credits)}
                className="card-lift flex w-full items-center justify-between gap-4 rounded-xl border border-line bg-raised p-4 text-left transition hover:border-accent disabled:opacity-60"
              >
                <span>
                  <span className="block font-mono text-xl font-semibold text-fog">{formatCredits(pack.credits)}</span>
                  <span className="block text-xs text-mist">credits · ${(pack.credits / CREDITS_PER_USD).toFixed(2)} of AI usage</span>
                </span>
                <span className="font-mono text-base text-accent">{formatMoney(pack.amount, pack.currency)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && packs.length === 0 && !config.isLoading && (
        <p className="empty mt-4">No packs are on sale right now. Try again in a moment.</p>
      )}
      {!open && !config.isLoading && (
        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-xl border border-line bg-raised p-5 font-mono">
          <div>
            <p className="text-2xl font-semibold text-fog sm:text-3xl">$</p>
            <p className="mt-1 text-xs text-mist">card · UPI · local methods</p>
          </div>
          <CoinsIcon className="size-5 text-accent" />
          <div className="text-right">
            <p className="text-2xl font-semibold text-accent sm:text-3xl">credits</p>
            <p className="mt-1 text-xs text-mist">price set at launch</p>
          </div>
        </div>
      )}
      {(checkout.error || config.data?.error) && (
        <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-4 py-2 text-sm text-danger">
          {checkout.error?.message ?? config.data?.error}
        </p>
      )}
      <p className="mt-4 text-xs leading-relaxed text-mist">
        Payments are taken by Dodo Payments, the merchant of record; Kredit never sees your card. Taxes, where they
        apply, are shown at checkout. The receipt comes from Dodo by email.
      </p>
    </section>
  );
}

// Every payment that bought credits, newest first.
export function PurchaseHistory() {
  const { data } = useKreditAccount();
  const rows = data?.purchases;

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">Purchases</h2>
      <p className="mt-1 text-sm text-mist">Each payment, what it cost and the credits it bought.</p>
      {rows && rows.length === 0 && <p className="empty mt-4">No purchases yet.</p>}
      {rows && rows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="grid-table sm:min-w-[30rem]">
            <thead>
              <tr>
                <th>When</th>
                <th>Paid</th>
                <th>Through</th>
                <th className="num">Credits</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((purchase) => (
                <tr key={purchase.id}>
                  <td className="whitespace-nowrap text-mist" title={new Date(purchase.createdAt).toLocaleString()} suppressHydrationWarning>
                    {when(purchase.createdAt)}
                  </td>
                  <td className="font-mono">{formatMoney(purchase.amount, purchase.currency)}</td>
                  <td className="text-mist">{providerLabel[purchase.provider] ?? purchase.provider}</td>
                  <td className="num">+{formatCredits(purchase.credits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!rows && <span className="skeleton mt-4 block h-4 w-full" aria-hidden />}
    </section>
  );
}
