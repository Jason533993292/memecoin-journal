import type { TradeFill } from "./types";

export type WalletEventLike = {
  id: string;
  wallet_link_id: string;
  signature: string;
  event_index: number;
  block_time: string;
  mint: string;
  direction: "buy" | "sell" | "transfer" | "unknown";
  sol_change: number;
  token_change: number;
  fee_sol: number;
  status: string;
  source: "rpc" | "webhook";
  raw?: { marketCapSampleAt?: number; executionMarketCapUsd?: number; token?: { name?: string; symbol?: string; marketCapUsd?: number | null } };
  wallet_links?: { label?: string; address?: string } | null;
};

/**
 * open        bought, nothing sold yet
 * partial     some of the tokens were sold, a meaningful amount is still held
 * closed      everything bought has been sold (within dust tolerance)
 * exit_only   a sell with no matching buy in the synced history
 */
export type PositionStatus = "open" | "partial" | "closed" | "exit_only";

export type WalletPosition = {
  key: string;
  walletLinkId: string;
  walletLabel: string;
  mint: string;
  tokenName: string;
  tokenSymbol: string;
  entryMarketCapUsd?: number;
  exitMarketCapUsd?: number;
  entrySampleAt?: number;
  exitSampleAt?: number;
  currentMarketCapUsd: number | null;
  eventIds: string[];
  signatures: string[];
  boughtSol: number;
  soldSol: number;
  tokensBought: number;
  tokensSold: number;
  remainingTokens: number;
  feesSol: number;
  entryAt: number;
  exitAt?: number;
  source: "sync" | "webhook";
  fills: TradeFill[];
  status: PositionStatus;
  /** Every event in this position was dismissed. New activity reopens it automatically. */
  dismissed: boolean;
};

/** Selling at least 99% of what was bought counts as closed, so token dust does not block an import. */
export const CLOSE_TOLERANCE = 0.01;

function isClosed(position: Pick<WalletPosition, "tokensBought" | "tokensSold">) {
  if (position.tokensBought <= 0 || position.tokensSold <= 0) return false;
  return position.tokensBought - position.tokensSold <= position.tokensBought * CLOSE_TOLERANCE;
}

function finalize(position: WalletPosition, statuses: string[]): WalletPosition {
  const remaining = Math.max(0, position.tokensBought - position.tokensSold);
  const status: PositionStatus = position.tokensBought <= 0 || position.tokensSold > position.tokensBought * (1 + 1e-10) ? "exit_only" : position.tokensSold <= 0 ? "open" : isClosed(position) ? "closed" : "partial";
  return { ...position, remainingTokens: remaining, status, dismissed: statuses.length > 0 && statuses.every((value) => value === "ignored") };
}

/**
 * Builds positions from every wallet event that is not yet in the journal.
 *
 * Dismissed events stay in the calculation. Hiding them only hides the finished position, so a
 * later sell still sees the original buy. When the token is bought again after a position closed,
 * a new round trip starts instead of merging two separate trades together.
 */
export function buildWalletPositions(events: WalletEventLike[], journaledSignatures: ReadonlySet<string> = new Set()): WalletPosition[] {
  const ordered = [...events]
    .filter((event) => (event.direction === "buy" || event.direction === "sell") && event.mint && !journaledSignatures.has(event.signature))
    .sort((a, b) => Date.parse(a.block_time) - Date.parse(b.block_time) || a.event_index - b.event_index || a.signature.localeCompare(b.signature));

  const finished: WalletPosition[] = [];
  const active = new Map<string, { position: WalletPosition; statuses: string[] }>();

  for (const event of ordered) {
    const groupKey = `${event.wallet_link_id}:${event.mint}`;
    const time = Date.parse(event.block_time);
    const fee = Number(event.fee_sol) || 0;
    const solChange = Number(event.sol_change) || 0;
    const tokenChange = Number(event.token_change) || 0;
    let entry = active.get(groupKey);

    if (entry && event.direction === "buy" && (isClosed(entry.position) || entry.position.tokensBought === 0)) {
      finished.push(finalize(entry.position, entry.statuses));
      active.delete(groupKey);
      entry = undefined;
    }

    if (!entry) {
      const token = event.raw?.token;
      entry = {
        statuses: [],
        position: {
          key: `${groupKey}:${event.id}`,
          walletLinkId: event.wallet_link_id,
          walletLabel: event.wallet_links?.label || "Linked wallet",
          mint: event.mint,
          tokenName: token?.name || "Solana token",
          tokenSymbol: token?.symbol || event.mint.slice(0, 5),
          currentMarketCapUsd: typeof token?.marketCapUsd === "number" ? token.marketCapUsd : null,
          eventIds: [], signatures: [], boughtSol: 0, soldSol: 0, tokensBought: 0, tokensSold: 0, remainingTokens: 0, feesSol: 0,
          entryAt: time, source: event.source === "webhook" ? "webhook" : "sync", fills: [], status: "open", dismissed: false,
        },
      };
      active.set(groupKey, entry);
    }

    const { position } = entry;
    const quoteAmount = event.direction === "buy" ? Math.max(0, -solChange - fee) : Math.max(0, solChange + fee);
    const fillId = event.id;
    if (event.direction === "buy") {
      if (!position.tokensBought) {
        position.entryMarketCapUsd = event.raw?.executionMarketCapUsd;
        position.entrySampleAt = event.raw?.marketCapSampleAt;
      }
      position.boughtSol += quoteAmount;
      position.tokensBought += Math.max(0, tokenChange);
      position.entryAt = Math.min(position.entryAt, time);
      position.fills.push({ id: fillId, side: "entry", quoteAmount, feeSol: fee, executedAt: time });
    } else {
      position.exitSampleAt = event.raw?.marketCapSampleAt;
      position.exitMarketCapUsd = event.raw?.executionMarketCapUsd;
      position.soldSol += quoteAmount;
      position.tokensSold += Math.max(0, -tokenChange);
      position.exitAt = Math.max(position.exitAt || 0, time);
      position.fills.push({ id: fillId, side: "exit", quoteAmount, feeSol: fee, executedAt: time });
    }
    position.feesSol += fee;
    position.eventIds.push(event.id);
    if (!position.signatures.includes(event.signature)) position.signatures.push(event.signature);
    if (event.source === "webhook") position.source = "webhook";
    entry.statuses.push(event.status);
  }

  for (const entry of active.values()) finished.push(finalize(entry.position, entry.statuses));
  return finished.sort((a, b) => (b.exitAt || b.entryAt) - (a.exitAt || a.entryAt));
}
