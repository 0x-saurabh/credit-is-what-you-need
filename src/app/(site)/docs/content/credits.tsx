import Link from "next/link";
import { formatRupees } from "@/lib/format";
import { CREDITS_PER_USD, RUPEES_PER_1000 } from "@/lib/pricing";
import { Callout, Doc, H2, number, Table } from "../ui";

// Buying credits, written from src/lib/ledger.ts (recordPurchase) and the
// payment webhook. Numbers are imported so they cannot drift.

export function Buying() {
  return (
    <Doc slug="credits/buying" lede="Credits are prepaid. You pay a payment provider by card, UPI or net banking; the provider confirms the payment to Kredit; Kredit writes the credits to your balance. Nothing else is involved.">
      <H2>What a purchase buys</H2>
      <p>
        {number(CREDITS_PER_USD)} credits pay for {formatRupees(RUPEES_PER_1000)} of AI usage at the provider&apos;s price. The
        price per thousand credits is shown on <Link href="/dashboard/credits">Credits</Link> in rupees before you pay.
        Credits do not expire.
      </p>

      <H2>How a payment becomes credits</H2>
      <ol>
        <li>You pick an amount on the Credits page and are sent to the payment provider&apos;s checkout.</li>
        <li>You pay there. Kredit never sees your card or bank details.</li>
        <li>
          The provider tells Kredit&apos;s server the payment succeeded, over a signed webhook. The server checks the
          signature, then writes one <em>purchase</em> row and one ledger row for the credits.
        </li>
        <li>
          Your balance moves at once, and the purchase appears under <Link href="/dashboard/credits">Credits</Link>{" "}
          with what it cost and what it bought.
        </li>
      </ol>
      <Callout kind="note" title="Paid once, by design">
        <p>
          The purchase row is keyed by the provider&apos;s own payment id. A webhook delivered twice, or a success page
          reloaded ten times, cannot pay twice. The credits come from the provider&apos;s confirmation, never from the
          browser.
        </p>
      </Callout>

      <H2>Payment methods</H2>
      <Table
        head={["Provider", "Methods", "Currency"]}
        rows={[
          ["Razorpay", "UPI, cards, net banking, wallets", "INR"],
          ["Dodo Payments", "UPI, cards, net banking and local methods", "INR"],
        ]}
        min="28rem"
      />
      <p>
        Dodo Payments is live first; Razorpay is planned as a second way to pay in rupees. The
        Credits page only shows the providers this server has switched on.
      </p>

      <H2>Refunds</H2>
      <p>
        Purchases are final once the credits are written. A payment that the provider later reverses has its credits
        taken back from the balance, which can go negative until the next purchase. Contact the operator through the
        channels on the site if a payment went wrong.
      </p>
    </Doc>
  );
}
