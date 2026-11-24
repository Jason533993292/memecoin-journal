# Access and release setup

Use the least privilege that still lets a maintainer diagnose and release the app. Never paste service-role keys, private keys, recovery phrases, or API keys into chat, issues, or source files.

## GitHub

1. Install and connect the GitHub plugin in Codex.
2. Authorize only the `LumixWeb3/Memecoin-journal-Solana-only-` repository (or the repository that now deploys this checkout).
3. Allow repository contents and pull requests to be read and written, and Actions checks to be read.
4. Keep branch protection on `main`; require the CI workflow before merging.
5. Add repository secrets only in GitHub Actions settings. Do not put their values in workflow files.

## Railway

1. Open the Railway workspace and invite the maintainer as a project member, or run `railway setup agent --oauth` from the repository and approve the browser prompt.
2. Grant access to the Memecoin Journal project and both `staging` and `production` environments.
3. Keep production deployment permission separate from ordinary read/log access when the workspace plan supports it.
4. Add the server-only variables listed in `.env.example` to each environment. Use different `HEALTHCHECK_TOKEN` values for staging and production.
5. Do not expose `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, or `HEALTHCHECK_TOKEN` as public variables.
6. Configure Railway health checks to call `/api/health`. An external monitor may send `Authorization: Bearer <HEALTHCHECK_TOKEN>` to run dependency readiness checks.

## Supabase

1. Connect the Supabase plugin with OAuth and select project `tndqtaouizztihzggwnh`.
2. Prefer a Supabase preview branch or a separate staging project for integration tests.
3. Permit schema migrations and read-only logs/advisors; keep organization billing and unrelated projects out of scope.
4. Store the service-role key only in Railway/GitHub encrypted secrets. The browser receives only the publishable key.
5. Review Security and Performance Advisors after every schema migration.

## Firebase and Google sign-in

1. Sign in with the Firebase CLI (`npx firebase-tools@latest login`) using the project owner account or grant a maintainer access to project `memecoin-journal`.
2. Use Firebase Viewer for diagnosis. Add Firebase Authentication Admin only when managing providers/users, and Firebase Rules Admin only when deploying rules.
3. In Firebase Authentication, enable Google and add both Railway domains plus localhost to Authorized domains.
4. In Google Cloud OAuth, keep the exact Firebase handler URI registered: `https://memecoin-journal.firebaseapp.com/__/auth/handler`.
5. Use a disposable test account for end-to-end login and deletion. Do not share the account password.

## Resend and monitoring

1. Invite the maintainer to the Resend team with read/log access, or keep the API key only in Railway.
2. Verify the sending domain and set `FEEDBACK_EMAIL_FROM` to an address on that domain.
3. Send feedback to `journal.memecoin@gmail.com` using `FEEDBACK_EMAIL_TO`.
4. Connect an uptime monitor to the authenticated health endpoint and alert on HTTP 503.
5. Add alerting for repeated Firebase Auth failures, Supabase errors, SOL-price lookup failures, and failed feedback delivery.

### Activate the repository monitors

The repository includes two scheduled workflows:

- `Service monitoring` checks public liveness every 30 minutes, then checks Firebase, Supabase, and feedback-email readiness when authenticated health tokens are configured.
- `Protected staging isolation` creates two disposable Firebase accounts once a week, verifies that each account can see and modify only its own Supabase rows, and deletes both accounts afterward.

Add these GitHub Actions repository secrets:

```text
PRODUCTION_HEALTHCHECK_TOKEN
STAGING_HEALTHCHECK_TOKEN
SUPABASE_ACCESS_TOKEN
STAGING_FIREBASE_API_KEY
STAGING_SUPABASE_URL
STAGING_SUPABASE_PUBLISHABLE_KEY
STAGING_SUPABASE_PROJECT_REF
STAGING_SUPABASE_DB_PASSWORD
```

`PRODUCTION_HEALTHCHECK_TOKEN` and `STAGING_HEALTHCHECK_TOKEN` must exactly match the server-only `HEALTHCHECK_TOKEN` configured in the corresponding Railway environment. Never prefix them with `NEXT_PUBLIC_`.

Create a Supabase personal access token with the narrowest available project-management access and store it only as `SUPABASE_ACCESS_TOKEN` in GitHub Actions. It is used only to verify that a recent backup exists; it is not bundled into the app.

After adding the secrets, open GitHub Actions and manually run both workflows once. Confirm that both jobs pass before relying on their schedules.

The `Database contract` workflow also regenerates the hosted TypeScript definitions and performs a dry-run migration push against staging. It prevents a release when the committed types are stale or a local migration was not applied to staging.

## Firebase App Check rollout

The web client initializes App Check only when `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` is configured.

1. In Firebase App Check, register the production web app with reCAPTCHA Enterprise and copy its site key into Railway as `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`.
2. Add the production and staging hostnames to the provider configuration. Never add `localhost` to a production reCAPTCHA key; use Firebase App Check debug tokens for local testing instead.
3. Deploy without enforcement and observe App Check metrics for at least one normal usage period.
4. Confirm Google sign-in, email sign-in, trade saves, journal saves, account deletion, and feedback still work.
5. Enable enforcement one Firebase product at a time, beginning with Firestore. Keep an immediate rollback window.

Do not enable enforcement before valid production traffic appears in App Check metrics; doing so can lock real users out.

## Backup restoration drill

`npm run backup:verify` confirms that Supabase reports a recent backup, but it deliberately does not restore production. A restore causes downtime and must remain an owner-approved operation.

### Encrypted off-site backups

The nightly `Database logical backup` workflow creates separate roles, schema, and data dumps. Before GitHub receives them, the workflow packs and encrypts them with `age`. It uploads only the `.age` archive and its encrypted-file checksum, and fails closed when `BACKUP_AGE_RECIPIENT` is absent. Never upload the SQL files directly: workflow artifacts on a public repository are not an appropriate confidentiality boundary.

The public recipient is stored as the GitHub Actions variable `BACKUP_AGE_RECIPIENT`. The matching private identity is stored on the trusted maintainer Mac in Keychain under `memecoin-journal-backup-age-identity`, base64 encoded so its multiline format remains intact. Losing that identity makes the off-site backups unreadable; anyone who obtains it can read them.

To recover the identity into a temporary file without printing it:

```sh
security find-generic-password -a "$USER" -s memecoin-journal-backup-age-identity -w | base64 --decode > /tmp/memecoin-journal-backup-age-identity.txt
```

Delete that exact temporary file after the drill. Do not commit it, upload it, paste it into logs, or store it as a GitHub secret.

### Drill procedure

1. Create a disposable Supabase branch or temporary project. Confirm it contains no data that must be retained. Never use production or the standing staging project as the target.
2. Download the newest `production-database-backup-*` artifact. Confirm its outer `SHA256SUMS` and that it contains no `.sql` files.
3. Decrypt it with the Keychain identity: `age -d -i /tmp/memecoin-journal-backup-age-identity.txt production-database-backup.tar.age | tar -x`.
4. Verify the inner files with `shasum -a 256 -c SHA256SUMS`.
5. Restore `roles.sql`, then `schema.sql`, then `data.sql` into the isolated target with `psql --single-transaction --variable ON_ERROR_STOP=1`. Follow the current Supabase logical restore guide and do not restore storage objects from the database dump.
6. Run `BACKUP_ROW_MANIFEST=./row-counts.txt SOURCE_DB_URL=<production read-only URL> RESTORED_DB_URL=<isolated URL> npm run backup:compare-restore`. The comparison checks every public table's row count plus exact table owners, RLS flags, policy definitions, table grants, and default privileges. Restored counts must match the encrypted backup’s manifest exactly. Production counts can change after the backup; different or missing security metadata fails.
7. Point a disposable test deployment at the isolated target. With two disposable accounts, confirm neither can read the other's trades, journal entries, wallets, research, settings, feedback, or wallet events.
8. Record the backup run, restore duration, comparison output, and result. Remove the disposable target only after saving the evidence.

Run this drill after security-related schema migrations and at least quarterly.

## Release order

1. Apply database migrations to staging.
2. Run `npm ci`, `npm run lint`, `npm test`, `npm run test:rules`, `npm run build`, `npm run test:e2e`, `npm run security:secrets`, and `npm run security:dependencies`.
3. Deploy staging and run `npm run smoke:release -- https://memecoin-journal-staging.up.railway.app`.
4. Complete real Google sign-in, create/edit/delete, offline recovery, feedback-email, and account-deletion acceptance tests with disposable data.
5. Promote the same verified revision to production.
6. Run `npm run smoke:release -- https://memecoin-journal.up.railway.app` and monitor errors before announcing the release.
