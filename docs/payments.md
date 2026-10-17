# Payments: how a card or UPI payment becomes credits

**Status (18 Oct 2026):** Dodo Payments is wired in and working in test mode: `src/lib/dodo.ts`,
`/api/payments/config`, `/api/payments/checkout`, `/api/payments/dodo/webhook`, the Buy card on
`/dashboard/credits`, and `scripts/dodo-products.mjs` (four packs made in test mode). Razorpay is
not built; its section below is the plan. To go live: make live-mode API key, run the products
script with `DODO_PAYMENTS_ENVIRONMENT=live_mode`, register the live webhook, set the three
`DODO_PAYMENTS_*` variables on Render.

This is the plan for taking money without crypto. It covers what is already in the
code after the crypto removal, what still has to be built, and the one thing that
cannot be done the way it was first imagined: paying the Vercel AI Gateway bill
directly from a customer's payment.

## The shape of the money

```
customer ──Razorpay / Dodo checkout──▶ payment provider ──webhook──▶ Kredit server
                                                                         │
                                                        purchases row + ledger row (credits)
                                                                         │
customer ──API key / playground──▶ Kredit /v1 ──────▶ Vercel AI Gateway ──▶ model maker
                                      │                      │
                              ledger row (−credits)    gateway bills Kredit's team
                                                       from its prepaid balance
```

Two separate balances exist and must stay separate:

| Balance | Who owns it | What moves it |
| --- | --- | --- |
| A customer's credits | The customer | Up: a purchase webhook. Down: each call, at the provider's price plus margin. |
| The AI Gateway balance | Kredit (the Vercel team) | Up: Kredit tops it up with a card on Vercel. Down: every call Kredit forwards, at the provider's price. |

Money flows customer → payment provider → Kredit's bank account, and separately
Kredit → Vercel. The customer's payment never touches the gateway, and cannot.

### Why a payment cannot be "added to the Vercel AI Gateway account"

The AI Gateway has no API for adding funds. Its REST API (`https://ai-gateway.vercel.sh/v1`)
exposes exactly these billing endpoints:

- `GET /v1/credits` reads the team's balance and lifetime spend: `{ "balance": "95.50", "total_used": "4.50" }` (USD, as strings).
- `GET /v1/generation?id=…` reads the cost of one call.
- `GET /v1/report` reads aggregated spend, groupable by `user`, `model`, `tag`, `api_key_name`.

Credits are bought in the Vercel dashboard with a card, or through Vercel's
auto-recharge. There is no "charge this payment to my gateway" call, and the gateway
has no notion of per-customer sub-balances or per-customer top-ups. So the design is:

1. **Customers prepay Kredit** through Razorpay or Dodo Payments. The webhook writes credits to the ledger.
2. **Kredit prepays Vercel.** Turn on auto-recharge in the Vercel dashboard so the gateway balance never runs dry; set the recharge amount from what customers are buying.
3. **Kredit watches both.** An admin page polls `GET /v1/credits` and shows the gateway balance next to the sum of all customers' outstanding credits. Outstanding credits in USD must stay below gateway balance plus what the next recharge covers.
4. **Per-customer gateway spend is attributable.** Send `x-kredit-user` (already in the CORS allow-list) through to the gateway as its `user` field on each request, and `GET /v1/report?group_by=user` reconciles what each customer cost Kredit against what they were charged.

## What exists in the code now

- `purchases` table (`src/lib/db.ts`): `id = "<provider>:<payment id>"`, `user_id`, `provider`, `amount` (smallest unit), `currency`, `credits`. The primary key is what makes a payment pay once.
- `recordPurchase()` (`src/lib/ledger.ts`): inserts the purchase row and the ledger row in one transaction, locked per user. Throws `PurchaseUsedError` on a repeat.
- `listPurchases()` and the `purchases` array on `GET /api/account`, shown as the purchase history on `/dashboard/credits` and included in the account export.
- `grantCredits()` for manual credits: welcome bonuses, refunds, corrections.
- Env vars reserved in `.env.example`: `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_ENVIRONMENT`, `CREDITS_PRICE_INR_PER_1000`, `CREDITS_PRICE_USD_PER_1000`.

The "Buy credits" card on `/dashboard/credits` is a placeholder that says payments are
being set up. Everything below replaces that card with a working checkout.

## Which provider

| | Razorpay | Dodo Payments |
| --- | --- | --- |
| Who it is for | An Indian business entity (needs PAN, bank account, KYC). | Anyone selling globally; Dodo is the **merchant of record**, so it files the sales tax / VAT / GST and handles chargebacks. |
| Methods | UPI, cards, net banking, wallets, EMI. International cards need enabling. | Cards, UPI for Indian buyers, Apple/Google Pay, local methods in 150+ countries. |
| Settlement currency | INR | Your choice (USD, INR, …), paid out to your bank. |
| Fees | ~2% domestic; international and some methods more. | Higher (MoR pricing, ~4% + fixed), but tax compliance is included. |
| Node SDK | `razorpay` | `dodopayments` |
| Webhook check | HMAC-SHA256 of the raw body with the webhook secret, header `X-Razorpay-Signature`. Helper: `validateWebhookSignature` from `razorpay/dist/utils/razorpay-utils`. | Standard Webhooks: headers `webhook-id`, `webhook-signature`, `webhook-timestamp`. Helper: `client.webhooks.unwrap(rawBody, { headers })`. |
| Success event | `payment.captured` (also `order.paid`) | `payment.succeeded` |
| Dedup key | `payload.payment.entity.id` (`pay_…`), plus `x-razorpay-event-id` | `data.payment_id`, plus `webhook-id` |

Recommendation: **start with Dodo Payments** if most buyers are outside India or you
do not have an Indian company yet; it removes the tax-compliance work and still takes
UPI from Indian buyers. **Add Razorpay** when Indian volume justifies lower fees. The
code below is written so both can run side by side; the Credits page shows whichever
is configured.

## What to build

### 1. A price list

`src/lib/payments.ts`:

```ts
export type PaymentProvider = "razorpay" | "dodo";

// What a thousand credits cost, per currency, from the environment.
export function pricePer1000(currency: "INR" | "USD") {
  const raw = currency === "INR" ? process.env.CREDITS_PRICE_INR_PER_1000 : process.env.CREDITS_PRICE_USD_PER_1000;
  const amount = Number(raw);
  if (!Number.isInteger(amount) || amount <= 0) return null; // this currency is not for sale here
  return amount; // smallest unit: paise or cents
}

export const PACKS = [1_000, 5_000, 10_000, 50_000]; // credits a buyer can pick

export function amountFor(credits: number, currency: "INR" | "USD") {
  const unit = pricePer1000(currency);
  return unit === null ? null : Math.round((credits / 1000) * unit);
}

export const providersOn = (): PaymentProvider[] => [
  ...(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET ? ["razorpay" as const] : []),
  ...(process.env.DODO_PAYMENTS_API_KEY && process.env.DODO_PAYMENTS_WEBHOOK_KEY ? ["dodo" as const] : []),
];
```

`GET /api/payments/config` returns `{ providers, packs, prices }` so the Credits page
can render the real price before anyone pays.

### 2. Start a payment (server)

`POST /api/payments/checkout` with `{ provider, credits }`, session required.

**Razorpay:** create an order and hand its id to the browser.

```ts
import Razorpay from "razorpay";
const razorpay = new Razorpay({ key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!, key_secret: process.env.RAZORPAY_KEY_SECRET! });

const order = await razorpay.orders.create({
  amount,                          // paise
  currency: "INR",
  receipt: `kredit-${session.userId.slice(-8)}-${Date.now()}`,
  notes: { user_id: session.userId, credits: String(credits) },   // comes back on the webhook
});
return Response.json({ provider: "razorpay", orderId: order.id, amount, currency: "INR", keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID });
```

**Dodo:** create a checkout session and redirect to its URL.

```ts
import DodoPayments from "dodopayments";
const dodo = new DodoPayments({ bearerToken: process.env.DODO_PAYMENTS_API_KEY!, environment: process.env.DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode" });

const checkout = await dodo.checkoutSessions.create({
  product_cart: [{ product_id: PRODUCT_ID_FOR[credits], quantity: 1 }],   // one Dodo product per pack, made in the Dodo dashboard
  customer: { email: user.email!, name: user.name ?? undefined },
  metadata: { user_id: session.userId, credits: String(credits) },        // comes back on the webhook
  return_url: `${SITE_URL}/dashboard/credits?paid=1`,
});
return Response.json({ provider: "dodo", url: checkout.checkout_url });
```

The `user_id` in `notes` / `metadata` is how the webhook knows whose balance to credit.
Never trust a `user_id` sent by the browser on the webhook path; it must come from the
provider's own record of the order.

### 3. Pay (browser)

Replace `BuyCredits` in `src/app/(app)/dashboard/purchases.tsx`:

- Show the packs with the live price from `/api/payments/config`.
- Razorpay: load `https://checkout.razorpay.com/v1/checkout.js`, call `POST /api/payments/checkout`, open `new Razorpay({ key, order_id, amount, currency, handler })`. In `handler`, do **not** credit anything; just invalidate the account query and show "waiting for confirmation". The webhook does the crediting.
- Dodo: call `POST /api/payments/checkout`, `window.location = url`. On return (`?paid=1`), poll `/api/account` for a few seconds until the purchase appears.

### 4. Webhooks (server): the only place credits are written

Two routes, both reading the **raw body** (never `request.json()` first; signatures are
over the bytes):

`src/app/api/payments/razorpay/webhook/route.ts`

```ts
import { validateWebhookSignature } from "razorpay/dist/utils/razorpay-utils";
import { recordPurchase, PurchaseUsedError } from "@/lib/ledger";

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!validateWebhookSignature(raw, signature, process.env.RAZORPAY_WEBHOOK_SECRET!)) return new Response("bad signature", { status: 400 });

  const event = JSON.parse(raw);
  if (event.event !== "payment.captured") return Response.json({ ok: true }); // acknowledge, ignore

  const payment = event.payload.payment.entity;              // id, amount, currency, notes, order_id, email
  const userId = payment.notes?.user_id;
  const credits = Number(payment.notes?.credits);
  if (!userId || !Number.isInteger(credits)) return new Response("missing notes", { status: 400 });
  // Belt and braces: the amount must match what that many credits cost.
  if (payment.amount !== amountFor(credits, payment.currency)) return new Response("amount mismatch", { status: 400 });

  try {
    await recordPurchase({ provider: "razorpay", paymentId: payment.id, userId, amount: payment.amount, currency: payment.currency, credits });
  } catch (error) {
    if (!(error instanceof PurchaseUsedError)) throw error; // a repeat delivery is fine
  }
  return Response.json({ ok: true });
}
```

`src/app/api/payments/dodo/webhook/route.ts`

```ts
const dodo = new DodoPayments({ bearerToken: process.env.DODO_PAYMENTS_API_KEY!, webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY! });

export async function POST(request: Request) {
  const raw = await request.text();
  const headers = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
  };
  let event;
  try {
    event = dodo.webhooks.unwrap(raw, { headers });            // throws on a bad signature
  } catch {
    return new Response("bad signature", { status: 400 });
  }
  if (event.type !== "payment.succeeded") return Response.json({ ok: true });

  const payment = event.data;                                   // payment_id, total_amount, currency, metadata
  const userId = payment.metadata?.user_id;
  const credits = Number(payment.metadata?.credits);
  if (!userId || !Number.isInteger(credits)) return new Response("missing metadata", { status: 400 });

  try {
    await recordPurchase({ provider: "dodo", paymentId: payment.payment_id, userId, amount: payment.total_amount, currency: payment.currency, credits });
  } catch (error) {
    if (!(error instanceof PurchaseUsedError)) throw error;
  }
  return Response.json({ ok: true });
}
```

Register the URLs in each dashboard: `https://usekredit.space/api/payments/razorpay/webhook`
(events: `payment.captured`) and `https://usekredit.space/api/payments/dodo/webhook`
(events: `payment.succeeded`, and `refund.succeeded` if you want refunds to pull credits
back with `grantCredits(userId, -credits, "Refund …")`).

Both routes must be excluded from any CSRF or session middleware, and Next must not
parse the body for them (route handlers don't by default; `request.text()` is the raw body).

### 5. Show it on the profile

Already done for the history: `/dashboard/credits` lists every purchase (when, paid,
through, credits) from the `purchases` array on `/api/account`, and the activity table
shows each as a **Bought** row. The export under Settings includes them. What to add
once payments are live: a "waiting for confirmation" state after checkout, and the
provider's receipt link if the webhook carries one (Razorpay: none; Dodo: `payment_link`
or the invoice email).

### 6. The gateway side

- **Auto-recharge** on the Vercel team so the gateway never refuses a call. Pick the threshold from daily spend; `GET /v1/report?group_by=day` gives it.
- **Admin page** (`/dashboard/admin`, operator only): gateway `balance` and `total_used` from `GET /v1/credits`; sum of all customer balances from `SELECT SUM(amount) FROM ledger`; purchases per day; a red line when outstanding credits in USD exceed gateway balance.
- **Attribution:** pass the customer's user id as the gateway's `user` field (`metadata.user` in AI SDK terms, or the `user` body field for OpenAI-shaped requests) so `GET /v1/report?group_by=user` tells you what each customer cost. `x-kredit-user` is already an allowed header; wire it through in `src/lib/proxy.ts`.
- **Margin:** `MARGIN` in `src/lib/pricing.ts` is 0 today. The payment provider takes 2–4% and the gateway charges list price, so set the credit price (`CREDITS_PRICE_*_PER_1000`) above the $1 = 1,000 credits face value, or raise `MARGIN`, or both. At ₹85 per 1,000 credits with a 2% Razorpay fee and a ₹84 dollar, the margin is about zero; price accordingly.

### 7. Tests to add

- Unit: `recordPurchase` is already covered (`src/lib/ledger.test.ts`). Add `amountFor` / `pricePer1000`.
- Webhook: a script in `scripts/` that signs a fake `payment.captured` body with a test secret and posts it twice; the second must not add credits. Same for Dodo with the `standardwebhooks` library.
- Provider test modes: Razorpay test keys and Dodo `test_mode` both deliver real webhooks to a public URL; use a tunnel for local runs.

## Order of work

1. `src/lib/payments.ts` + `GET /api/payments/config` (half a day).
2. Dodo checkout + webhook, replace the placeholder card, test in `test_mode` (one day).
3. Razorpay order + checkout.js + webhook (one day, once the Razorpay account is approved).
4. Admin page with the gateway balance (half a day).
5. Price the packs, turn on Vercel auto-recharge, go live.
