# Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the audit's remaining production-critical data, auth, security, reliability, and desktop accessibility work.

**Architecture:** Keep the existing Next.js/Firebase structure, add pure helpers for data parsing and calculation decisions, and make UI components consume those helpers. Changes remain backward-compatible with legacy Firestore documents.

**Tech Stack:** Next.js 16, React 19, TypeScript, Firebase Auth/Firestore, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-01-production-readiness-design.md`

## Global Constraints

- Preserve existing user documents and owner-only Firestore isolation.
- Desktop UI is the priority; do not expand mobile scope.
- Never persist or log raw AI keys outside the selected browser storage mode.
- Keep imports within Firestore's 500-write batch limit.
- Use test-first changes for pure data behavior.

## Review Focus

- CSV notes containing `#`, commas, quotes, and formula prefixes must round-trip safely.
- A zero-value USD field must remain historical data, not be replaced by an estimate.
- Invalid import row 500 must prevent every write, not create a partial import.
- A slow token response for an old address must not overwrite the current address.
- Cached SOL prices must not be labelled live.

---

### Task 1: Lossless import and export

**Files:** `src/lib/exportImport.ts`, `src/components/TradeJournalView.tsx`, `tests/exportImport.test.mts`

**Interfaces:** Produces `parseTradeImport(text, format)` and Blob-based CSV/JSON downloads.

- [ ] Add failing round-trip, date-preservation, invalid-file, and field-completeness tests.
- [ ] Implement complete validation and serialization.
- [ ] Commit imports in one Firestore batch and expose CSV plus JSON actions.
- [ ] Run the focused and full test suites.

### Task 2: Historical calculations and complete history

**Files:** `src/lib/tradeCalculations.ts`, `src/app/page.tsx`, analytics components, `tests/tradeCalculations.test.mts`

**Interfaces:** Produces `getTradePnlUsd`, `getTradeBoughtUsd`, `getTradeSoldUsd`, and `summarizeTrades`.

- [ ] Add failing stored-rate/current-estimate/zero-value tests.
- [ ] Implement shared helpers and consume them in dashboards/charts/recaps.
- [ ] Remove the silent 1,000-document query ceiling.
- [ ] Run focused tests and production build.

### Task 3: Auth and AI-key safety

**Files:** `src/lib/firebase.ts`, `src/context/AuthContext.tsx`, `src/components/AuthModal.tsx`, `src/components/AiCoachView.tsx`

**Interfaces:** Adds password reset, verification email, session-only key storage, key removal, and clear-on-sign-out.

- [ ] Add the Firebase Auth operations to context with actionable status messages.
- [ ] Add recovery/verification controls to the existing auth UI.
- [ ] Add AI-key retention controls without sending keys anywhere except the selected request.
- [ ] Type-check and manually inspect signed-out states.

### Task 4: API correctness and security headers

**Files:** `src/app/api/token/[ca]/route.ts`, `src/app/api/sol-price/route.ts`, `src/components/LogTradeModal.tsx`, `src/components/TopBanner.tsx`, `next.config.ts`

**Interfaces:** Token selection matches Solana mint; price responses include `status` and `ageMs`.

- [ ] Add pure tests for token-pair selection and price freshness.
- [ ] Ignore stale client lookups and label cached prices accurately.
- [ ] Add missing response headers and a report-only CSP.
- [ ] Run tests and production build.

### Task 5: Desktop theme, tags, and accessibility

**Files:** `src/app/globals.css`, `src/components/StatisticsView.tsx`, `src/components/DailyRecapModal.tsx`, `src/components/TimeOfDayHeatmap.tsx`

**Interfaces:** Existing trade/tag interfaces only.

- [ ] Include `goodTags` in every tag aggregate.
- [ ] Convert heatmap cells to keyboard-operable buttons with full accessible labels.
- [ ] Repair Terminal card backgrounds/text contrast.
- [ ] Run lint and build.

### Task 6: Dependency and release verification

**Files:** `package.json`, `package-lock.json`, relevant tests.

**Interfaces:** Uses a patched Next.js release compatible with React 19 and removes unused Prisma packages.

- [ ] Upgrade Next.js and matching ESLint config to a patched release.
- [ ] Remove unused Prisma dependencies and postinstall hook.
- [ ] Run tests, lint, dependency audit, and production build.
- [ ] Publish verified changes and confirm the Vercel production deployment.

