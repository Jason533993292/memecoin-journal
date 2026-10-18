import type { Trade } from "./types";

const DAY = 24 * 60 * 60 * 1000;

const samples = [
  ["Bonk", "BONK", "Win", 1.84, 2.1, "Breakout", 42],
  ["dogwifhat", "WIF", "Win", 0.92, 1.4, "Pullback", 68],
  ["Popcat", "POPCAT", "Loss", -0.48, 1.0, "Momentum", 21],
  ["Fartcoin", "FARTCOIN", "Win", 2.36, 2.5, "Reclaim", 95],
  ["Peanut", "PNUT", "BE", 0, 0.8, "Range", 34],
  ["Goatseus Maximus", "GOAT", "Loss", -0.71, 1.2, "Breakout", 18],
  ["Moo Deng", "MOODENG", "Win", 0.64, 0.9, "Dip buy", 55],
  ["Book of Meme", "BOME", "Loss", -0.29, 0.7, "Momentum", 12],
  ["Myro", "MYRO", "Win", 1.12, 1.3, "Reversal", 77],
  ["Ponke", "PONKE", "Win", 0.43, 0.6, "Pullback", 31],
  ["Samoyedcoin", "SAMO", "Loss", -0.36, 0.8, "Range", 47],
  ["Cat in a dogs world", "MEW", "Win", 0.78, 1.0, "Breakout", 63],
] as const;

export function buildDemoTrades(now = Date.now()): Trade[] {
  return samples.map(([name, symbol, result, pnlSol, boughtSol, setupType, durationMinutes], index) => {
    const tradedAt = now - index * 2 * DAY - (index % 4) * 60 * 60 * 1000;
    const soldSol = Math.max(0, boughtSol + pnlSol);
    return {
      id: `demo-${index + 1}`,
      ca: `DemoContractAddress${String(index + 1).padStart(2, "0")}NotReal`,
      name,
      symbol,
      wallet: index % 3 === 0 ? "Trading wallet" : "Phantom Live",
      result,
      setupType,
      boughtSol,
      soldSol,
      pnlSol,
      boughtUsd: boughtSol * 150,
      soldUsd: soldSol * 150,
      pnlUsd: pnlSol * 150,
      mistakes: result === "Loss" ? [index % 2 ? "Chased entry" : "Ignored invalidation"] : [],
      goodTags: result === "Win" ? ["Followed plan", "Scaled out"] : result === "BE" ? ["Protected capital"] : [],
      notes: result === "Win"
        ? "Demo trade: waited for confirmation and followed the planned exits."
        : result === "Loss"
          ? "Demo trade: entry was late and the invalidation should have been respected sooner."
          : "Demo trade: reduced risk when follow-through disappeared.",
      durationMinutes,
      initialRiskSol: Math.min(0.25, boughtSol * 0.12),
      feesSol: 0.006 + index * 0.0004,
      tradeQualityScore: result === "Win" ? 84 - index : result === "BE" ? 72 : 48 + index,
      processGrade: result === "Win" ? (index % 3 === 0 ? "A" : "B") : result === "BE" ? "B" : (index % 2 ? "D" : "C"),
      confidenceAtEntry: result === "Win" ? 65 + (index % 4) * 8 : result === "BE" ? 55 : 70 + (index % 3) * 7,
      wouldTakeAgain: result !== "Loss",
      executionType: index % 2 ? "momentum" : "discretionary",
      tradeMode: "paper",
      quoteCurrency: "SOL",
      solUsdRate: 150,
      solUsdRateSource: "imported",
      tradedAt,
      createdAt: tradedAt,
      date: tradedAt,
    };
  });
}
