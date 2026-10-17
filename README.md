# Kredit

Kredit is a simpler OpenRouter: one API key that works with every major AI model, paid with prepaid credits you buy by card or UPI.

A person signs in with an email code or Google on [usekredit.space](https://usekredit.space), buys credits, and spends them on AI models (OpenAI, Anthropic, Google and others) through our API, the web playground, or the command line. Every call is billed at the provider's price and the cost comes back in the response headers.

Live site: https://usekredit.space
Repo: https://github.com/saurabh-sol/credit-is-what-you-need

## How it works, in one pass

1. Sign in with an email code or Google (Privy runs the dialog; Privy's user id is the account).
2. Buy credits. The payment provider confirms the payment over a webhook and the server writes the credits to the ledger (Neon Postgres). See `docs/payments.md`.
3. Create an API key on the dashboard and call `https://usekredit.space/v1/...` exactly like you would call OpenAI. Every call deducts credits at the model's price.
4. Kredit forwards the call to Vercel AI Gateway (or OpenRouter), which bills Kredit's own prepaid gateway balance.

## Folder structure

This is one Next.js project. The frontend and the backend live in the same repo and are deployed together as one service. The split below is by what each folder does, not by separate apps.

```
.
├── src/                      The website and the API (frontend + backend)
│   ├── app/
│   │   ├── (site)/           FRONTEND, public pages: landing, catalog, docs, CLI login
│   │   ├── (app)/            FRONTEND, signed-in pages: dashboard (credits, keys, activity, settings), playground
│   │   ├── api/              BACKEND, internal API used by the website (auth, keys, account, workspace, CLI login)
│   │   ├── v1/               BACKEND, public AI API for customers (chat, completions, embeddings, images, videos, models, usage)
│   │   └── typesafe/         BACKEND, TypeSafe AI "systemone" endpoint
│   ├── components/           FRONTEND, shared UI: header, sign-in button, landing sections, brand assets
│   └── lib/                  BACKEND, the business logic: users, ledger, pricing, sessions, DB, proxy to AI providers
│
├── cli/                      CLI, the `kredit` terminal tool published as @kredit/cli
├── scripts/                  TOOLING, end-to-end tests against a live server, backups
├── docs/                     Internal notes: CI, the payments plan, plain-language explanation of the product
├── public/                   Static files served as-is (provider logos)
├── data/                     Local backups (git-ignored)
│
├── Dockerfile                Container build
├── docker-compose.yml        Run it locally with Docker
├── render.yaml               Render deployment blueprint (production runs from this)
├── .env.example              Every environment variable, with what it does
└── package.json              Scripts and dependencies
```

### Frontend

Everything a person sees. `src/app/(site)` is the public website. `src/app/(app)` is what you get after signing in: the dashboard and the playground. `src/components` holds the pieces shared between them. Built with Next.js 16, React 19, Tailwind and Privy for sign-in.

### Backend

`src/app/api` is what our own website talks to. `src/app/v1` is what customers talk to: it accepts OpenAI-shaped requests, checks the API key and balance, forwards the call to the upstream provider (Vercel AI Gateway by default, OpenRouter as a second source), and charges the credits. `src/lib` is where the rules live: who is signed in (`users.ts`), what each model costs (`pricing.ts`), the ledger and purchases (`ledger.ts`), sessions (`session.ts`). Data is in Neon Postgres; tables are created on first run.

### CLI

`cli/` is a separate small Node package. `kredit login`, `kredit chat`, `kredit models`, `kredit usage` and so on. It only talks to the `/v1` API. See `cli/README.md`.

## Running it locally

Needs Node 22 or newer.

```sh
npm install
cp .env.example .env.local        # fill in DATABASE_URL, SESSION_SECRET, UPSTREAM_API_KEY at minimum
npm run dev
```

Open http://localhost:3000. Without `UPSTREAM_API_KEY` only the test model `kredit/echo` answers, which is enough to click through the site. Without the Privy variables the site renders but sign-in is off.

Or with Docker:

```sh
docker compose --env-file .env.local up -d --build
```

That serves on http://localhost:4000.

## Tests

```sh
npm test                 # unit tests in src/lib (embedded Postgres, no server needed)
npm run test:compat      # checks /v1 against OpenAI, Anthropic and Cursor client shapes (needs a running server)
npm run test:gateway     # end-to-end purchase -> key -> call -> balance (needs a running server)
npm run test:platform    # pages, playground, purchases and the payment routes (needs a running server)
npm run test:guard       # the spend guard, against a mock provider (needs a running server)
npm run test:auth        # sign-in refusals and sessions (needs a running server)
npm run lint
```

## Deploying

Production is Render. It watches the `main` branch of this repo and rebuilds on every push, using `render.yaml`. Secrets (database URL, provider keys, the Privy app id and secret, payment keys) are set in the Render dashboard, not in the repo.

Anything starting with `NEXT_PUBLIC_` is baked into the browser bundle at build time, so changing one of those needs a redeploy, not just a restart.

### Moving a database from the wallet era

Accounts used to be wallet addresses. The schema in `src/lib/db.ts` renames the `address` columns to `user_id` on first run, and `src/lib/users.ts` moves a person's old rows under their Privy id the first time they sign in again (Privy still lists the wallet it made for them). Tables that only served on-chain earning (`claimed_txs`, `claimed_milestones`, `claimed_streak_days`, `referrals`, `pending_claims`, `claim_holds`, `topups`, `profiles`, `spent_nonces`) are left in place; drop them by hand once you no longer want the data.

## Backups

The ledger lives in Neon Postgres, which keeps its own point-in-time history. For a copy you hold yourself:

```sh
npm run backup           # writes data/backups/kredit-<time>.json, keeps the newest 14
```

Safe to run while the site is live.

## Where to look for what

| Question | File |
| --- | --- |
| What does a model cost? | `src/lib/pricing.ts`, `src/lib/catalog.ts` |
| What can a key spend per minute / per day? | `src/lib/limits.ts`, `src/lib/budget.ts` |
| How does a payment become credits? | `docs/payments.md`, `src/lib/dodo.ts`, `src/app/api/payments/dodo/webhook/route.ts`, `src/lib/ledger.ts` (`recordPurchase`) |
| Who is signed in? | `src/lib/users.ts`, `src/app/api/auth/privy/route.ts` |
| Every env var | `.env.example` |
| Plain-language walkthrough of the whole product | `docs/understood.md` |
