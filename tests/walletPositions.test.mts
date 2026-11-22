import assert from "node:assert/strict";
import test from "node:test";
import { buildWalletPositions, type WalletEventLike } from "../src/lib/walletPositions.ts";

const MINT = "So11111111111111111111111111111111111111112";
let counter = 0;
function event(overrides: Partial<WalletEventLike> & Pick<WalletEventLike, "direction" | "block_time">): WalletEventLike {
  counter += 1;
  return { id: `id-${counter}`, wallet_link_id: "wallet-1", signature: `sig-${counter}`, event_index: 0, mint: MINT, sol_change: 0, token_change: 0, fee_sol: 0, status: "needs_review", source: "rpc", ...overrides };
}
const buy = (time: string, sol: number, tokens: number, extra: Partial<WalletEventLike> = {}) => event({ direction: "buy", block_time: time, sol_change: -sol, token_change: tokens, ...extra });
const sell = (time: string, sol: number, tokens: number, extra: Partial<WalletEventLike> = {}) => event({ direction: "sell", block_time: time, sol_change: sol, token_change: -tokens, ...extra });

test("a buy with no sell is an open position", () => {
  const [position] = buildWalletPositions([buy("2026-11-01T10:00:00Z", 1, 1000)]);
  assert.equal(position.status, "open");
  assert.equal(position.remainingTokens, 1000);
});

test("selling everything closes the position and computes totals", () => {
  const [position] = buildWalletPositions([buy("2026-11-01T10:00:00Z", 1, 1000), sell("2026-11-01T11:00:00Z", 3, 1000)]);
  assert.equal(position.status, "closed");
  assert.equal(position.boughtSol, 1);
  assert.equal(position.soldSol, 3);
  assert.equal(position.fills.length, 2);
});

test("a partial sell is NOT treated as an exit", () => {
  const [position] = buildWalletPositions([buy("2026-11-01T10:00:00Z", 1, 1000), sell("2026-11-01T11:00:00Z", 1, 400)]);
  assert.equal(position.status, "partial");
  assert.equal(position.remainingTokens, 600);
});

test("selling 99.5% counts as closed so token dust does not block an import", () => {
  const [position] = buildWalletPositions([buy("2026-11-01T10:00:00Z", 1, 1000), sell("2026-11-01T11:00:00Z", 2, 995)]);
  assert.equal(position.status, "closed");
});

test("two separate round trips in the same token are not merged", () => {
  const positions = buildWalletPositions([
    buy("2026-11-01T10:00:00Z", 1, 1000), sell("2026-11-01T11:00:00Z", 2, 1000),
    buy("2026-11-02T10:00:00Z", 5, 500), sell("2026-11-02T11:00:00Z", 4, 500),
  ]);
  assert.equal(positions.length, 2);
  assert.deepEqual(positions.map((p) => [p.boughtSol, p.soldSol]).sort(), [[1, 2], [5, 4]]);
});

test("adding to a position before it closes stays one position", () => {
  const [position, other] = buildWalletPositions([buy("2026-11-01T10:00:00Z", 1, 1000), buy("2026-11-01T10:30:00Z", 1, 1000), sell("2026-11-01T11:00:00Z", 5, 2000)]);
  assert.equal(other, undefined);
  assert.equal(position.boughtSol, 2);
  assert.equal(position.status, "closed");
});

test("a sell without any detected buy is exit_only, never a closed trade", () => {
  const [position] = buildWalletPositions([sell("2026-11-01T11:00:00Z", 3, 1000)]);
  assert.equal(position.status, "exit_only");
});

test("a dismissed buy stays in the position and reopens when the sell arrives", () => {
  const dismissedBuy = buy("2026-11-01T10:00:00Z", 1, 1000, { status: "ignored" });
  const [hidden] = buildWalletPositions([dismissedBuy]);
  assert.equal(hidden.dismissed, true);

  const [reopened] = buildWalletPositions([dismissedBuy, sell("2026-11-01T11:00:00Z", 3, 1000)]);
  assert.equal(reopened.dismissed, false);
  assert.equal(reopened.status, "closed");
  assert.equal(reopened.boughtSol, 1);
  assert.equal(reopened.soldSol, 3);
  assert.equal(reopened.eventIds.length, 2);
});

test("different wallets and different tokens never share a position", () => {
  const other = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const positions = buildWalletPositions([buy("2026-11-01T10:00:00Z", 1, 10), buy("2026-11-01T10:00:00Z", 1, 10, { wallet_link_id: "wallet-2" }), buy("2026-11-01T10:00:00Z", 1, 10, { mint: other })]);
  assert.equal(positions.length, 3);
});

test("transactions already in the journal are skipped, and transfers or unknown events are ignored", () => {
  const journaled = buy("2026-11-01T10:00:00Z", 1, 1000);
  const transfer = event({ direction: "transfer", block_time: "2026-11-01T10:30:00Z", token_change: 5 });
  const unknown = event({ direction: "unknown", block_time: "2026-11-01T10:31:00Z", mint: "" });
  assert.equal(buildWalletPositions([journaled, transfer, unknown], new Set([journaled.signature])).length, 0);
});
