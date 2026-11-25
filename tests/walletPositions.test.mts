import assert from "node:assert/strict";
import test from "node:test";
import { buildWalletPositions as group, type WalletEventLike } from "../src/lib/walletPositions.ts";

function buildWalletPositions(events: WalletEventLike[], saved = new Set<string>()) {
  const balances = new Map<string, number>();
  const receipts = [...events].sort((a,b) => a.block_time.localeCompare(b.block_time)).map(event => {
    const key = event.wallet_link_id + event.mint;
    const before = balances.get(key) ?? 0;
    const after = Math.max(0, before + event.token_change);
    balances.set(key, after);
    return { ...event, raw: { balanceBefore: before, balanceAfter: after, ...event.raw } };
  });
  return group(receipts, saved);
}
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

test("selling 99.5% leaves an open remainder", () => {
  const [position] = buildWalletPositions([buy("2026-11-01T10:00:00Z", 1, 1000), sell("2026-11-01T11:00:00Z", 2, 995)]);
  assert.equal(position.status, "partial");
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

// Decu6 public receipts, slots 471411992, 471412037, and 471412090.
// Each SOL amount here is the wallet balance delta including the fee.
test("real multi-buy exit needs the earlier purchase to determine its net SOL result", () => {
  const first = buy("2026-11-19T17:01:39Z", 3.016518840, 22858552.265451, { fee_sol: 0.000559405, signature: "37DBvwxmz7Eq9cPvo6DW6mPSScvSXrKkQh5KmRJMPuLNqkyXDAHguPVKhVmAmCkTBHM65eHCfhDAHAvhRci7nu9U" });
  const second = buy("2026-11-19T17:01:49Z", 0.265005, 1431211.795251, { raw: { balanceBefore: 22858552.265451, balanceAfter: 24289764.060702 }, fee_sol: 0.000509049, signature: "W3waGtVvcCpxLcsTHbYo2xpGM9EMDUKHBG9PK8K8ATDFNZbT8iCgkuSetBJzaB9H1JgHJM8eyYj9G15tpNamzyA" });
  const exit = sell("2026-11-19T17:02:01Z", 2.763566538, 24289764.060702, { fee_sol: 0.000215934, signature: "3Cvbs1jkce4EDq2afHeP1eECHi5qX8hWVfWW11DDia9PPMCzQBYgrr3DLQa9oBmhYLMSs4dSVqe8ygv7QsYbGRbQ" });
  assert.equal(buildWalletPositions([second, exit])[0].status, "exit_only");
  assert.equal(buildWalletPositions([first, second])[0].status, "open");
  const [full] = buildWalletPositions([exit, first, second]);
  assert.equal(full.status, "closed");
  assert.equal((full.soldSol - full.boughtSol - full.feesSol).toFixed(9), "-0.517957302");
  assert.deepEqual(buildWalletPositions([exit, first, second], new Set(full.signatures)), []);
});

test("same-slot buy precedes its partial exit even when the sell signature sorts first", () => {
  const time = "2026-11-25T21:43:15Z";
  const first = buy(time, 1, 100, {signature:"zzz", raw:{slot:123, balanceBefore:0, balanceAfter:100}});
  const second = sell(time, .3, 30, {signature:"aaa", raw:{slot:123, balanceBefore:100, balanceAfter:70}});
  const last = sell("2026-11-25T21:43:20Z", .8, 70, {raw:{slot:124, balanceBefore:70, balanceAfter:0}});
  const positions = group([last, second, first]);
  assert.equal(positions.length, 1);
  assert.equal(positions[0].status, "closed");
  assert.deepEqual(positions[0].signatures, [first.signature, second.signature, last.signature]);
});
