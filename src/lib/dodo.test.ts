import assert from "node:assert/strict";
import { test } from "node:test";
import type { Payment } from "dodopayments/resources/payments";
import { packsFrom, purchaseFromPayment } from "./dodo.ts";

const product = (overrides: Partial<Parameters<typeof packsFrom>[0][number]>) => ({
  product_id: "pdt_x",
  metadata: { kredit_credits: "1000" },
  is_recurring: false,
  price: 100,
  currency: "USD" as const,
  ...overrides,
});

test("packs are the one-time products that say how many credits they buy, cheapest first", () => {
  const packs = packsFrom([
    product({ product_id: "pdt_big", metadata: { kredit_credits: "10000" }, price: 1000 }),
    product({ product_id: "pdt_small", metadata: { kredit_credits: "1000" }, price: 100 }),
    product({ product_id: "pdt_sub", metadata: { kredit_credits: "5000" }, is_recurring: true }), // subscriptions are not packs
    product({ product_id: "pdt_other", metadata: {} }), // some other product on the account
    product({ product_id: "pdt_free", metadata: { kredit_credits: "0" } }),
    product({ product_id: "pdt_nan", metadata: { kredit_credits: "lots" } }),
  ]);
  assert.deepEqual(packs, [
    { credits: 1000, productId: "pdt_small", amount: 100, currency: "USD" },
    { credits: 10000, productId: "pdt_big", amount: 1000, currency: "USD" },
  ]);
});

const packs = packsFrom([product({ product_id: "pdt_1k", metadata: { kredit_credits: "1000" }, price: 100 })]);

const payment = (overrides: Partial<Payment> = {}) =>
  ({
    payment_id: "pay_1",
    status: "succeeded",
    total_amount: 100,
    currency: "USD",
    metadata: { user_id: "did:privy:alice", kredit_credits: 1000 },
    product_cart: [{ product_id: "pdt_1k", quantity: 1 }],
    ...overrides,
  }) as unknown as Payment;

test("a succeeded payment for a pack buys that pack's credits for the user in its metadata", () => {
  assert.deepEqual(purchaseFromPayment(payment(), packs), {
    ok: true,
    purchase: { userId: "did:privy:alice", credits: 1000, paymentId: "pay_1", amount: 100, currency: "USD" },
  });
});

test("two of a pack buy twice the credits", () => {
  const result = purchaseFromPayment(payment({ product_cart: [{ product_id: "pdt_1k", quantity: 2 }], total_amount: 200 }), packs);
  assert.ok(result.ok && result.purchase.credits === 2000);
});

test("payments that are not a finished credit purchase buy nothing", () => {
  assert.equal(purchaseFromPayment(payment({ status: "processing" }), packs).ok, false);
  assert.equal(purchaseFromPayment(payment({ metadata: { kredit_credits: 1000 } }), packs).ok, false); // nobody to credit
  assert.equal(purchaseFromPayment(payment({ product_cart: [{ product_id: "pdt_unknown", quantity: 1 }] }), packs).ok, false);
  // The browser cannot talk the webhook into more credits than the product sells.
  assert.equal(purchaseFromPayment(payment({ metadata: { user_id: "did:privy:alice", kredit_credits: 999_999 } }), packs).ok, false);
});
