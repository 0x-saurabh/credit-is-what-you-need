import Link from "next/link";
import { ECHO_MODEL, RATE_LIMIT } from "@/lib/gateway";
import { MAX_ACTIVE_KEYS } from "@/lib/limits";
import { CREDITS_PER_USD, MARGIN, MIN_CREDITS_PER_REQUEST } from "@/lib/pricing";
import { KeyPanel } from "../key-panel";
import { OriginCode, Quickstart } from "../quickstart";
import { Card, Cards, Doc, H2, number, Step, Steps, Table } from "../ui";

const marginPercent = Math.round(MARGIN * 100);

export function QuickstartPage() {
  return (
    <Doc slug="quickstart" lede="A sign-in, a key, a request. Five minutes from nothing to a model answering on your credits.">
      <Steps>
        <Step title="Sign in">
          <p>
            Open <Link href="/dashboard">the dashboard</Link> and sign in with an email code or Google. There is no
            password and nothing to install. The session lasts seven days.
          </p>
        </Step>
        <Step title="Buy credits">
          <p>
            On <Link href="/dashboard/credits">Credits</Link>, pick an amount and pay by card, UPI or net banking. The
            credits land in your balance as soon as the payment is confirmed. See{" "}
            <Link href="/docs/credits/buying">Buying credits</Link>.
          </p>
        </Step>
        <Step title="Create an API key">
          <p>
            Under <Link href="/dashboard/keys">Keys</Link>, name a key and create it. Copy it now: it is shown once.
            You can have {MAX_ACTIVE_KEYS} active keys, so make one per tool.
          </p>
          <KeyPanel />
        </Step>
        <Step title="Make a request">
          <p>
            Point any OpenAI client at this host&apos;s <code>/v1</code> and use the key. Start with{" "}
            <code>{ECHO_MODEL}</code>, a built-in model that repeats your message, works on every server and is billed
            by length like a real one.
          </p>
          <Quickstart />
        </Step>
        <Step title="Read the bill">
          <p>
            Every non-streamed response carries <code>x-kredit-credits-charged</code> and{" "}
            <code>x-kredit-balance</code>. That is the whole billing model: no invoices, no surprises, the cost arrives
            with the answer.
          </p>
          <OriginCode
            title="Response headers"
            code={`HTTP/1.1 200 OK
content-type: application/json
x-kredit-credits-charged: 1
x-kredit-balance: 4999`}
          />
        </Step>
      </Steps>

      <H2>Where next</H2>
      <Cards>
        <Card href="/docs/api/models" title="Pick a real model">
          List every model your key can call, with prices in credits.
        </Card>
        <Card href="/docs/integrations" title="Plug it into your tools">
          Cursor, Claude Code, the OpenAI and Anthropic SDKs, the AI SDK, LangChain.
        </Card>
        <Card href="/docs/credits/buying" title="Buying credits">
          Payment methods, and how a payment turns into credits.
        </Card>
        <Card href="/docs/api/billing" title="Understand the price">
          The formula, worked examples, and what happens when a balance runs thin.
        </Card>
      </Cards>
    </Doc>
  );
}

export function HowItWorks() {
  return (
    <Doc slug="how-it-works" lede="Kredit is a loop: a payment becomes credits, credits pay for AI, and every call reports what it cost.">
      <OriginCode
        title="The loop"
        code={`card / UPI payment ──webhook──▶ credits ──API key / playground──▶ AI answers
                                  ▲                                  │
                                  └──── x-kredit-balance in every reply ┘`}
      />

      <H2>1. A payment becomes credits</H2>
      <p>
        You pay a payment provider on the Credits page. The provider confirms the payment to the server over a signed
        webhook, and the server writes the credits to your balance: {number(CREDITS_PER_USD)} credits for every $1
        paid, at the price shown before you paid. A payment is written exactly once, however many times the provider
        repeats itself. See <Link href="/docs/credits/buying">Buying credits</Link>.
      </p>

      <H2>2. Credits are a ledger</H2>
      <p>
        Your balance is the sum of your ledger rows: purchases and grants are positive, spending is negative. Nothing
        is ever edited, only added. Every row is on <Link href="/dashboard/activity">Activity</Link>.
      </p>

      <H2>3. Credits pay for AI</H2>
      <p>
        A key or the playground calls any model the server offers; the call costs exactly what the provider charged,
        with a {marginPercent}% fee on top, at least {MIN_CREDITS_PER_REQUEST} credit, and the bill arrives in the
        response headers. Kredit never lets an answer die halfway because credits ran out: a thin balance shortens the
        answer before the call goes out. See <Link href="/docs/api/billing">Pricing and billing</Link>.
      </p>

      <H2>4. Behind the key</H2>
      <p>
        Kredit forwards each call to Vercel AI Gateway (or another OpenAI-compatible provider the operator has
        configured), which routes it to the model&apos;s maker. The gateway bills the operator; your credits cover that
        bill. Your prompt reaches the model and nobody else, and it is never stored by Kredit.
      </p>

      <H2>What Kredit is not</H2>
      <ul>
        <li>Not a subscription. You buy credits when you need them, and they do not expire.</li>
        <li>Not a token or a currency. Credits are prepaid model usage, kept in a ledger, and are not transferable.</li>
        <li>Not a store of your card details. Payments happen at the provider; Kredit only hears that one succeeded.</li>
      </ul>
    </Doc>
  );
}

export function Rules() {
  return (
    <Doc slug="rules" lede="Every number the platform runs on, read from the code at render time. If a rule changes, this page changes with it.">
      <H2>Credits</H2>
      <Table
        head={["Rule", "Value"]}
        rows={[
          ["Credit value", `${number(CREDITS_PER_USD)} credits = $1 of AI usage`],
          ["Fee on AI calls", `${marginPercent}%: you pay the provider's price`],
          ["Minimum charge per call", `${MIN_CREDITS_PER_REQUEST} credit`],
          ["Rounding", "Up to the next whole credit"],
          ["Failed calls", "Free"],
          ["Expiry", "Never"],
        ]}
      />
      <H2>Buying</H2>
      <Table
        head={["Rule", "Value"]}
        rows={[
          ["Payment methods", "Card, UPI, net banking, through the configured payment provider"],
          ["When credits land", "On the provider's webhook confirming the payment"],
          ["A payment pays", "Once, keyed by the provider's payment id"],
          ["Refunds", "Final once written; a reversed payment takes its credits back"],
        ]}
      />
      <H2>Spending</H2>
      <Table
        head={["Rule", "Value"]}
        rows={[
          ["Rate limit", `${RATE_LIMIT} requests per minute per key; ${RATE_LIMIT} per minute per account in the playground`],
          ["Active API keys", `${MAX_ACTIVE_KEYS} per account`],
          ["Smallest answer before a call is refused", "16 output tokens"],
          ["Images per request", "1 to 4"],
          ["Video length", "1 to 20 seconds"],
        ]}
      />
      <H2>Accounts</H2>
      <Table
        head={["Rule", "Value"]}
        rows={[
          ["Sign-in", "Email code or Google, through Privy"],
          ["Session length", "7 days"],
          ["CLI login code", "Good for 10 minutes"],
        ]}
      />
    </Doc>
  );
}
