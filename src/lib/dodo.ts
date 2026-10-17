import DodoPayments from "dodopayments";
import type { Payment } from "dodopayments/resources/payments";
import type { ProductListResponse } from "dodopayments/resources/products/products";
import { SITE_URL } from "./site.ts";

// Dodo Payments, the merchant of record that takes card and UPI payments for
// credits. Products live in Dodo (one per pack of credits, made by
// scripts/dodo-products.mjs); each carries the number of credits it buys in its
// metadata, so the price is read from Dodo and never duplicated here.

export const PACK_METADATA_KEY = "kredit_credits";

// A missing or misspelled value must never resolve to live mode.
export const dodoEnvironment = (): "test_mode" | "live_mode" => (process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode");

// Buying through Dodo is on once the server can both talk to Dodo and check its webhooks.
export const dodoOn = () => Boolean(process.env.DODO_PAYMENTS_API_KEY && process.env.DODO_PAYMENTS_WEBHOOK_KEY);

const holder = globalThis as { kreditDodo?: DodoPayments; kreditPacks?: { at: number; packs: Pack[] } };

export function dodoClient() {
  if (!holder.kreditDodo) {
    holder.kreditDodo = new DodoPayments({
      bearerToken: process.env.DODO_PAYMENTS_API_KEY,
      webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? null,
      environment: dodoEnvironment(),
    });
  }
  return holder.kreditDodo;
}

export type Pack = { credits: number; productId: string; amount: number; currency: string };

type PackProduct = Pick<ProductListResponse, "product_id" | "metadata" | "is_recurring" | "price" | "currency">;

// The packs for sale, from Dodo's product list: one-time products that say how
// many credits they buy. Cheapest first. Pure, so the rule is easy to test.
export function packsFrom(products: PackProduct[]): Pack[] {
  const packs: Pack[] = [];
  for (const product of products) {
    const credits = Number(product.metadata?.[PACK_METADATA_KEY]);
    if (!Number.isInteger(credits) || credits <= 0) continue;
    if (product.is_recurring || typeof product.price !== "number" || !product.currency) continue;
    packs.push({ credits, productId: product.product_id, amount: product.price, currency: product.currency });
  }
  return packs.sort((a, b) => a.credits - b.credits);
}

const PACKS_TTL_MS = 5 * 60_000;

export async function listPacks(): Promise<Pack[]> {
  if (!dodoOn()) return [];
  const cached = holder.kreditPacks;
  if (cached && Date.now() - cached.at < PACKS_TTL_MS) return cached.packs;
  const products: ProductListResponse[] = [];
  for await (const product of dodoClient().products.list({ page_size: 100 })) products.push(product);
  const packs = packsFrom(products);
  holder.kreditPacks = { at: Date.now(), packs };
  return packs;
}

// Where Dodo sends the person after paying. Dodo adds payment_id and status;
// the page only uses them to wait for the webhook, never to grant credits.
export const RETURN_URL = `${SITE_URL}/dashboard/credits?paid=1`;

export async function createCheckout(user: { id: string; email: string | null; name: string | null }, pack: Pack) {
  const session = await dodoClient().checkoutSessions.create({
    product_cart: [{ product_id: pack.productId, quantity: 1 }],
    customer: user.email ? { email: user.email, name: user.name ?? undefined } : undefined,
    // The webhook reads these back. The user id is the account to credit.
    metadata: { user_id: user.id, [PACK_METADATA_KEY]: pack.credits },
    return_url: RETURN_URL,
    feature_flags: { allow_currency_selection: true },
  });
  if (!session.checkout_url) throw new Error("Dodo returned no checkout URL");
  return { sessionId: session.session_id, url: session.checkout_url };
}

export type PurchaseFromPayment = { userId: string; credits: number; paymentId: string; amount: number; currency: string };

// What a succeeded payment buys, or why it buys nothing. The credits come from
// the pack the payment's product belongs to, not from anything the browser
// sent; the metadata only has to agree with it.
export function purchaseFromPayment(payment: Payment, packs: Pack[]): { ok: true; purchase: PurchaseFromPayment } | { ok: false; reason: string } {
  if (payment.status && payment.status !== "succeeded") return { ok: false, reason: `payment status is ${payment.status}` };
  const userId = payment.metadata?.user_id;
  if (typeof userId !== "string" || !userId) return { ok: false, reason: "no user_id in metadata" };
  const productId = payment.product_cart?.[0]?.product_id;
  const pack = packs.find((candidate) => candidate.productId === productId);
  if (!pack) return { ok: false, reason: `product ${productId ?? "(none)"} is not a credit pack` };
  const quantity = payment.product_cart?.[0]?.quantity ?? 1;
  const credits = pack.credits * quantity;
  const claimed = Number(payment.metadata?.[PACK_METADATA_KEY]);
  if (Number.isInteger(claimed) && claimed !== pack.credits) return { ok: false, reason: `metadata says ${claimed} credits, product says ${pack.credits}` };
  return {
    ok: true,
    purchase: { userId, credits, paymentId: payment.payment_id, amount: payment.total_amount, currency: payment.currency },
  };
}
