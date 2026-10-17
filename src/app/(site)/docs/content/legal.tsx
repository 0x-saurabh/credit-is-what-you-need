import Link from "next/link";
import { MAX_ACTIVE_KEYS } from "@/lib/limits";
import { CREDITS_PER_USD, MARGIN, RUPEES_PER_1000 } from "@/lib/pricing";
import { formatRupees } from "@/lib/format";
import { SITE_URL } from "@/lib/site";
import { Callout, Doc, H2, Table, number } from "../ui";

// The privacy policy and the terms. Written from the code, not from a template:
// every retention period and every number here is the one the server uses.
// CHECKED is the date someone last read these against the code; bump it when
// the code changes what they describe.
const CHECKED = "18 October 2026";

function Checked() {
  return (
    <p className="font-mono text-xs text-mist">
      Checked against the code on {CHECKED}. Site: <code>{SITE_URL}</code>.
    </p>
  );
}

export function Privacy() {
  return (
    <Doc
      slug="legal/privacy"
      lede="Kredit stores as little as it can, keeps your prompts out of its database, and publishes the little it does store here."
    >
      <Checked />

      <H2>The short version</H2>
      <ul>
        <li>Your identity here is the email or Google account you sign in with, through Privy. There is no password.</li>
        <li>What you send to a model through the API is forwarded and dropped. It is never written to our database.</li>
        <li>Conversations you have in the workspace are stored for you, in your account, until you delete them.</li>
        <li>Nothing you send trains a model, ours or anyone else&apos;s.</li>
        <li>Your card and bank details go to the payment provider, never to us.</li>
        <li>No analytics scripts, no advertising pixels, no data brokers.</li>
      </ul>

      <H2>What we store, and for how long</H2>
      <Table
        head={["Data", "Why", "Kept"]}
        rows={[
          ["Privy user id, email, name", "It is your account, and the dashboard shows who is signed in", "As long as the account has any row"],
          ["Ledger rows: every credit in and out", "Your balance is the sum of them", "Forever. It is the money."],
          ["Purchases: payment provider, its payment id, amount, currency, credits", "So a payment buys credits once, and you can see what you paid", "Forever"],
          [`API keys (up to ${MAX_ACTIVE_KEYS}): SHA-256 hash, name, first characters, last use`, "To authenticate calls", "Until revoked; the hash stays so a revoked key can never come back"],
          ["Usage rows: model, token counts, credits, time, which key", "So you can see what a call cost", "Forever, as totals on your dashboard"],
          ["Sessions", "To keep you signed in", "7 days, or until you sign out"],
          ["CLI device codes", "To finish a CLI login", "10 minutes"],
          ["Workspace conversations and messages", "So your chats survive a reload and follow you across devices", "Until you delete them"],
          ["Workspace creations: images and clips, with prompt, model and cost", "Your library", "Until you delete them"],
        ]}
        min="40rem"
      />

      <H2>What we never store</H2>
      <ul>
        <li>
          <strong>API prompts and answers.</strong> A request to <code>/v1</code> goes to the model&apos;s provider
          and the answer comes back to you. We keep the token counts and the price, nothing else.
        </li>
        <li>
          <strong>Voice.</strong> Dictation and read-aloud in the workspace use your browser&apos;s own speech
          engine. No audio reaches our servers.
        </li>
        <li>
          <strong>Card or bank details.</strong> You pay at the payment provider&apos;s checkout. We receive the
          payment&apos;s id, amount and currency, and whether it succeeded.
        </li>
      </ul>

      <H2>Who else sees your data</H2>
      <Table
        head={["Service", "What it sees", "Why"]}
        rows={[
          ["The model provider (through Vercel AI Gateway)", "Your prompt and the answer. Not your email, not your key.", "It runs the model"],
          ["Privy", "Your email or Google account", "It runs the sign-in"],
          ["The payment provider (Razorpay or Dodo Payments)", "Your payment details and email", "It takes the payment"],
          ["Neon", "The database above", "It hosts the database"],
          ["Render", "Web traffic: IP address, user agent, URL, in rotating logs", "It hosts the site"],
        ]}
        min="36rem"
      />
      <p>
        We do not sell data, share it for advertising, or hand it to anyone not on this list, except when the law
        leaves us no choice.
      </p>

      <H2>Cookies</H2>
      <p>
        One of our own, first-party and needed to work: the signed session cookie. Privy, which runs the sign-in
        dialog, keeps your login in your browser&apos;s local storage. There is no consent banner because there is
        nothing to consent to; nothing here does tracking.
      </p>

      <H2>Your controls</H2>
      <ul>
        <li>Sign out here, or everywhere, from the dashboard settings.</li>
        <li>Revoke any API key at any time. Revocation is immediate.</li>
        <li>Delete any workspace conversation or creation. It is a hard delete.</li>
        <li>Download your profile, ledger, purchases, usage and keys list as JSON from the dashboard settings.</li>
        <li>
          Ask for deletion of everything except the ledger and purchase rows, which have to stay so a payment cannot
          be paid twice. Open an issue on the repository or contact us on the channels listed on the site.
        </li>
      </ul>

      <H2>Children</H2>
      <p>Kredit is not for anyone under 18. If you are, please do not use it.</p>

      <H2>Changes</H2>
      <p>
        When the code changes what this page describes, this page changes with it and the date at the top moves.
        The full history is in the repository.
      </p>

      <Callout kind="note" title="Security">
        <p>
          How keys, sessions and spending are protected is on the{" "}
          <Link href="/docs/platform/security">privacy and security</Link> page.
        </p>
      </Callout>
    </Doc>
  );
}

export function Terms() {
  return (
    <Doc slug="legal/terms" lede="What a credit is, how you buy one, what you can do with one. Plain words, no surprises.">
      <Checked />

      <H2>1. What Kredit is</H2>
      <p>
        Kredit is a website, an API and a command-line tool that let you buy <strong>credits</strong> and spend them
        on calls to AI models run by third-party providers. Kredit is an independent project. It is not affiliated
        with the model providers or with the payment providers.
      </p>

      <H2>2. Credits</H2>
      <ul>
        <li>
          {number(CREDITS_PER_USD)} credits pay for {formatRupees(RUPEES_PER_1000)} of model usage at the provider&apos;s published price (in dollars, shown in rupees at a fixed rate), with a{" "}
          {Math.round(MARGIN * 100)}% fee on top, rounded up to a whole credit per call.
        </li>
        <li>
          Credits are prepaid access to model usage. They are <strong>not money</strong>, not a token, not a
          security, not a deposit and not a claim on Kredit or anyone else. They cannot be withdrawn, transferred
          between accounts, sold or converted back to cash.
        </li>
        <li>Credits do not expire.</li>
        <li>
          Purchases are final once the credits are written. A payment the provider later reverses has its credits
          taken back, and a balance can go negative until the next purchase.
        </li>
        <li>Failed calls are free. A provider error, an unreachable provider or a refused request charges nothing.</li>
        <li>The price of a model is the provider&apos;s price on the day of the call, and providers change prices.</li>
      </ul>

      <H2>3. Paying</H2>
      <ul>
        <li>Payments are taken by a regulated payment provider at its own checkout, under its own terms.</li>
        <li>The price per thousand credits is shown before you pay. Taxes, where they apply, are shown there too.</li>
        <li>You must be entitled to use the payment method you pay with.</li>
      </ul>

      <H2>4. Your account and your keys</H2>
      <ul>
        <li>You are responsible for the account you sign in with and for every API key you create.</li>
        <li>
          Spend by a key is spend by you, including spend by a key that leaked. Revoke a key the moment you think it
          might have.
        </li>
        <li>You may hold up to {MAX_ACTIVE_KEYS} active keys. Rate limits are as documented and may change.</li>
      </ul>

      <H2>5. Acceptable use</H2>
      <ul>
        <li>
          Calls go to third-party models. Their providers&apos; usage policies apply to what you send, and a
          provider may refuse a request. We pass their refusal on and charge nothing for it.
        </li>
        <li>Do not use Kredit to break the law, to harm people, or to attack the service or the providers.</li>
        <li>Do not resell access to your key or share one account&apos;s credits as a service to others without telling us.</li>
      </ul>

      <H2>6. The service</H2>
      <ul>
        <li>
          Kredit is provided as is. It runs on shared hosting, depends on providers we do not control, and has no
          uptime promise. A call that fails is free; a call that is slow is not a fault.
        </li>
        <li>
          We may change, pause or shut down any part of the service. If the whole service closes, we will say so on
          the site at least 30 days ahead, and credits can be spent until then.
        </li>
        <li>Model answers are generated by machines and can be wrong. Check anything that matters.</li>
      </ul>

      <H2>7. Liability</H2>
      <p>
        To the extent the law allows, Kredit&apos;s total liability to you for anything arising from the service is
        limited to the amount you paid for credits in the 30 days before the claim. We are not liable for lost
        profits, lost data, or anything a model said. Nothing here limits liability that cannot be limited by law.
      </p>

      <H2>8. Termination</H2>
      <p>
        You can stop at any time: sign out, revoke your keys, delete your workspace data. We can close an
        account&apos;s access for breaking these terms; unspent purchased credits are then honoured for 30 days by
        request, unless the purchase itself was part of the breach.
      </p>

      <H2>9. Changes to these terms</H2>
      <p>
        These terms change when the product changes. The date at the top is the date of the last check, and the
        repository holds every previous version. Using the service after a change accepts the change.
      </p>

      <H2>10. Contact and governing law</H2>
      <p>
        Questions, problems and deletion requests go through the channels listed on the site and the repository.
        A governing law and a formal contact address will be added here when the project has an operating entity;
        until then, the law of the place where the operator lives applies.
      </p>
    </Doc>
  );
}
