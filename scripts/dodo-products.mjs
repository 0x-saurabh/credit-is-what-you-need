// Makes the credit packs in Dodo Payments, one product per pack, priced in
// CREDITS_CURRENCY (INR) from CREDITS_PRICE_INR_PER_1000 (paise). Each product
// carries `kredit_credits` in its metadata; the server reads the packs back
// from that (src/lib/dodo.ts), so the price lives in Dodo and nowhere else.
// Safe to run again: packs that already exist are left alone, and packs in any
// other currency are archived so they cannot be bought.
//
//   node scripts/dodo-products.mjs            (test mode, from .env.local)
//   DODO_PAYMENTS_ENVIRONMENT=live_mode node scripts/dodo-products.mjs
import fs from "node:fs";
import DodoPayments from "dodopayments";

const env = (name) => process.env[name] ?? fs.readFileSync(".env.local", "utf8").match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim();

const apiKey = env("DODO_PAYMENTS_API_KEY");
if (!apiKey) throw new Error("DODO_PAYMENTS_API_KEY is not set");
const environment = env("DODO_PAYMENTS_ENVIRONMENT") === "live_mode" ? "live_mode" : "test_mode";
const currency = (env("CREDITS_CURRENCY") || "INR").toUpperCase();
const unitPer1000 = Number(env(`CREDITS_PRICE_${currency}_PER_1000`) ?? (currency === "INR" ? 8500 : 100));
if (!Number.isInteger(unitPer1000) || unitPer1000 <= 0) throw new Error(`CREDITS_PRICE_${currency}_PER_1000 must be a whole number in the smallest unit`);
const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : `${currency} `;
const money = (units) => `${symbol}${(units / 100).toFixed(2)}`;

const PACKS = [1_000, 5_000, 10_000, 50_000];
const client = new DodoPayments({ bearerToken: apiKey, environment });

const existing = new Map();
for await (const product of client.products.list({ page_size: 100 })) {
  const credits = Number(product.metadata?.kredit_credits);
  if (!Number.isInteger(credits) || credits <= 0 || product.is_recurring) continue;
  if (product.currency === currency) existing.set(credits, product);
  else {
    await client.products.archive(product.product_id);
    console.log(`  archived ${product.product_id} (${credits.toLocaleString("en-US")} credits in ${product.currency}, not ${currency})`);
  }
}

console.log(`Dodo Payments, ${environment}: ${money(unitPer1000)} per 1,000 credits\n`);
for (const credits of PACKS) {
  const price = Math.round((credits / 1000) * unitPer1000);
  const have = existing.get(credits);
  if (have) {
    console.log(`  ${credits.toLocaleString("en-US").padStart(7)} credits  ${have.product_id}  (exists, ${money(have.price ?? 0)})`);
    continue;
  }
  const product = await client.products.create({
    name: `Kredit credits · ${credits.toLocaleString("en-US")}`,
    description: `${credits.toLocaleString("en-US")} Kredit credits of AI usage through one API key. Credits do not expire.`,
    tax_category: "saas",
    price: { type: "one_time_price", currency, price, discount: 0, purchasing_power_parity: false, tax_inclusive: true },
    metadata: { kredit_credits: String(credits) },
  });
  console.log(`  ${credits.toLocaleString("en-US").padStart(7)} credits  ${product.product_id}  (created, ${money(price)})`);
}
console.log("\nThe server reads these back from Dodo; nothing to copy into .env.");
