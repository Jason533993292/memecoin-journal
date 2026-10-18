# Public release runbook

Use this checklist in order. Do not promote a different commit than the one
that passed staging.

## 1. Protect and verify the data

1. Export a current Firebase backup and keep it outside the repository.
2. Run `npm run migration:verify` with the current Firebase Admin JSON and
   Supabase secret key.
3. Investigate every per-account mismatch. Do not retire Firestore until the
   verifier reports matching account rows and financial aggregates.
4. Keep Firebase available as a rollback source through the beta period.

## 2. Verify staging

1. Deploy the release commit to the Railway `Staging` environment.
2. Confirm `/api/health` returns `{ "status": "ok" }`.
3. Test Google and email/password sign-in with a fresh account.
4. Test trade create, edit, refresh, delete and undo.
5. Test wallets, research, statistics, themes, import/export and account
   deletion.
6. Repeat the ownership tests with two accounts and confirm neither can read
   or modify the other's Supabase rows.

## 3. Configure production secrets

In Railway, open the `production` environment and the `memecoin-journal`
service. Add these variables without pasting their values into chat or source
control:

```text
NEXT_PUBLIC_DATA_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=https://tndqtaouizztihzggwnh.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<current publishable key>
SUPABASE_SERVICE_ROLE_KEY=<current secret/service-role key>
FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON=<current one-line service-account JSON>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=memecoin-journal.firebaseapp.com
```

Run `npm run deployment:verify` with the same values on a trusted machine.

## 4. Configure the production domain and OAuth

1. Add the production domain to the Railway production service.
2. Complete the DNS record Railway displays and wait for its certificate to be
   active.
3. In Firebase Authentication, add the bare Railway/custom hostname under
   Authorized Domains.
4. In the Firebase-created Google OAuth web client, add the JavaScript origin
   `https://<production-hostname>`.
5. Keep the redirect URI
   `https://memecoin-journal.firebaseapp.com/__/auth/handler` and keep
   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=memecoin-journal.firebaseapp.com` unless a
   Firebase Hosting custom auth domain is deliberately configured later.
6. Redeploy after saving the production variables.

## 5. Promote and observe

1. Deploy the exact staging commit to production.
2. Wait for Railway to report `SUCCESS` and confirm one running replica.
3. Run the production smoke test with a new disposable account.
4. Confirm account deletion removes Firebase Auth and all five user-owned
   Supabase datasets.
5. Start with an invite-only beta, monitor logs and feedback, then open public
   registration.

## Owner decisions

The owner must supply the final hostname, support email, legal/contact details,
usage and billing limits, and whether registration is invite-only or open.
