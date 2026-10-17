# Kredit, understood

A plain explanation of what this website is and how it works for every kind of user.
Every number here is taken from the code, and the file it comes from is named next to it.

## The idea in one paragraph

Kredit is a simpler OpenRouter: one API key reaches every major AI model. Calls are paid
in **credits**. You sign in with an email code or Google, buy credits by card or UPI, and
create an API key you use like an OpenAI key: every call takes a few credits off your
balance and tells you what it cost.

**1,000 credits ≈ ₹85 of AI usage.** Providers price models in dollars; the site shows rupees at a fixed ₹85 to the dollar. (`src/lib/pricing.ts`)

```
card / UPI payment ──webhook──▶ credits ──API key / playground──▶ AI answers
```

## The pages

| Page | Who it is for | What it does |
| --- | --- | --- |
| `/` | Everyone | Explains the product. Once signed in, its button becomes "Open dashboard". |
| `/dashboard` | Signed-in people | Overview and balance, with a page each for credits (`/credits`: buy more, see purchases), API keys (`/keys`), activity (`/activity`) and settings (`/settings`: your data). |
| `/playground` | Signed-in people | Chat with any model in the browser, paid from your credits. No key needed. |
| `/catalog` | Everyone | Every model with the price of a turn. |
| `/docs` | Developers | How to call the API, with copy-paste code and what typical requests cost. |
| `/v1/...` | Programs | The API itself (OpenAI-compatible). |

## How it works for each user

### 1. A visitor (not signed in)

You can read the landing page, the catalog and the docs. You cannot spend or open the
dashboard; `/dashboard` sends you back to the home page.

### 2. Signing in (every user)

1. Click **Sign in**. The dialog is Privy's: an **email code** or **Google**.
2. The browser sends Privy's token to the server (`POST /api/auth/privy`). The server
   checks it against Privy's public keys, reads your email and name from Privy, and gives
   the browser a session that lasts **7 days**. (`src/lib/session.ts`, `src/lib/users.ts`)
3. Privy's user id is your account. Credits, keys, purchases and conversations are kept
   against it.
4. You land on the dashboard. If you signed in from the playground or the docs, you stay there.

People who signed up when accounts were wallet addresses keep everything: the first time
they sign in again, their old rows move under their Privy id. (`src/lib/users.ts`)

### 3. Buying credits

On **Credits**, you pick an amount and pay at the payment provider's checkout (Razorpay for
INR with UPI, cards and net banking; Dodo Payments; prices in rupees).
The provider tells the server the payment succeeded over a signed webhook, and the server
writes one purchase row and one ledger row. A payment is written exactly once, keyed by the
provider's payment id, so a webhook delivered twice cannot pay twice. The purchase then
appears on the Credits page with what it cost and what it bought.
(`src/lib/ledger.ts` `recordPurchase`, `docs/payments.md`)

Until a provider is connected the Credits page says "payments are being set up".

### 4. API keys

Under **Keys**, name a key and create it. It starts with `kred_sk_` and is shown once; only
its hash is stored. Up to **5 active keys**. Revoking one stops it at once.
(`src/lib/ledger.ts`, `src/lib/limits.ts`)

### 5. Spending

Point any OpenAI client at `/v1` with the key. Each call is checked against your balance,
forwarded to the AI provider (Vercel AI Gateway by default), and charged what the provider
charged, with a 0% fee, at least 1 credit, rounded up. The response carries
`x-kredit-credits-charged` and `x-kredit-balance`. A thin balance shortens the answer rather
than letting it die halfway; a balance that cannot cover the prompt refuses the call before
it goes out, and nothing is charged. Failed calls are free.
(`src/lib/proxy.ts`, `src/lib/budget.ts`, `src/lib/pricing.ts`)

The playground spends the same balance through your session; no key is pasted into the page.

### 6. Where the money goes

Your payment goes to Kredit through the payment provider. Kredit separately keeps its Vercel
AI Gateway balance topped up; the gateway bills Kredit for every call it forwards. The two
balances never touch: the gateway has no way to take a customer's payment directly.
(`docs/payments.md`)

### 7. Your data

**Settings** downloads everything Kredit holds about you as one JSON file (profile, ledger,
purchases, usage, key names, workspace metadata), and can clear the workspace. Prompts sent
through the API are never stored. (`src/app/api/account/export/route.ts`)

## The command line

`npm install -g @kredit/cli`, then `kredit login` (a code approved in the browser makes a key
for the terminal), `kredit chat`, `kredit models`, `kredit usage`, `kredit whoami`. It only
talks to `/v1`. (`cli/`)
