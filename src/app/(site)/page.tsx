import Link from "next/link";
import { Fragment } from "react";
import { ApiDemo } from "@/components/api-demo";
import { ArrowRightIcon, CheckIcon, PlusIcon, SparkIcon } from "@/components/icons";
import { DashboardPreview } from "@/components/landing/dashboard-preview";
import { LoopBeam } from "@/components/landing/loop-beam";
import { ModelOrbit } from "@/components/landing/model-orbit";
import { SectionHeading } from "@/components/landing/section-heading";
import { HeaderFocus, KeyStatus, ModelStream, PromptBar, UsageFeed } from "@/components/live-bento";
import { CountUp } from "@/components/motion/count-up";
import { Reveal } from "@/components/motion/reveal";
import { SignInButton } from "@/components/sign-in-button";
import { costExamples } from "@/lib/cost-examples";
import { formatCredits } from "@/lib/format";
import { MAX_ACTIVE_KEYS } from "@/lib/limits";
import { CREDITS_PER_USD, MARGIN, MIN_CREDITS_PER_REQUEST } from "@/lib/pricing";

// Every number on this page is read from the rules that do the real billing,
// so the page can't drift from them.

const marginPercent = Math.round(MARGIN * 100);

const proofPoints = ["No subscription", "OpenAI-compatible", "Revoke keys anytime"];

// Places that speak the OpenAI API, mixed with what a Kredit key adds on top.
const compatibility = [
  "Cursor",
  "Balance in every response header",
  "Postman",
  "Pay by card or UPI",
  "OpenAI Python SDK",
  `${marginPercent}% fee on the provider's price`,
  "OpenAI Node SDK",
  "curl",
];

// Live vignettes. The grid is six columns wide; spans keep the rows uneven on purpose.
const bento = [
  {
    span: "lg:col-span-4",
    live: <PromptBar />,
    title: "One key, whichever model fits",
    text: "Ask from Cursor, Postman or your own code. Kredit routes the call and takes the cost from your credits.",
  },
  {
    span: "lg:col-span-2",
    live: <KeyStatus />,
    title: "Keys you can see and revoke",
    text: "One key per tool. Revoke any of them and it stops working on the next request.",
  },
  {
    span: "lg:col-span-2",
    live: <UsageFeed />,
    title: "Every call itemised",
    text: "Model, tokens in and out, and the credits it cost. Nothing is averaged or hidden.",
  },
  {
    span: "lg:col-span-4",
    live: <HeaderFocus />,
    title: "The bill arrives with the answer",
    text: "Two response headers tell your code what the call cost and what is left. No dashboard needed.",
  },
  {
    span: "lg:col-span-6",
    live: <ModelStream />,
    title: "The makers you already use",
    text: "Reached through one OpenAI-compatible endpoint. Which models are on depends on the provider this server is connected to.",
  },
];

const dashboardPoints = [
  {
    title: "Focused pages",
    text: "Credits, keys, activity and settings each get a page of their own.",
  },
  {
    title: "Jump anywhere",
    text: (
      <>
        Press <kbd className="kbd">Cmd</kbd> <kbd className="kbd">K</kbd> or <kbd className="kbd">Ctrl</kbd>{" "}
        <kbd className="kbd">K</kbd> and go to any page by name.
      </>
    ),
  },
  {
    title: "Live balance everywhere",
    text: "Your credit balance stays in view on every page.",
  },
];

const stats = [
  { value: CREDITS_PER_USD, suffix: "", label: "credits buy $1 of AI usage" },
  { value: marginPercent, suffix: "%", label: "fee on top of the provider's price" },
  { value: 500, suffix: "+", label: "models behind one key" },
  { value: MAX_ACTIVE_KEYS, suffix: "", label: "active keys per account, one per tool" },
];

// Side by side with OpenRouter, which is the closest thing people already know.
const openRouterComparison = {
  same: [
    "One key reaches every maker: OpenAI, Anthropic, Google, Meta and the rest.",
    "OpenAI-compatible API. Change the base URL, keep your code.",
    "Model ids in the same maker/model shape, like openai/gpt-4o-mini.",
    `Pay per call at the provider's price, plus a ${marginPercent}% fee.`,
  ],
  different: [
    "Sign in with an email code or Google. No wallet, no seed phrase, no browser extension.",
    "Pay in rupees by UPI or card, or in dollars by card. Credits land the moment the payment is confirmed.",
    "The cost of every call comes back in the response headers.",
    "A built-in echo model, so you can test a key before spending on a real one.",
  ],
};

const buyPoints = [
  "Card, UPI and net banking through a regulated payment provider. Kredit never sees your card.",
  "Credits are written to your balance by the provider's confirmation, never by a page you could reload.",
  "Every purchase is listed on your dashboard with what it cost and what it bought.",
];

const faqs = [
  {
    question: "What is a credit worth?",
    answer: `${formatCredits(CREDITS_PER_USD)} credits pay for $1 of AI usage. Each call is charged exactly what the model's provider charged, with a ${marginPercent}% fee on top and a ${MIN_CREDITS_PER_REQUEST}-credit minimum, and every response tells you what it cost and what is left.`,
  },
  {
    question: "How do I sign in?",
    answer: "With an email code or your Google account. There is no password to remember and nothing to install.",
  },
  {
    question: "How do I pay?",
    answer: "By card, UPI or net banking at a fixed price per thousand credits. The payment goes through a regulated provider; Kredit only hears that it succeeded and writes the credits to your balance.",
  },
  {
    question: "Where can I spend credits?",
    answer: "Anywhere that speaks the OpenAI API: Postman, Cursor, your own code. Point the base URL at Kredit and paste your key. The built-in kredit/echo model repeats your message and is billed by length like a real model, so you can test a key and see how charges behave.",
  },
  {
    question: "How is Kredit different from OpenRouter?",
    answer: `Same idea, simpler account. Like OpenRouter, one Kredit key reaches every major model through an OpenAI-compatible API, and each call is billed at the provider's price plus a ${marginPercent}% fee. Kredit adds local payment methods such as UPI, a balance that comes back in every response header, and a playground that spends the same credits. If your code already talks to OpenRouter, change the base URL and the key and it works.`,
  },
  {
    question: "What if a key leaks?",
    answer: `Revoke it from your dashboard and it stops working at once. You can keep up to ${MAX_ACTIVE_KEYS} active keys, one per tool, so revoking one never breaks the others.`,
  },
  {
    question: "Do credits expire?",
    answer: "No. Credits stay in your balance until you spend them.",
  },
];

const headline = ["One", "key,", "every", "model,"];

// Delay for the hero's entrance sequence, one beat per element.
const beat = (index: number) => ({ animationDelay: `${index * 90}ms` });

const quietLink = "group inline-flex items-center gap-1.5 text-sm text-mist transition hover:text-fog";
const quietArrow = "size-3.5 transition-transform duration-300 group-hover:translate-x-1";

export default function Home() {
  return (
    <>
      {/* Pulled up under the sticky header (4rem), so the background runs behind it. */}
      <section className="relative isolate -mt-16 overflow-hidden pt-16">
        <div className="hero-bg -z-10 [--focus:50%_74%] md:[--focus:75%_54%]" aria-hidden>
          <div className="backdrop-light" />
          <div className="dot-field" />
        </div>

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-[1.05fr_1fr] md:py-24 lg:gap-16 lg:py-28">
          <div>
            {/* Sized so each half of the sentence holds one line beside the orbit; phones wrap on their own. */}
            <h1 className="text-4xl font-semibold leading-[1.06] tracking-tight text-balance sm:text-5xl">
              {headline.map((word, index) => (
                <Fragment key={word}>
                  <span style={beat(index + 1)} className="inline-block animate-rise">
                    {word}&nbsp;
                  </span>
                  {word === "key," && <br className="hidden xl:block" />}
                </Fragment>
              ))}
              <span style={beat(headline.length + 1)} className="inline-block animate-rise">
                <span className="text-shine">paid as you go</span>
              </span>
            </h1>
            <p style={beat(6)} className="mt-6 max-w-[52ch] animate-rise text-lg leading-relaxed text-mist">
              Kredit is a simpler OpenRouter. One key reaches OpenAI, Anthropic, Google and the rest
              through one OpenAI-compatible API. Buy credits by card or UPI, spend them by the token,
              and read the bill in the response headers.
            </p>
            <div style={beat(8)} className="mt-9 flex animate-rise flex-wrap items-center gap-x-6 gap-y-4">
              <SignInButton label="Sign in and get a key" />
              <a href="#how" className={quietLink}>
                How it works
                <ArrowRightIcon className={quietArrow} />
              </a>
            </div>
            <ul style={beat(10)} className="mt-10 flex animate-rise flex-wrap gap-x-6 gap-y-2 text-sm text-mist">
              {proofPoints.map((point) => (
                <li key={point} className="flex items-center gap-2">
                  <CheckIcon className="size-4 text-accent" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div style={beat(5)} className="animate-rise">
            <ModelOrbit />
          </div>
        </div>
      </section>

      <section aria-label="Where a Kredit key works" className="border-y border-line bg-surface/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 md:flex-row md:items-center md:gap-10">
          <p className="shrink-0 text-sm text-mist">Works wherever the OpenAI API works</p>
          <div className="marquee min-w-0 flex-1">
            {/* Slower than the default: this is a footnote to the hero, not a ticker. */}
            <div className="marquee-track font-mono text-xs uppercase tracking-widest text-mist" style={{ animationDuration: "56s" }}>
              {[0, 1].map((copy) => (
                <ul key={copy} aria-hidden={copy === 1} className="flex shrink-0">
                  {compatibility.map((item) => (
                    <li key={item} className="flex items-center whitespace-nowrap">
                      <span className="px-6">{item}</span>
                      <SparkIcon className="size-3 text-accent" />
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-4 py-24 md:py-32">
        <SectionHeading eyebrow="How it works" title="From a sign-in to any model">
          Three steps and a few minutes. No wallet, no subscription, no sales call.
        </SectionHeading>
        <div className="mt-16">
          <LoopBeam />
        </div>
      </section>

      <section id="live" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-24 md:py-32">
          <SectionHeading eyebrow="Watch it work" title="From a request to a model's answer">
            Your key spends the credits, and every response tells you what is left. The numbers below are examples.
          </SectionHeading>
          {/* minmax(0, 1fr): without it the one phone column grows as wide as the logo marquee inside it. */}
          <div className="mt-14 grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-10 lg:grid-cols-6">
            {bento.map((tile, index) => (
              <Reveal key={tile.title} delay={index * 90} className={tile.span}>
                <div className={`card flex flex-col justify-center overflow-hidden p-7 ${tile.span === "lg:col-span-6" ? "py-9" : "min-h-64"}`}>
                  {tile.live}
                </div>
                <h3 className="mt-5 font-semibold">{tile.title}</h3>
                <p className="mt-1 max-w-[52ch] text-sm leading-relaxed text-mist">{tile.text}</p>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-10">
            <Link href="/catalog" className={quietLink}>
              See every model, with the price of a turn
              <ArrowRightIcon className={quietArrow} />
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-24 md:py-32">
        <div className="grid items-center gap-x-16 gap-y-14 lg:grid-cols-[0.85fr_1.3fr]">
          <div>
            <SectionHeading eyebrow="The dashboard" title="A dashboard that stays out of your way">
              Once you sign in, four numbers tell you where you stand. Everything else is one step away.
            </SectionHeading>
            <ul className="mt-10 border-t border-line">
              {dashboardPoints.map((point, index) => (
                <Reveal as="li" key={point.title} delay={index * 80} className="flex items-start gap-3 border-b border-line/60 py-4">
                  <CheckIcon className="mt-1 size-4 text-accent" />
                  <div>
                    <h3 className="text-[0.9375rem] font-medium text-fog">{point.title}</h3>
                    <p className="mt-0.5 text-sm leading-relaxed text-mist">{point.text}</p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
          <Reveal delay={150} className="min-w-0">
            <DashboardPreview />
          </Reveal>
        </div>
      </section>

      <section id="api" className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl items-start gap-x-16 gap-y-14 px-4 py-24 md:py-32 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <SectionHeading eyebrow="Build" title="One key, in the tools you already use">
              Your key speaks the OpenAI API format, so it drops into tools you
              already use. Change the base URL, paste the key, done.
            </SectionHeading>
            <Reveal delay={240} className="mt-8 flex flex-wrap gap-3">
              <Link href="/docs" className="btn-ghost px-5 py-2.5 text-sm">
                Read the API docs
              </Link>
              <Link href="/playground" className="btn-ghost px-5 py-2.5 text-sm">
                Open the playground
              </Link>
            </Reveal>

            <Reveal delay={120} className="mt-14">
              <h3 className="section-label">
                What requests cost
                <span className="text-xs font-normal text-mist">Credits</span>
              </h3>
              <ul>
                {costExamples.map((example) => (
                  <li key={example.name} className="flex items-baseline justify-between gap-4 border-b border-line/60 py-3 text-sm">
                    <span className="min-w-0">
                      {example.name}
                      <span className="ml-3 hidden text-mist sm:inline">{example.detail}</span>
                    </span>
                    <span className="font-mono tabular-nums">{formatCredits(example.credits)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 max-w-[60ch] text-sm leading-relaxed text-mist">
                Longer questions and longer answers cost more. Every response carries{" "}
                <span className="font-mono text-xs text-fog">x-kredit-credits-charged</span> and{" "}
                <span className="font-mono text-xs text-fog">x-kredit-balance</span>, so your code always knows what a call cost.
              </p>
            </Reveal>
          </div>
          <Reveal delay={150} className="min-w-0 lg:sticky lg:top-24">
            <ApiDemo />
          </Reveal>
        </div>
      </section>

      <section id="openrouter" className="mx-auto max-w-6xl px-4 py-24 md:py-32">
        <SectionHeading eyebrow="OpenRouter, simplified" title="What you expect from OpenRouter, paid your way">
          If you have used OpenRouter, you already know how Kredit works. One key, every model,
          one API. The difference is how you pay and what you see.
        </SectionHeading>
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {[
            { label: "Same as OpenRouter", points: openRouterComparison.same, accent: false },
            { label: "Only on Kredit", points: openRouterComparison.different, accent: true },
          ].map((column, index) => (
            <Reveal key={column.label} delay={index * 120}>
              <div className={`h-full rounded-2xl border p-6 sm:p-8 ${column.accent ? "border-accent/30 bg-accent/[0.04]" : "border-line bg-surface"}`}>
                <h3 className={`section-label ${column.accent ? "text-accent" : ""}`}>{column.label}</h3>
                <ul className="mt-5 space-y-4">
                  {column.points.map((point) => (
                    <li key={point} className="flex items-start gap-3 text-sm leading-relaxed text-fog">
                      <CheckIcon className={`mt-0.5 size-4 shrink-0 ${column.accent ? "text-accent" : "text-mist"}`} />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={240}>
          <p className="mt-8 max-w-[60ch] text-sm leading-relaxed text-mist">
            Already on OpenRouter? Swap the base URL for this host&apos;s /v1 and the key for a Kredit key.
            Model ids stay the same.{" "}
            <Link href="/docs/integrations" className="text-fog underline decoration-line underline-offset-4 transition hover:decoration-accent">
              See the integrations guide
            </Link>
            .
          </p>
        </Reveal>
      </section>

      <section aria-label="Kredit in four numbers" className="mx-auto max-w-6xl px-4 pt-24 md:pt-32">
        <Reveal>
          <dl className="kpi-strip">
            {stats.map((stat, index) => (
              <div key={stat.label} className="kpi flex flex-col-reverse justify-end gap-3 p-5 sm:p-7">
                <dt className="max-w-[24ch] text-sm leading-relaxed text-mist">{stat.label}</dt>
                <dd className={`kpi-value mt-0 text-3xl leading-none sm:text-4xl lg:text-5xl ${index === 0 ? "text-accent" : ""}`}>
                  <CountUp value={stat.value} />
                  {stat.suffix}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </section>

      <section id="buy" className="mx-auto max-w-6xl px-4 py-24 md:py-32">
        <div className="grid items-center gap-x-16 gap-y-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <SectionHeading eyebrow="Paying" title="Buy credits by card or UPI">
              Top up when you need to, at a fixed price per thousand credits. The payment goes
              through a regulated provider and the credits land the moment it is confirmed.
              Nothing recurs unless you ask it to.
            </SectionHeading>
            <Reveal delay={260}>
              <ul className="mt-8 space-y-3 text-sm text-mist">
                {buyPoints.map((point) => (
                  <li key={point} className="flex items-start gap-2.5">
                    <CheckIcon className="mt-0.5 size-4 text-accent" />
                    {point}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <Reveal delay={150}>
            <div className="card relative overflow-hidden p-7">
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-xl border border-line bg-raised text-accent">
                  <SparkIcon className="size-5" />
                </span>
                <span className="chip">
                  <span className="size-1.5 rounded-full bg-mist breathe" />
                  Opening soon
                </span>
              </div>
              <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-4 font-mono">
                <div>
                  <p className="text-2xl font-semibold text-fog sm:text-3xl">$1</p>
                  <p className="mt-1 text-xs text-mist">card · UPI · net banking</p>
                </div>
                <ArrowRightIcon className="size-5 text-accent" />
                <div className="text-right">
                  <p className="text-2xl font-semibold text-accent sm:text-3xl">{formatCredits(CREDITS_PER_USD)}</p>
                  <p className="mt-1 text-xs text-mist">credits · $1 of AI usage</p>
                </div>
              </div>
              <Link href="/dashboard/credits" className="btn-ghost mt-8 w-full justify-center px-5 py-2.5 text-sm">
                Open your dashboard
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="faq" className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-x-16 gap-y-12 px-4 py-24 md:py-32 lg:grid-cols-[1fr_1.6fr]">
          <div className="self-start lg:sticky lg:top-24">
            <SectionHeading eyebrow="FAQ" title="Questions, answered">
              The short version of how credits are bought, priced and spent.
            </SectionHeading>
            <Reveal delay={240} className="mt-6">
              <Link href="/docs" className={quietLink}>
                The API docs have the rest
                <ArrowRightIcon className={quietArrow} />
              </Link>
            </Reveal>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {faqs.map((faq, index) => (
              <Reveal key={faq.question} delay={index * 60}>
                <details className="faq group" name="faq">
                  <summary className="flex items-center justify-between gap-6 py-5 text-base font-medium transition hover:text-accent sm:text-lg">
                    {faq.question}
                    <span
                      aria-hidden
                      className="chevron grid size-8 shrink-0 place-items-center rounded-full border border-line text-mist group-open:border-accent/50 group-open:text-accent"
                    >
                      <PlusIcon />
                    </span>
                  </summary>
                  <p className="max-w-[60ch] pb-6 leading-relaxed text-mist">{faq.answer}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-24 md:py-32">
        <Reveal className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-2xl border border-line bg-surface px-6 py-16 sm:px-12 md:py-20">
          <div className="hero-bg -z-10 [--focus:100%_0%]" aria-hidden>
            <div className="dot-field" />
          </div>
          <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="max-w-[18ch] text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
                Every model, <span className="text-shine">one key.</span>
              </h2>
              <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-mist">
                Sign in, create a key, and make your first call in five minutes.
              </p>
            </div>
            <div className="shrink-0">
              <SignInButton label="Sign in and get a key" />
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
