import { rupeesFor } from "./pricing.ts";

export const formatCredits = (credits: number) =>
  new Intl.NumberFormat("en-US").format(credits);

// Rupees, Indian style: ₹85, ₹1,275.50, ₹0.09.
export const formatRupees = (rupees: number, decimals = rupees >= 100 || Number.isInteger(rupees) ? 0 : 2) =>
  `₹${new Intl.NumberFormat("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: Math.max(decimals, 2) }).format(rupees)}`;

// What a number of credits buys, in rupees: "₹85" for 1,000 credits.
export const creditsInRupees = (credits: number) => formatRupees(rupeesFor(credits));

// What to call a person in a corner of the screen: their name, else the part
// of their email before the @, else a stub of their id.
export function displayName(user: { name?: string | null; email?: string | null; userId?: string | null }) {
  if (user.name?.trim()) return user.name.trim();
  if (user.email) return user.email.split("@")[0];
  return user.userId ? `user ${user.userId.slice(-6)}` : "Signed in";
}

// 80000 paise -> "₹800.00"; 1000 cents -> "$10.00". Zero-decimal currencies are not used here.
export function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
