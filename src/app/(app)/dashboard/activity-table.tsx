"use client";

import Link from "next/link";
import { formatCredits } from "@/lib/format";
import { useKreditAccount } from "@/lib/use-kredit-account";

const kindLabel: Record<string, string> = {
  purchase: "Bought",
  grant: "Added",
  spend: "Spent",
  // Earlier programmes; old rows keep their label.
  claim: "Tasks",
  milestone: "Milestone",
  streak: "Streak",
  referral: "Referral",
  gasback: "Gas-Back",
  royalty: "Royalties",
  topup: "Bought",
};

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const WEEK = 7 * 86_400;

// "2 minutes ago" while it is recent, a plain date once it is not.
export function when(iso: string) {
  const date = new Date(iso);
  const seconds = (date.getTime() - Date.now()) / 1000;
  if (Math.abs(seconds) > WEEK) return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  for (const [unit, size] of [["day", 86_400], ["hour", 3_600], ["minute", 60]] as const) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

// Every credit that came in or went out, newest first.
export function ActivityTable({ limit }: { limit?: number }) {
  const { data, isError } = useKreditAccount();
  const rows = data?.activity.slice(0, limit);

  if (isError) {
    return (
      <p className="empty">
        <strong>Activity could not be loaded.</strong> Refresh the page to try again.
      </p>
    );
  }
  if (rows?.length === 0) {
    return (
      <div className="empty">
        <strong>No activity yet.</strong>
        Credits you buy and spend will be listed here.
        <div className="mt-4">
          <Link href="/dashboard/credits" className="btn-sm btn-sm-primary">
            Buy credits
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="grid-table sm:min-w-[32rem]">
        <thead>
          <tr>
            <th>Type</th>
            <th>Detail</th>
            <th>When</th>
            <th className="num">Credits</th>
          </tr>
        </thead>
        <tbody>
          {rows
            ? rows.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <span className="chip">{kindLabel[entry.kind] ?? entry.kind}</span>
                  </td>
                  <td className="max-w-36 truncate text-mist sm:max-w-64">{entry.memo}</td>
                  <td className="whitespace-nowrap text-mist" title={new Date(entry.createdAt).toLocaleString()} suppressHydrationWarning>
                    {when(entry.createdAt)}
                  </td>
                  <td className={`num ${entry.amount > 0 ? "text-fog" : "text-mist"}`}>
                    {entry.amount > 0 ? "+" : "−"}
                    {formatCredits(Math.abs(entry.amount))}
                  </td>
                </tr>
              ))
            : Array.from({ length: limit ?? 6 }, (_, index) => (
                <tr key={index}>
                  <td colSpan={4}>
                    <span className="skeleton h-4 w-full" aria-hidden />
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
