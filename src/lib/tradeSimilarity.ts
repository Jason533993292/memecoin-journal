import type { Trade } from "./types";

export interface SimilarTradeMatch {
  trade: Trade;
  score: number;
  reasons: string[];
}

export function findSimilarTrades(source: Trade, trades: Trade[], limit = 3): SimilarTradeMatch[] {
  const matches: SimilarTradeMatch[] = trades.filter((candidate) => candidate.id !== source.id).map((candidate) => {
    let score = 0;
    const reasons: string[] = [];
    if (source.ca && candidate.ca && source.ca.trim() === candidate.ca.trim()) { score += 5; reasons.push("same token"); }
    if (source.playbookId && candidate.playbookId === source.playbookId) { score += 3; reasons.push("same playbook"); }
    else if (source.setupType && candidate.setupType === source.setupType) { score += 3; reasons.push("same setup"); }
    if (source.result === candidate.result) { score += 1; reasons.push("same outcome"); }
    const sourceTags = new Set([...(source.goodTags ?? []), ...(source.mistakes ?? [])].map((tag) => tag.trim().toLowerCase()).filter(Boolean));
    const sharedTags = [...new Set([...(candidate.goodTags ?? []), ...(candidate.mistakes ?? [])].map((tag) => tag.trim().toLowerCase()).filter((tag) => sourceTags.has(tag)))];
    if (sharedTags.length) { score += Math.min(3, sharedTags.length); reasons.push(`${sharedTags.length} shared ${sharedTags.length === 1 ? "tag" : "tags"}`); }
    return { trade: candidate, score, reasons };
  });
  return matches.filter((match) => match.score >= 3).sort((a, b) => b.score - a.score || tradeTimestamp(b.trade) - tradeTimestamp(a.trade)).slice(0, Math.max(0, limit));
}

function tradeTimestamp(trade: Trade) {
  if (typeof trade.tradedAt === "number" && Number.isFinite(trade.tradedAt)) return trade.tradedAt;
  if (trade.date instanceof Date) return trade.date.getTime();
  if (typeof trade.date === "string" || typeof trade.date === "number") {
    const parsed = new Date(trade.date).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  return typeof trade.createdAt === "number" && Number.isFinite(trade.createdAt) ? trade.createdAt : 0;
}
