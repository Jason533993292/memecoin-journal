# Production Readiness Design

## Goal

Make the journal safe and dependable for other users without breaking existing accounts or changing the desktop-first product direction.

## Design

Data portability becomes lossless: CSV downloads use Blob URLs, JSON backup/restore preserves every supported trade field, imports retain the original trade time, validate the complete file before one atomic batch write, reject oversized files, and never substitute all trades when a filter has zero results.

Trade calculations use stored values first. New trades record their SOL/USD conversion rate and trade time; legacy trades remain readable and are explicitly treated as estimates when only a current price is available. Loading no longer silently stops at 1,000 trades.

Authentication gains password reset and email verification controls. AI keys remain user-scoped in browser storage, with session-only and explicit removal options. Account deletion remains server-authorized and retryable, with progress/error copy that never claims more deletion than the server confirms.

Public market-data requests validate the Solana chain and requested token address and ignore stale responses. SOL-price responses identify cached/stale data and expose their update time. Security headers are introduced with CSP reporting first so Firebase and provider traffic can be observed before enforcement.

Desktop accessibility fixes use native buttons and accessible names for heatmap controls. Terminal theme colors must keep cards and statistics readable. Existing good tags participate in journal badges, statistics, and daily recaps.

## Compatibility and safety

- Existing Firestore trade documents remain valid; all new fields are optional.
- No migration rewrites historical data.
- Imports are limited to 500 trades per atomic Firestore batch.
- User data remains under `/users/{uid}` and the current owner-only rules.
- Tests cover data round trips, calculation fallbacks, address parsing, and theme behavior.

