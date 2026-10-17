import { dodoClient, dodoOn, listPacks, purchaseFromPayment } from "@/lib/dodo";
import { grantCredits, PurchaseUsedError, recordPurchase } from "@/lib/ledger";

// Dodo tells this route what happened to a payment. It is the only place
// credits are written for a purchase: the browser's return from checkout is
// never trusted. The body is verified as raw bytes (Standard Webhooks: HMAC
// over id, timestamp and body), so it is read with text(), never json().
//
// Register in the Dodo dashboard (Developer > Webhooks) as
//   <site>/api/payments/dodo/webhook   events: payment.succeeded, refund.succeeded
// and put the endpoint's secret in DODO_PAYMENTS_WEBHOOK_KEY.

export async function POST(request: Request) {
  if (!dodoOn()) return new Response("payments are not configured", { status: 503 });

  const raw = await request.text();
  let event;
  try {
    event = dodoClient().webhooks.unwrap(raw, {
      headers: {
        "webhook-id": request.headers.get("webhook-id") ?? "",
        "webhook-signature": request.headers.get("webhook-signature") ?? "",
        "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
      },
    });
  } catch {
    return new Response("bad signature", { status: 401 });
  }

  if (event.type === "payment.succeeded") {
    const result = purchaseFromPayment(event.data, await listPacks());
    if (!result.ok) {
      // Not a credit purchase we recognise. Say so and let Dodo keep the
      // event in its log; a 200 would bury it.
      console.warn(`Dodo payment ${event.data.payment_id} not credited: ${result.reason}`);
      return new Response(result.reason, { status: 422 });
    }
    try {
      await recordPurchase({ provider: "dodo", ...result.purchase });
    } catch (error) {
      if (!(error instanceof PurchaseUsedError)) throw error; // the same event, delivered again
      return Response.json({ received: true, duplicate: true });
    }
    return Response.json({ received: true });
  }

  if (event.type === "refund.succeeded") {
    // Money went back, so the credits it bought go back too. The refund id
    // keys the grant's memo, so a repeat delivery is visible in the ledger
    // rather than silently doubled; grants are not deduplicated by design.
    const refund = event.data;
    const userId = refund.metadata?.user_id;
    const credits = Number(refund.metadata?.kredit_credits);
    if (typeof userId === "string" && Number.isInteger(credits) && credits > 0) {
      await grantCredits(userId, -credits, `Refund ${refund.refund_id} of payment ${refund.payment_id}`);
    }
    return Response.json({ received: true });
  }

  return Response.json({ received: true, ignored: event.type });
}
