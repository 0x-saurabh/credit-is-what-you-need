import Link from "next/link";
import { ArrowRightIcon, PlayIcon } from "@/components/icons";
import { catalog } from "@/lib/catalog";
import { ECHO_MODEL } from "@/lib/gateway";
import { CREDITS_PER_USD, MARGIN } from "@/lib/pricing";
import { KeyPanel } from "./key-panel";
import { Quickstart } from "./quickstart";
import { Card, Cards, Doc, H2, number, Table } from "./ui";

export const metadata = {
  title: "Docs — Kredit",
  description: "Everything about Kredit: buying AI credits by card or UPI, and spending them through one OpenAI-compatible API.",
};
// The model count depends on how this server is configured, so it is read per request.
export const dynamic = "force-dynamic";

const marginPercent = Math.round(MARGIN * 100);

export default async function Introduction() {
  const { live, models } = await catalog();

  return (
    <Doc
      slug=""
      title="Kredit documentation"
      lede="Kredit is a simpler OpenRouter: one key, every model, the bill in the response headers. Buy credits by card or UPI, spend them on any model."
    >
      <div className="not-prose flex flex-wrap items-center gap-2">
        <Link href="/docs/quickstart" className="btn-sm btn-sm-primary">
          Quickstart <ArrowRightIcon className="size-3.5" />
        </Link>
        <Link href="/playground" className="btn-sm">
          <PlayIcon className="size-3.5 text-mist" /> Open playground
        </Link>
        <span className="chip">
          <span className={`live-dot ${live ? "" : "opacity-50"}`} />
          {live ? `Provider connected · ${number(models.length - 1)} models` : `Test mode · ${ECHO_MODEL} only`}
        </span>
      </div>

      <H2>What Kredit is</H2>
      <p>
        You sign in with an email code or Google and buy credits by card or UPI. {number(CREDITS_PER_USD)} credits buy
        $1 of AI usage through an API that speaks the OpenAI and Anthropic formats, so Cursor, Claude Code, the SDKs
        and every tool you already use work by changing the base URL.
      </p>
      <Table
        head={["You do", "Kredit does"]}
        rows={[
          ["Pay by card, UPI or net banking", `Writes ${number(CREDITS_PER_USD)} credits per $1 to your balance the moment the payment is confirmed`],
          ["Create an API key", "Hands you a key that spends your balance and nothing else"],
          ["Call a model with your key", `Charges the provider's price with a ${marginPercent}% fee, and tells you in two headers`],
        ]}
        min="28rem"
      />

      <H2>Start here</H2>
      <Cards>
        <Card href="/docs/quickstart" title="Quickstart">
          Sign-in to working API call in five minutes.
        </Card>
        <Card href="/docs/how-it-works" title="How it works">
          The buy, spend, read-the-bill loop and the rules behind it.
        </Card>
        <Card href="/docs/credits/buying" title="Buying credits">
          Payment methods, and how a payment turns into credits exactly once.
        </Card>
        <Card href="/docs/api/chat-completions" title="API reference">
          Every endpoint, parameter, header and error, with runnable examples.
        </Card>
        <Card href="/docs/integrations" title="Integrations">
          OpenAI and Anthropic SDKs, Claude Code, the AI SDK, Cursor, LangChain.
        </Card>
      </Cards>

      <H2>Your first request</H2>
      <p>
        Create a key, then send this. <code>{ECHO_MODEL}</code> repeats your message, works on every server, and is
        billed by length like a real model, so the headers you get back are real.
      </p>
      <KeyPanel />
      <Quickstart />

      <H2>Principles</H2>
      <ul>
        <li>
          <strong>Rules, not discretion.</strong> Every number on this site is read from the code that does the
          billing, and the <Link href="/docs/rules">rules page</Link> lists all of them.
        </li>
        <li>
          <strong>Everything pays once.</strong> A payment is written to the ledger exactly one time, enforced in a
          single database transaction keyed by the provider&apos;s payment id.
        </li>
        <li>
          <strong>Spending is private.</strong> Nobody sees what you spent the credits on; prompts are never stored.
        </li>
        <li>
          <strong>No card on file.</strong> Payments happen at the payment provider. Kredit never holds your card.
        </li>
      </ul>
    </Doc>
  );
}
