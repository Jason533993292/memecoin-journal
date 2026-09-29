import { NextResponse } from "next/server";
import {
  consumeUserRateLimits,
  FirebaseAdminConfigurationError,
  readBoundedJson,
  verifyFirebaseUser,
} from "../../../lib/firebase-admin";

export const maxDuration = 35;

const MAX_BODY_BYTES = 200_000;
const PROVIDERS = ["deepseek", "gemini", "openai"] as const;
type Provider = (typeof PROVIDERS)[number];

type InputTrade = {
  symbol?: unknown;
  result?: unknown;
  pnlSol?: unknown;
  pnlUsd?: unknown;
  mistakes?: unknown;
  goodTags?: unknown;
  setupType?: unknown;
  createdAt?: unknown;
  date?: { seconds?: unknown } | string | number;
};

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringList(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .slice(0, maxItems)
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean);
}

function getTimestamp(trade: InputTrade) {
  if (typeof trade.createdAt === "number" && Number.isFinite(trade.createdAt)) {
    return trade.createdAt;
  }
  if (typeof trade.date === "number") return trade.date;
  if (typeof trade.date === "string") return Date.parse(trade.date) || 0;
  if (
    trade.date &&
    typeof trade.date === "object" &&
    typeof trade.date.seconds === "number"
  ) {
    return trade.date.seconds * 1000;
  }
  return 0;
}

function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && PROVIDERS.includes(value as Provider);
}

export async function POST(request: Request) {
  let decodedToken;
  try {
    decodedToken = await verifyFirebaseUser(request);
  } catch (error) {
    const configurationError = error instanceof FirebaseAdminConfigurationError;
    return NextResponse.json(
      {
        error: configurationError
          ? "AI analysis is temporarily unavailable. The app's server configuration needs attention."
          : "Your sign-in has expired. Sign in again and retry.",
      },
      { status: configurationError ? 503 : 401 }
    );
  }
  if (!decodedToken) {
    return NextResponse.json({ error: "Sign in to request an AI analysis." }, { status: 401 });
  }

  try {
    const allowed = await consumeUserRateLimits(decodedToken.uid, "analyze", [
      { key: "minute", limit: 8, durationMs: 60_000 },
      { key: "day", limit: 50, durationMs: 86_400_000 },
    ]);
    if (!allowed) {
      return NextResponse.json(
        { error: "AI request limit reached. Please try again later." },
        { status: 429 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "AI analysis is temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  const parsed = await readBoundedJson(request, MAX_BODY_BYTES);
  if ("error" in parsed) {
    const tooLarge = parsed.error === "too_large";
    return NextResponse.json(
      { error: tooLarge ? "Analysis request is too large." : "Invalid request body." },
      { status: tooLarge ? 413 : 400 }
    );
  }

  const body = parsed.data;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { trades, customPrompt, clientApiKey, provider } = body as Record<string, unknown>;
  if (!isProvider(provider)) {
    return NextResponse.json({ error: "Select a supported AI provider." }, { status: 400 });
  }

  const apiKey = typeof clientApiKey === "string" ? clientApiKey.trim() : "";
  if (
    apiKey.length < 8 ||
    /[\u0000-\u001f\u007f]/.test(apiKey)
  ) {
    return NextResponse.json(
      { error: "Enter a valid API key for the selected provider." },
      { status: 400 }
    );
  }

  const tradeList = Array.isArray(trades)
    ? (trades.slice(0, 100) as InputTrade[])
    : [];
  const wins = tradeList.filter((trade) => trade.result === "Win");
  const losses = tradeList.filter((trade) => trade.result === "Loss");
  const netPnlSol = tradeList.reduce((total, trade) => total + finiteNumber(trade.pnlSol), 0);
  const mistakeCounts = new Map<string, number>();
  tradeList.forEach((trade) => {
    stringList(trade.mistakes, 20, 80).forEach((mistake) => {
      mistakeCounts.set(mistake, (mistakeCounts.get(mistake) || 0) + 1);
    });
  });
  const topMistakes =
    [...mistakeCounts.entries()]
      .sort((first, second) => second[1] - first[1])
      .slice(0, 3)
      .map(([mistake, count]) => mistake + " (" + count + "x)")
      .join(", ") || "None logged";

  const recentTradesSample = [...tradeList]
    .sort((first, second) => getTimestamp(second) - getTimestamp(first))
    .slice(0, 15)
    .map((trade) => ({
      symbol: text(trade.symbol, 30),
      result: trade.result === "Win" || trade.result === "Loss" || trade.result === "BE"
        ? trade.result
        : "Unknown",
      pnlSol: finiteNumber(trade.pnlSol),
      pnlUsd: finiteNumber(trade.pnlUsd),
      mistakes: stringList(trade.mistakes, 20, 80),
      goodTags: stringList(trade.goodTags, 20, 80),
      setup: text(trade.setupType, 80),
    }));

  const totalTrades = tradeList.length;
  const quantitativeBrief = {
    totalTrades,
    winRate: totalTrades ? ((wins.length / totalTrades) * 100).toFixed(1) + "%" : "0%",
    lossCount: losses.length,
    netPnlSol: netPnlSol.toFixed(2) + " SOL",
    topMistakes,
    recentSampleCount: recentTradesSample.length,
  };
  const tradesSummary = totalTrades
    ? "QUANT STATS:\n" +
      JSON.stringify(quantitativeBrief, null, 2) +
      "\n\nRECENT TRADES:\n" +
      JSON.stringify(recentTradesSample, null, 2)
    : "No trades logged yet.";

  const systemPrompt =
    "You are a professional, disciplined Solana memecoin trading coach. " +
    "Identify emotional errors, risk-management issues, and repeatable lessons. " +
    "Keep the response concise and actionable, use plain language, and do not promise profits.";
  const question = text(customPrompt, 500);
  const userPrompt = question
    ? "Trader question: " + question + "\n\nTrader statistics and recent trades:\n" + tradesSummary
    : "Review the statistics and recent trades. Give an executive assessment, the primary leak or bad habit, and one actionable rule for the next session.\n\n" +
      tradesSummary;

  const endpoint =
    provider === "gemini"
      ? "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
      : provider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.deepseek.com/chat/completions";
  const requestBody =
    provider === "gemini"
      ? {
          contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
          generationConfig: { maxOutputTokens: 1500, temperature: 0.6 },
        }
      : {
          model: provider === "openai" ? "gpt-4o-mini" : "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.6,
          max_tokens: 1500,
        };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(provider === "gemini"
          ? { "x-goog-api-key": apiKey }
          : { Authorization: "Bearer " + apiKey }),
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json(
        { error: "The AI provider timed out. Please try again." },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "Could not reach the selected AI provider." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // Never log the upstream body: provider error messages may echo credential material.
    console.warn("AI provider request failed", { provider, status: response.status });
    return NextResponse.json(
      {
        error:
          response.status === 401 || response.status === 403
            ? "The provider rejected this API key. Check that it belongs to the selected provider."
            : "The selected AI provider could not complete the request. Please try again.",
      },
      { status: 502 }
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return NextResponse.json(
      { error: "The AI provider returned an unreadable response." },
      { status: 502 }
    );
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return NextResponse.json(
      { error: "The AI provider returned an unreadable response." },
      { status: 502 }
    );
  }
  const providerData = data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const advice =
    provider === "gemini"
      ? providerData.candidates?.[0]?.content?.parts?.[0]?.text
      : providerData.choices?.[0]?.message?.content;
  if (typeof advice !== "string" || !advice.trim()) {
    return NextResponse.json(
      { error: "The AI provider returned no analysis." },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { advice: advice.slice(0, 12_000) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
