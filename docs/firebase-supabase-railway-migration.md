# Firebase to Supabase + Railway migration

## Safe status

This repository now has an applied Supabase schema, an optional browser client,
Firebase-token role bridge, account-deletion parity, and a Railway deployment
definition. The live application still uses Firebase Auth, Firestore, and its
current Vercel deployment until `NEXT_PUBLIC_DATA_BACKEND=supabase` is set.
Nothing in this guide runs automatically, and no Firebase customer records are
deleted by committing these files.

Keep the Firebase project and Vercel deployment active until the staged
migration below is complete and the Railway version has passed the account
isolation and recovery checks.

## Target layout

- Firebase Authentication remains the identity provider initially; this avoids
  forcing existing users to recreate accounts.
- Supabase Postgres stores trades, wallets, wallet transactions, and journal
  settings. Firebase UIDs and Firestore document IDs are preserved.
- Railway runs the Next.js server. Vercel remains the rollback deployment.
- AI provider keys are not migrated to the database. They remain user-local.

## Applied Supabase state

The `initial_journal_schema` migration has been applied to the connected
Supabase project. It created `trades`, `wallets`, `wallet_transactions`, and
`user_settings`, with RLS enabled and user ownership policies on all four.
Each table also has a restrictive Firebase issuer/audience policy for the
`memecoin-journal` Firebase project. The Supabase security advisor was clean
after the migration.

Before using the app's Supabase data path, add these variables to the intended
deployment environment:

```text
NEXT_PUBLIC_SUPABASE_URL=https://tndqtaouizztihzggwnh.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<project publishable key>
NEXT_PUBLIC_DATA_BACKEND=supabase
FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON=<existing Firebase Admin JSON>
SUPABASE_SERVICE_ROLE_KEY=<server-only key, required for account deletion>
```

The first three values are safe for the browser except the service-role key.
Never prefix `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_`, never commit it,
and do not send it in chat. The data-backend flag should be omitted or set to
`firebase` until the transfer and two-account tests are complete.

## Required setup before a cutover

1. Create/select a Supabase project and enable Firebase as a third-party auth
   provider for Firebase project `memecoin-journal`. Configure the Firebase
   integration to issue `role: authenticated` claims. Existing Firebase users
   need that claim before the Supabase client can use their ID token with RLS.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` only after obtaining them from the
   intended Supabase project. Never expose a Supabase secret/service-role key
   through a `NEXT_PUBLIC_` variable.
3. Link the local Supabase CLI to the correct project, inspect the SQL, then
   apply the migration to a non-production project first. Do not apply the
   schema to production until it has been reviewed against a real export.
4. Create a Railway project specifically for this journal. The checked-in
   `.railway/railway.ts` is a plan definition; it does not deploy until you
   explicitly link and apply it. Review the plan before applying.
5. Configure Railway's web service with the existing Firebase public config
   variables and `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` if server routes need
   Firebase Admin. Also set the Supabase public URL/key and the server-only
   `SUPABASE_SERVICE_ROLE_KEY`, which is required by the account-deletion
   route. Never prefix the service-role key with `NEXT_PUBLIC_`, commit it, or
   use it from browser code.

## Data transfer and cutover checklist

1. Export Firestore and create a separate backup before transfer. The local
   export utility reads `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` and writes to
   `migration-data/firestore-export.json`, which is excluded from Git. Run
   `npm run migration:export` only on a trusted computer; protect and delete
   the resulting personal-data file after migration.
2. Import to a staging Supabase project, preserving each UID and document ID.
   Use a staging-only service-role key locally and set
   `SUPABASE_MIGRATION_TARGET=staging` as a deliberate safety confirmation.
   The importer refuses `NODE_ENV=production` and never prints credentials.
   Never store the service-role key in Vercel, Railway, `NEXT_PUBLIC_` config,
   or source control. Run `npm run migration:import:staging -- <export-file>`.
3. Compare per-user and per-collection row counts; spot-check timestamps,
   optional trade fields, screenshots, wallet balances, settings, and special
   characters. Do not transfer analytics records or provider API keys.
4. Test with two accounts: each user can CRUD their own rows and cannot read or
   write the other user's rows. Also test Firebase sign-in, account deletion,
   imports/exports, wallet updates, and server-side AI routes.
5. Deploy the same commit to Railway as a staging service and verify
   `/api/health`, auth, database reads/writes, and logs.
6. Only after approval, set `NEXT_PUBLIC_DATA_BACKEND=supabase` in a staging
   deployment. Retain Vercel and Firestore read-only/backup access during the
   rollback window.
7. Freeze writes briefly for the final delta migration. Verify counts again.
   Keep Firestore until the new deployment is stable and a restore has been
   tested. Do not delete the Firebase project as part of this migration.

## Current cutover state

The journal now routes trades, wallets, wallet transactions, and user settings
through Supabase whenever `NEXT_PUBLIC_DATA_BACKEND=supabase` is set. Firebase
Authentication remains the identity provider, and Firebase Admin verifies its
tokens before issuing the Supabase-compatible role claim. Removing that flag
uses the retained Firebase data path as a rollback option.

Existing Firestore data is intentionally **not** copied automatically. Run the
staging export/import and the two-account RLS checks before directing existing
users to the Supabase-backed production deployment.
