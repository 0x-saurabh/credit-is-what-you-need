import { CheckIcon, CoinsIcon, SparkIcon, UsersIcon } from "@/components/icons";
import { ProviderLogo } from "@/components/model-logo";
import { Reveal } from "@/components/motion/reveal";
import { formatCredits } from "@/lib/format";
import { CREDITS_PER_USD } from "@/lib/pricing";
import { featuredProviders } from "@/lib/providers";

// Small illustrations of what each stage hands you. Not real data, but the
// credit values are read from the pricing rules so they can't drift from them.
const makers = featuredProviders.slice(0, 5);

// How many models the default upstream lists. A round floor, so it stays true as the list grows.
const MODEL_COUNT = "500+";

function SignedProof() {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-fog">you@example.com</span>
        <span className="flex shrink-0 items-center gap-1.5 text-accent">
          <CheckIcon className="size-3.5" />
          Signed in
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <span>Method</span>
        <span className="truncate text-fog">Email code</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-dashed border-line pt-2.5">
        <span>Password</span>
        <span className="tabular-nums text-fog">none</span>
      </div>
    </>
  );
}

function PurchaseProof() {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate">Paid by UPI</span>
        <span className="shrink-0 tabular-nums text-fog">₹850.00</span>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        <span className="truncate">Confirmed by</span>
        <span className="shrink-0 text-fog">payment provider</span>
      </div>
      <div className="mt-2.5 flex items-baseline justify-between gap-3 border-t border-dashed border-line pt-2.5">
        <span>Credits</span>
        <span className="tabular-nums font-semibold text-accent">+{formatCredits(CREDITS_PER_USD * 10)}</span>
      </div>
    </>
  );
}

function ModelProof() {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-fog">kred_sk_9fQk…h2Lw</span>
        <span className="shrink-0">API key</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <span>Creates</span>
        <span className="truncate text-fog">Text, images, video</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-dashed border-line pt-2.5">
        <span className="flex items-center gap-2.5 text-fog">
          {makers.map((maker) => (
            <ProviderLogo key={maker.name} logo={maker.logo} className="size-4" />
          ))}
        </span>
        <span className="shrink-0 text-accent">{MODEL_COUNT} models</span>
      </div>
    </>
  );
}

const stages = [
  {
    icon: UsersIcon,
    title: "Sign in",
    text: "An email code or your Google account. No password, no wallet, nothing to install.",
    proof: <SignedProof />,
  },
  {
    icon: CoinsIcon,
    title: "Buy credits",
    text: "Pay by card or UPI. The credits land in your balance the moment the payment is confirmed.",
    proof: <PurchaseProof />,
  },
  {
    icon: SparkIcon,
    title: "Any model",
    text: `Spend on ${MODEL_COUNT} models, image and video creation included, with one API key or in the playground.`,
    proof: <ModelProof />,
  },
];

// Three stages joined by a line, with a light that keeps travelling along it and
// lights each stage, and the card hanging under it, as it passes. The motion is all
// CSS (see `.loop` in landing.css), timed from one shared duration, so the light and
// the stages can never drift apart.
// It starts when the row scrolls into view, which is all <Reveal> is here for.
export function LoopBeam() {
  return (
    <Reveal variant="mark" className="loop">
      <div className="loop-track" aria-hidden>
        <span className="loop-beam" />
      </div>
      {/* Three across only from lg: at tablet width the proof lines inside each card run out of room. */}
      <ol className="relative grid gap-8 lg:grid-cols-3 lg:gap-6">
        {stages.map((stage, index) => (
          <Reveal as="li" key={stage.title} delay={index * 160} className="h-full">
            <div className="flex h-full gap-5 lg:flex-col lg:gap-6" style={{ "--stage": index } as React.CSSProperties}>
              <span className="loop-tile">
                <stage.icon className="size-5" />
                <span className="loop-lit">
                  <stage.icon className="size-5" />
                </span>
              </span>
              <div className="loop-card card card-lift flex min-w-0 flex-1 flex-col p-6">
                <p className="loop-numeral" aria-hidden>
                  0{index + 1}
                </p>
                <p className="font-mono text-xs text-mist">Step {index + 1}</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">{stage.title}</h3>
                <p className="mt-2 mb-6 max-w-xs leading-relaxed text-mist">{stage.text}</p>
                <div className="loop-proof mt-auto" aria-hidden>
                  {stage.proof}
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </ol>
    </Reveal>
  );
}
