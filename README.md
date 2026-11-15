# Memecoin Journal

A private trading journal for reviewing Solana memecoin trades, daily decisions, wallet activity, research theses, discipline, and realized performance.

## What the app includes

- Guest previews and Firebase Authentication for saved accounts
- Supabase-backed trades, journals, wallets, research, feedback, and account history
- Guided trade logging, partial entries and exits, screenshots, playbooks, and thesis links
- Daily journal, monthly calendar, performance statistics, and currency-aware reporting
- Optional AI reviews using a provider key stored in the user's browser
- Wallet activity review through public Solana RPC data
- Feedback delivery, status tracking, account export, and resumable deletion

## Local development

Requirements: Node.js 22 and npm.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

Do not commit `.env.local`, Firebase service-account JSON, Supabase service-role keys, AI provider keys, health tokens, or feedback-worker tokens.

## Verification

```bash
npm run lint
npm test
npm run build
npm run test:rules
npm run security:dependencies
npm run smoke:release -- https://memecoin-journal.up.railway.app/
```

The repository also contains Playwright release checks, CodeQL, secret scanning, a database-contract workflow, protected staging isolation, service monitoring, and Supabase backup verification.

## Data and security model

- Firebase authenticates users.
- Supabase stores journal data and uses row-level security tied to the Firebase user ID.
- Firestore remains available for server-side rate limits and legacy compatibility.
- Private API routes verify Firebase tokens and apply bounded request parsing and rate limits.
- AI keys stay in browser storage and are forwarded only to the chosen provider when a review is requested.
- Wallet balances may be initialized when a wallet is created; later changes must use recorded deposits or paychecks.

Review `/privacy` and `/terms` in the running application for the user-facing policies.

## Deployment

Production is deployed from `main` to Railway. Environment variables are managed in Railway and GitHub Actions; values must never be written to the repository.

Before a public release, confirm:

1. Release checks, CodeQL, database contract, and staging isolation pass.
2. The production health check reports Firebase, Firestore, Supabase, and feedback delivery readiness.
3. A recent Supabase backup has completed and its verification workflow passes.
4. The live smoke test passes for the homepage, legal pages, and health endpoint.
