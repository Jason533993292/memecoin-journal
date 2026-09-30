# Memecoin Journal Production Hardening Design

## Purpose

Turn the existing memecoin journal into a production-ready, desktop-first application for multiple real users while preserving existing accounts, trades, and Firebase isolation. The work implements the approved audit backlog and the separate top-100 improvement list as a coordinated set of releases rather than one rewrite.

## Success criteria

- Existing users can sign in and continue using their existing trades without manual migration.
- Imported and exported trades retain their original dates and every supported field.
- Financial calculations have one tested source of truth and disclose whether values are historical, user-entered, or estimated.
- Analytics never silently omit older trades and communicate sample size, units, and incomplete data.
- Every Firestore read and write remains scoped to the authenticated user.
- AI provider keys remain user-supplied, browser-held, and excluded from Firestore, analytics, and logs.
- Account recovery and deletion paths fail safely and explain recovery steps.
- The four desktop themes have usable contrast, alignment, focus behavior, and keyboard controls.
- Production builds, lint, behavioral tests, Firestore-rule tests, and desktop smoke tests pass before deployment.

## Constraints

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Firebase Auth, Firestore, Recharts, and Lucide React remain the application stack.
- User data remains rooted under `/users/{uid}`. Global user-readable collections are not introduced.
- Mobile redesign is outside this project; existing responsive behavior must not be deliberately broken.
- Recharts render components are defined outside render bodies.
- No server-owned AI provider key or fallback is added.
- No historical value is fabricated. Missing historical prices remain explicitly unknown or estimated.
- Existing records are normalized at read time. Destructive bulk migration is not required for the first release.
- New schema fields are optional until records are edited or explicitly migrated.

## Chosen approach

Use staged hardening within the existing app. Introduce small domain modules for serialization, calculations, validation, pagination, and provider handling, then migrate UI consumers to those modules. Ship each stage only after its focused tests and the full suite pass.

This is preferable to a rewrite because the current authentication, Firestore layout, and journal workflows already work. It also gives every data-affecting change a narrow rollback boundary.

## Release 1: trade portability and data integrity

### Canonical trade format

Extend the `Trade` model with optional schema metadata and historical fields:

- `schemaVersion`
- `tradedAt`
- `solUsdRate`
- `solUsdRateSource`: `user`, `live-at-entry`, `imported`, or `unknown`
- `tradeMode`: `real` or `paper`
- optional timezone metadata used only for display and grouping

Legacy `date` and `createdAt` remain readable. A normalizer resolves dates in this order: `tradedAt`, Firestore `date`, numeric `createdAt`. Invalid values are rejected during import rather than replaced with the current time.

### Backup and restore

Add a versioned JSON backup envelope containing export metadata, settings supported for portability, and complete trade objects. Downloads use `Blob` and object URLs. CSV remains a spreadsheet-oriented report, not the primary backup format.

Import becomes a two-step flow:

1. Parse and validate locally without writing.
2. Show detected records, invalid rows, duplicates, date range, and proposed actions.

Confirmed writes use Firestore batches within platform limits. The importer reports committed batches and can safely retry without duplicating already imported records. Duplicate identity is based on stable imported IDs when present and a deterministic trade fingerprint otherwise.

Filtered export always exports the visible result set, including an empty set. Full export is a separate, clearly labelled action.

### Quick paste

Extract the contract address before scanning for values. Prefer labelled values. Unlabelled parsing considers only text outside the address and accepts explicit supported shapes. Ambiguous input fills no financial field and explains what the user should label.

## Release 2: financial calculation engine

Create a pure calculation module that owns:

- SOL P&L and USD P&L derivation
- fee-adjusted realized P&L
- result classification and break-even tolerance
- risk multiples and expectancy
- median, mean, drawdown, and outlier summaries
- historical-rate and estimated-rate status

New trades record the rate used when USD values are derived. Users may save a SOL-only trade when a live rate is unavailable. Existing trades without a saved rate keep their stored USD values; missing USD values may be displayed as current-price estimates only when visibly labelled as estimates.

Fee metrics are hidden when no usable fee records exist. Paper and real trades remain together by default but can be filtered and compared separately.

## Release 3: complete history and analytics

Replace the fixed 1,000-record listener with cursor-based pagination plus an explicit history state. The interface shows how many trades are loaded and never labels partial data as all-time.

Analytics consume normalized trades and the shared calculation engine. Improvements include:

- user-selected timezone
- daily, weekly, monthly, and all-time scopes
- sample size beside each conclusion
- minimum-sample warnings
- median alongside average
- outlier influence
- period comparisons
- setup cohorts
- SOL and percentage drawdown
- click-through from heatmap cells to contributing trades

The app does not present statistical confidence it cannot justify. Sparse cells remain visibly sparse instead of being interpreted as zero performance.

## Release 4: account, security, and provider hardening

### Authentication

Add password reset and email-verification controls for email/password accounts. Google authentication remains supported. Provider-specific errors use plain language while preserving diagnostic codes for logs.

### AI keys

Keep provider keys out of Firestore, server logs, URLs, analytics events, and error payloads. Offer two storage modes:

- session only
- remember on this browser

Users can test a provider connection and remove a saved key. Sign-out offers or applies key clearing according to the chosen preference. Every provider adapter validates its own model and response shape.

### Account deletion

Account deletion uses an idempotent operation record and stages cleanup so retries are safe. The UI reports each stage without claiming completion early. A failed Auth deletion does not leave the user without an explanation or a retry route.

### Web security

Upgrade vulnerable dependencies, remove unused Prisma packages, add compatible security headers, and introduce Content Security Policy in report-only mode before enforcement. Firebase App Check support is feature-gated until the production site key and enforcement decision are supplied by the owner.

## Release 5: desktop UI and accessibility

Preserve the existing information architecture while improving hierarchy and density:

- repair theme token coverage and contrast
- establish a minimum readable desktop type scale
- eliminate duplicated headline metrics
- hide advanced metrics with no underlying data
- reorganize expert fields into named sections
- add sticky journal identifiers and configurable columns
- add compact and comfortable table density
- expose filter and export counts
- add saved filters
- improve first-trade and first-wallet empty states

All modal dialogs trap focus, return focus to their trigger, and warn before discarding unsaved work. Global shortcuts do not run while a form control or dialog owns keyboard input. Interactive heatmap cells become labelled buttons with keyboard activation.

Theme changes remain local visual preferences. Every theme must pass contrast and screenshot regression checks before release.

## Release 6: reliability and performance

Token lookup accepts only Solana pairs whose base or quote address matches the requested contract and records which side matched. Requests use cancellation or generation tokens so stale responses cannot overwrite current input.

Price responses include freshness metadata. The UI distinguishes live, cached, stale, unavailable, and manually supplied prices.

Wallet mutations use one versioned local record and one atomic save. Optional Firestore sync can be added only with explicit user opt-in and matching owner-only rules.

Heavy analytics views are loaded on demand. Shared selectors prevent each view from independently recomputing the same statistics. The journal uses pagination or virtualization when the loaded row count warrants it.

Client error reporting is opt-in or privacy-safe by construction: no AI keys, notes, screenshots, contract lists, email addresses, or raw trade payloads.

## Release 7: verification and operations

Add automated coverage for:

- quick-paste parsing
- CSV escaping and Blob export
- JSON backup round trips
- legacy normalization
- import validation, batching, duplicates, and retry
- financial calculations and precision boundaries
- pagination and partial-history state
- AI provider adapters
- account deletion state transitions
- Firebase Auth recovery behavior
- Firestore rules in the emulator with two users
- keyboard and dialog accessibility
- visual regressions for the four desktop themes

Continuous integration runs type checking, lint, tests, the production build, and security-rule validation. Deployment notifications and privacy-safe runtime monitoring remain enabled. Backups require a documented restore drill.

Long-lived tabs receive an update-available notice when the deployed build changes.

## Data compatibility and migration

No automatic destructive migration runs at application startup. Read-time normalization supports legacy documents. When a legacy trade is edited, the new canonical optional fields are added while unrelated values are preserved.

A separate owner-triggered migration may later normalize tag placement and schema versions. It must show a preview, make a backup first, use idempotent writes, and remain restartable.

Legacy positive tags stored in `mistakes` are classified through the centralized good-tag list until migrated. New writes use `goodTags` and `mistakes` separately.

## Error handling

- User-correctable validation failures are shown beside the relevant field.
- Network failures preserve entered data and provide retry controls.
- Partial batch operations report the exact committed range without exposing internal credentials.
- Analytics omit invalid records and disclose the omitted count.
- External provider failures never change saved trade data.
- Destructive operations require explicit confirmation and display their recovery limits.

## Deployment strategy

Each release is a separate commit or small commit series with a green build. Data-integrity changes ship before expanded analytics and visual polish. Security headers begin in report-only mode where compatibility is uncertain. Firebase-rule changes are emulator-tested and reviewed before deployment.

The final verified branch is pushed to `main` only after the complete suite, production build, rules validation, desktop smoke test, and final code review pass. Vercel deployment is then checked for build status and runtime errors.

## Owner input required during execution

Most work needs no additional input. The owner will be asked only when an external decision is unavoidable:

- whether to enable Firebase App Check enforcement after report-only observation
- the production App Check site key if App Check is enabled
- whether wallet settings should gain optional cloud sync
- permission to deploy changed Firestore rules if new fields require them
- confirmation before the final push if approval is not already current

## Explicit non-goals

- Storing user AI keys in Firestore, analytics, or server-side shared secrets
- Adding social trading, copy trading, or public trade feeds
- Replacing Firebase with a different backend
- Rewriting the application from scratch
- Treating estimated market conversions as historical fact
- A mobile-first redesign

