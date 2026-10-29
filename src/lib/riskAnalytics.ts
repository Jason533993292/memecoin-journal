import type { Trade } from "./types";

export interface RiskAnalytics {
  recordedRiskCount: number;
  averageInitialRiskSol: number;
  maxInitialRiskSol: number;
  riskBreachCount: number;
  totalFeesSol: number;
  totalCapitalDeployedSol: number;
  largestTradeSol: number;
  largestWallet: { name: string; amountSol: number; share: number } | null;
  largestToken: { name: string; amountSol: number; share: number } | null;
}

export function calculateRiskAnalytics(trades: Trade[]): RiskAnalytics {
  const risks = trades.map((trade) => trade.initialRiskSol).filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  const walletTotals = new Map<string, number>();
  const tokenTotals = new Map<string, { name: string; amountSol: number }>();
  let totalCapitalDeployedSol = 0;
  let totalFeesSol = 0;
  let largestTradeSol = 0;
  let riskBreachCount = 0;

  for (const trade of trades) {
    const deployed = Number.isFinite(trade.boughtSol) && trade.boughtSol > 0 ? trade.boughtSol : 0;
    totalCapitalDeployedSol += deployed;
    largestTradeSol = Math.max(largestTradeSol, deployed);
    totalFeesSol += Number.isFinite(trade.feesSol) && (trade.feesSol ?? 0) > 0 ? trade.feesSol ?? 0 : 0;
    if (typeof trade.initialRiskSol === "number" && trade.initialRiskSol > 0 && trade.pnlSol < -(trade.initialRiskSol * 1.05)) riskBreachCount += 1;

    const wallet = trade.wallet?.trim() || "Unassigned";
    walletTotals.set(wallet, (walletTotals.get(wallet) ?? 0) + deployed);
    const tokenKey = trade.ca?.trim() || `${trade.name}:${trade.symbol}`;
    const currentToken = tokenTotals.get(tokenKey) ?? { name: trade.name || trade.symbol || "Unknown token", amountSol: 0 };
    currentToken.amountSol += deployed;
    tokenTotals.set(tokenKey, currentToken);
  }

  const largestWalletEntry = [...walletTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  const largestTokenEntry = [...tokenTotals.values()].sort((a, b) => b.amountSol - a.amountSol)[0];
  const share = (amount: number) => totalCapitalDeployedSol > 0 ? (amount / totalCapitalDeployedSol) * 100 : 0;

  return {
    recordedRiskCount: risks.length,
    averageInitialRiskSol: risks.length ? risks.reduce((sum, value) => sum + value, 0) / risks.length : 0,
    maxInitialRiskSol: risks.length ? Math.max(...risks) : 0,
    riskBreachCount,
    totalFeesSol,
    totalCapitalDeployedSol,
    largestTradeSol,
    largestWallet: largestWalletEntry ? { name: largestWalletEntry[0], amountSol: largestWalletEntry[1], share: share(largestWalletEntry[1]) } : null,
    largestToken: largestTokenEntry ? { name: largestTokenEntry.name, amountSol: largestTokenEntry.amountSol, share: share(largestTokenEntry.amountSol) } : null,
  };
}
