# Memecoin Journal Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing journal portable, financially accurate, secure, accessible, and reliable for production users without breaking existing Firebase-scoped accounts.

**Architecture:** Add pure trade-domain modules for parsing, normalization, backup/import, calculations, and validation. UI components call those modules rather than duplicate business logic. Firestore documents remain backward compatible; legacy fields are normalized at read time and all new fields are optional until explicitly saved.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Firebase Auth/Firestore, Tailwind CSS, Recharts, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-30-production-hardening-design.md`

## Global Constraints

- Preserve `/users/{uid}` ownership isolation and default-deny Firestore access.
- Do not store user AI keys in Firestore, logs, analytics, URLs, or shared server environment variables.
- Do not introduce fabricated historical prices; label estimates.
- Keep current documents readable with no startup bulk migration.
- Prioritize desktop UI; do not deliberately regress responsive behavior.
- Define Recharts render components outside render functions.
- Tests are written and observed failing before each production behavior change.
- Firebase rules changes use the Firestore emulator and live-rule validation before deployment.

## Review Focus

- A pasted Solana address containing a long run of digits must never become a monetary value; Task 1 pins this.
- A total-loss trade with zero proceeds must save as zero rather than deriving a negative sale amount; Task 1 pins this.
- A JSON backup containing legacy and modern trade fields must restore exact dates and all supported values; Task 3 pins this.
- A signed-in user must not read or write another user’s trade or preferences document; Task 10 pins this.
- A stale token lookup must not overwrite the most recently entered contract’s metadata; Task 8 pins this.

### Task 1: Safe trade payload and quick-paste parsing

**Files:**
- Create: `src/lib/tradeInput.ts`
- Modify: `src/components/LogTradeModal.tsx`
- Modify: `src/components/EditTradeModal.tsx`
- Test: `tests/tradeInput.test.mts`

**Interfaces:**
- Produces `parseQuickTradePaste(value: string): QuickTradePasteResult`.
- Produces `buildTradeAmounts(input: TradeAmountInput): TradeAmountResult`.
- Later form tasks consume validated, finite non-negative sale proceeds from `buildTradeAmounts`.

- [ ] Write failing tests for an address containing repeated digits, labelled values, ambiguous values, an entered zero sale, and a loss greater than initial buy because of fees.
- [ ] Run `node --test tests/tradeInput.test.mts` and confirm the old implementation cannot satisfy the new module contract.
- [ ] Implement pure parsing that removes a detected base58 address before unlabelled numeric extraction and accepts only finite, bounded values.
- [ ] Implement amount construction that preserves explicit zero and clamps only derived sale proceeds at zero while retaining fee-adjusted P&L.
- [ ] Replace modal-local parsing and falsy numeric fallbacks with the shared helpers; show field-specific validation feedback for rejected data.
- [ ] Run focused tests, `npm run lint`, and `npm run build`; commit `fix: make quick trade entry Firestore-safe`.

### Task 2: Canonical trade model and financial calculations

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/tradeCalculations.ts`
- Modify: `src/lib/utils.ts`
- Modify: `src/components/LogTradeModal.tsx`
- Modify: `src/components/EditTradeModal.tsx`
- Modify: `src/components/DashboardView.tsx`
- Modify: `src/components/StatisticsView.tsx`
- Modify: `src/components/EquityCurveCard.tsx`
- Test: `tests/tradeCalculations.test.mts`

**Interfaces:**
- Produces `normalizeTrade`, `getTradeTimestamp`, `calculateTradeOutcome`, `getUsdValueStatus`, and summary selectors.
- Consumers receive normalized `Trade` values with optional `tradedAt`, `solUsdRate`, `solUsdRateSource`, and `tradeMode`.

- [ ] Write failing tests for legacy timestamps, a stored historical rate, a missing rate, zero USD values, break-even boundaries, fees, median, drawdown, and paper/real filters.
- [ ] Run the focused test and confirm it fails because the calculation module is absent.
- [ ] Extend the optional type schema and implement pure normalization/calculation functions with explicit historical-versus-estimated status.
- [ ] Update new/edit forms to persist the conversion rate used for derived USD values and allow SOL-only saves when live pricing is unavailable.
- [ ] Replace duplicated P&L fallbacks in dashboard/statistics/equity consumers with shared selectors; hide fee metrics with no fee data.
- [ ] Run focused tests, lint, and build; commit `feat: centralize trade calculations and history metadata`.

### Task 3: Versioned backup, CSV safety, and import preview

**Files:**
- Create: `src/lib/tradeBackup.ts`
- Modify: `src/lib/exportImport.ts`
- Modify: `src/components/TradeJournalView.tsx`
- Test: `tests/tradeBackup.test.mts`

**Interfaces:**
- Produces `createTradeBackup`, `parseTradeImport`, `validateTradeImport`, and `createCsvBlob`.
- UI receives an import preview containing valid rows, invalid rows, duplicates, date range, and field-preservation status.

- [ ] Write failing tests for `#` in CSV content, Blob download payloads, full JSON round trips, original date preservation, invalid rows, duplicate fingerprints, and empty filtered export.
- [ ] Run focused tests and confirm the existing data-URL/one-pass import behavior fails the required cases.
- [ ] Implement a versioned JSON envelope, Blob exports, complete field serialization, CSV formula-safe escaping, and deterministic duplicate fingerprints.
- [ ] Add a preview-and-confirm import UI; batch confirmed writes and report partial progress without silently changing dates.
- [ ] Split “export visible” from “full backup” and show the selected-record count.
- [ ] Run focused tests, lint, and build; commit `feat: add safe trade backup and import preview`.

### Task 4: History loading, filters, and desktop journal workflow

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/TradeJournalView.tsx`
- Create: `src/lib/tradeFilters.ts`
- Test: `tests/tradeFilters.test.mts`

**Interfaces:**
- Produces cursor/page state and `filterTrades` / saved-filter serialization helpers.
- Dashboard and analytics receive history metadata: `loadedCount`, `hasMore`, and `isComplete`.

- [ ] Write failing tests for filters, saved-filter round trips, pagination cursor transitions, and an empty visible set.
- [ ] Run focused tests and confirm the helpers are absent.
- [ ] Replace the fixed 1,000-row listener with initial page plus explicit “load more” flow, preserving real-time updates for the loaded window.
- [ ] Add history-completeness disclosure, sticky identity columns, configurable column visibility, compact/comfortable density, and saved desktop filters.
- [ ] Ensure exports and analytics state make partial history explicit.
- [ ] Run focused tests, lint, and build; commit `feat: add complete-history journal controls`.

### Task 5: Analytics quality and accessible heatmaps

**Files:**
- Modify: `src/components/StatisticsView.tsx`
- Modify: `src/components/TimeOfDayHeatmap.tsx`
- Modify: `src/components/TiltStreakHeatmap.tsx`
- Modify: `src/components/DailyRecapModal.tsx`
- Test: `tests/analyticsSelectors.test.mts`

**Interfaces:**
- Consumes normalized trades and shared calculation selectors from Task 2.
- Produces selectable timeframe, timezone, trade-mode, and minimum-sample views.

- [ ] Write failing tests for timezone bucketing, sparse cells, legitimate zero USD P&L, all scopes, median/outlier labels, and good-tag classification.
- [ ] Run focused tests and confirm current view-local logic fails the new contracts.
- [ ] Refactor analytics to shared selectors; add period comparisons, cohorts, drawdown views, sample counts, outlier context, and click-through filters.
- [ ] Convert heatmap cells to labelled keyboard-operable buttons; replace ambiguous day labels and increase desktop label readability.
- [ ] Remove repeated headline metrics and misleading zero-value cards.
- [ ] Run focused tests, lint, and build; commit `feat: improve analytics reliability and accessibility`.

### Task 6: Authentication, local key privacy, and account deletion resilience

**Files:**
- Modify: `src/context/AuthContext.tsx`
- Modify: `src/components/AuthModal.tsx`
- Modify: `src/components/AiCoachView.tsx`
- Modify: `src/app/api/account/delete/route.ts`
- Modify: `src/components/AccountDeletionModal.tsx`
- Create: `src/lib/aiKeyStorage.ts`
- Test: `tests/aiKeyStorage.test.mts`
- Test: `tests/accountDeletion.test.mts`

**Interfaces:**
- Produces session/local AI-key storage functions that never expose a secret outside browser storage.
- Produces idempotent account-deletion stage results for the deletion UI.

- [ ] Write failing tests for session-only key storage, clear-on-sign-out, provider key removal, and safe deletion retries after each stage.
- [ ] Run focused tests and confirm the missing storage/deletion abstractions fail.
- [ ] Add password-reset and email-verification actions for email/password users.
- [ ] Replace raw local-key handling with user-scoped session-or-remember storage and a test-connection flow that does not persist or log keys.
- [ ] Stage deletion with durable operation status and truthful progress/error messages; retain owner-only access rules.
- [ ] Run focused tests, lint, and build; commit `feat: harden account recovery keys and deletion`.

### Task 7: Security headers, dependency cleanup, and operational safeguards

**Files:**
- Modify: `package.json`
- Modify: package lockfile
- Modify: `next.config.ts`
- Create: `src/lib/securityHeaders.ts` if configuration composition requires it
- Create: `.github/workflows/verify.yml`
- Test: `tests/securityHeaders.test.mts`

**Interfaces:**
- Produces a documented response-header policy that permits the exact Firebase, analytics, image, and API origins in use.

- [ ] Write failing tests for the required security headers and their expected directives.
- [ ] Run focused tests and confirm no header policy exists.
- [ ] Upgrade patched Next.js/tooling versions after reviewing release notes; remove unused Prisma dependencies and postinstall behavior.
- [ ] Add X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame protection, and report-only CSP compatible with the deployed app.
- [ ] Add CI checks for types, lint, tests, build, dependency audit, and Firebase-rule validation.
- [ ] Run focused tests, full verification, and build; commit `chore: harden production dependencies and headers`.

### Task 8: Token lookup, price freshness, and wallet reliability

**Files:**
- Modify: `src/app/api/token/[ca]/route.ts`
- Modify: `src/app/api/sol-price/route.ts`
- Modify: `src/components/LogTradeModal.tsx`
- Modify: `src/components/TopBanner.tsx`
- Modify: `src/components/WalletsView.tsx`
- Modify: `src/components/DepositPaycheckModal.tsx`
- Create: `src/lib/tokenValidation.ts`
- Test: `tests/tokenValidation.test.mts`

**Interfaces:**
- Produces `selectMatchingSolanaPair` and freshness-aware price response states.

- [ ] Write failing tests for base/quote address matching, wrong-chain pairs, liquidity selection, stale request suppression, cached-price status, and atomic wallet write failure.
- [ ] Run focused tests and confirm the new behavior is absent.
- [ ] Validate token pairs against requested Solana addresses; cancel or sequence lookup requests so only the newest can update the form.
- [ ] Return freshness metadata from the price route and show live/cached/stale/unavailable/manual state in the header and forms.
- [ ] Store wallet state and transactions in a single versioned local record and only show success after the write succeeds.
- [ ] Run focused tests, lint, and build; commit `fix: harden token price and wallet reliability`.

### Task 9: Desktop accessibility, themes, and interaction safety

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/ThemePreviewControl.tsx`
- Modify: modal components that accept unsaved editable data
- Modify: `src/app/page.tsx`
- Create: `src/lib/dialogFocus.ts`
- Test: `tests/dialogFocus.test.mts`
- Test: `tests/themePreview.test.mts`

**Interfaces:**
- Produces reusable focus-trap/restore behavior and an unsaved-change guard.

- [ ] Write failing tests for theme token contrast coverage, focus restoration, keyboard escape behavior, and dialog shortcut isolation.
- [ ] Run focused tests and confirm existing theme/dialog utilities fail those cases.
- [ ] Repair theme surface/text tokens, including Terminal cards; set desktop-readable type tokens and remove redundant metric displays.
- [ ] Apply accessible dialog behavior and unsaved-change confirmations to trade-editing flows; prevent global commands from firing within dialogs/select controls.
- [ ] Keep all theme selectors and desktop controls aligned at common desktop widths.
- [ ] Run focused tests, lint, build, and a connected-browser desktop smoke test; commit `feat: polish accessible desktop journal workflows`.

### Task 10: Firestore schema rules and two-account verification

**Files:**
- Modify: `firestore.rules`
- Create: `tests/firestore.rules.test.mts`
- Modify: `firebase.json` only if emulator configuration is required

**Interfaces:**
- Rules accept the optional canonical fields from Task 2 and remain owner-only.

- [ ] Write failing emulator tests for owner reads/writes, cross-user denial, invalid fields, invalid numeric values, oversized notes/tags/screenshots, and canonical optional fields.
- [ ] Run the emulator test and confirm it fails before rule/test setup is complete.
- [ ] Add only necessary optional canonical fields and validators to the default-deny rule set; do not loosen owner checks or size bounds.
- [ ] Validate the final rules source, run two-account emulator tests, and retrieve the deployed rules for comparison before deployment.
- [ ] Run focused tests, full suite, and build; commit `test: verify Firestore trade isolation and schema rules`.

### Task 11: Release quality, performance, and production verification

**Files:**
- Modify: `src/app/page.tsx` and heavy view imports as needed
- Modify: `src/app/layout.tsx`
- Modify: `README.md` or create `docs/operations/production-checklist.md`
- Test: `tests/updateNotice.test.mts`

**Interfaces:**
- Produces an update-available signal and documented backup/restore, alerting, App Check, and deployment procedures.

- [ ] Write failing tests for update-version comparison and privacy-safe error payload scrubbing.
- [ ] Run focused tests and confirm those behaviors are absent.
- [ ] Lazy-load noninitial heavy views, deduplicate client computations, and add a safe update-available notice.
- [ ] Add privacy-safe client error capture hooks only if a configured reporting destination exists; otherwise document the integration seam without transmitting data.
- [ ] Write the production checklist for backups/restore drills, deployment alerts, App Check report-only rollout, and owner-provided external configuration.
- [ ] Run all tests, lint, production build, security-rule validation, dependency audit, and desktop smoke tests; commit `chore: complete production readiness checks`.

## Self-review

- Spec coverage: Tasks 1–11 cover all seven releases and all audit categories; repeated top-100 requests are implemented through shared modules rather than duplicate UI features.
- Type consistency: Task 1 produces form-safe amounts consumed by Task 2; Task 2 produces normalized trades consumed by Tasks 3–5; Task 10 extends only optional fields created in Task 2.
- Review focus: Each listed high-risk input has an owning task and a named failing-test requirement.
- Scope: App Check enforcement and optional cloud wallet sync remain owner decisions because they require external configuration or a new data-sharing choice.

