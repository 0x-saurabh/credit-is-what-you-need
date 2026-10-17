// Makes the credit packs in Dodo Payments, one product per pack, priced from
// CREDITS_PRICE_USD_PER_1000. Each product carries `kredit_credits` in its
// metadata; the server reads the packs back from that (src/lib/dodo.ts), so
// the price lives in Dodo and nowhere else. Safe to run again: packs that
// already exist are left alone.
//
//   node scripts/dodo-products.mjs            (test mode, from .env.local)
//   DODO_PAYMENTS_ENVIRONMENT=live_mode node scripts/dodo-products.mjs
import fs from "node:fs";
import DodoPayments from "dodopayments";

const env = (name) => process.env[name] ?? fs.readFileSync(".env.local", "utf8").match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim();

const apiKey = env("DODO_PAYMENTS_API_KEY");
if (!apiKey) throw new Error("DODO_PAYMENTS_API_KEY is not set");
const environment = env("DODO_PAYMENTS_ENVIRONMENT") === "live_mode" ? "live_mode" : "test_mode";
const centsPer1000 = Number(env("CREDITS_PRICE_USD_PER_1000") ?? 100);
if (!Number.isInteger(centsPer1000) || centsPer1000 <= 0) throw new Error("CREDITS_PRICE_USD_PER_1000 must be a whole number of cents");

const PACKS = [1_000, 5_000, 10_000, 50_000];
const client = new DodoPayments({ bearerToken: apiKey, environment });

const existing = new Map();
for await (const product of client.products.list({ page_size: 100 })) {
  const credits = Number(product.metadata?.kredit_credits);
  if (Number.isInteger(credits) && credits > 0 && !product.is_recurring) existing.set(credits, product);
}

console.log(`Dodo Payments, ${environment}: $${(centsPer1000 / 100).toFixed(2)} per 1,000 credits\n`);
for (const credits of PACKS) {
  const price = Math.round((credits / 1000) * centsPer1000);
  const have = existing.get(credits);
  if (have) {
    console.log(`  ${credits.toLocaleString("en-US").padStart(7)} credits  ${have.product_id}  (exists, $${((have.price ?? 0) / 100).toFixed(2)})`);
    continue;
  }
  const product = await client.products.create({
    name: `Kredit credits · ${credits.toLocaleString("en-US")}`,
    description: `${credits.toLocaleString("en-US")} Kredit credits: $${(credits / 1000).toFixed(2)} of AI usage through one API key. Credits do not expire.`,
    tax_category: "saas",
    price: { type: "one_time_price", currency: "USD", price, discount: 0, purchasing_power_parity: false, tax_inclusive: false },
    metadata: { kredit_credits: String(credits) },
  });
  console.log(`  ${credits.toLocaleString("en-US").padStart(7)} credits  ${product.product_id}  (created, $${(price / 100).toFixed(2)})`);
}
console.log("\nThe server reads these back from Dodo; nothing to copy into .env.");
