import { NextResponse } from 'next/server';

const requestBuckets = new Map<string, { startedAt: number; count: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;

export async function POST(request: Request) {
  try {
    const forwardedFor = request.headers.get('x-forwarded-for');
    const clientId = (forwardedFor?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown').slice(0, 80);
    const now = Date.now();
    const bucket = requestBuckets.get(clientId);
    if (!bucket || now - bucket.startedAt >= WINDOW_MS) {
      requestBuckets.set(clientId, { startedAt: now, count: 1 });
    } else {
      bucket.count += 1;
      if (bucket.count > MAX_REQUESTS_PER_WINDOW) {
        return NextResponse.json({ error: 'Too many AI requests. Please wait a minute and try again.' }, { status: 429 });
      }
    }
    if (requestBuckets.size > 2_000) {
      for (const [key, value] of requestBuckets) {
        if (now - value.startedAt >= WINDOW_MS) requestBuckets.delete(key);
      }
    }
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 200_000) {
      return NextResponse.json({ error: 'Analysis request is too large.' }, { status: 413 });
    }
    const body = await request.json().catch(() => ({}));
    const { trades, customPrompt, clientApiKey, provider = "deepseek" } = body;
    // Users may supply their own provider key; it is used only for this request and never stored.
    const apiKey = typeof clientApiKey === "string" && clientApiKey.trim().length > 0
      ? clientApiKey.trim().slice(0, 300)
      : null;
    if (!apiKey) {
      return NextResponse.json({ error: 'Add an API key for the selected provider before requesting an analysis.' }, { status: 401 });
    }

    const tradeList = Array.isArray(trades) ? trades.slice(0, 100) : [];

    // Quantitative calculations across all provided trades
    const totalTrades = tradeList.length;
    const wins = tradeList.filter((t) => t.result === 'Win');
    const losses = tradeList.filter((t) => t.result === 'Loss');
    const winRate = totalTrades > 0 ? ((wins.length / totalTrades) * 100).toFixed(1) : "0";
    const netPnlSol = tradeList.reduce((acc, t) => acc + (t.pnlSol || 0), 0).toFixed(2);

    // Count top mistakes
    const mistakeCounts: Record<string, number> = {};
    tradeList.forEach((t) => {
      if (Array.isArray(t.mistakes)) {
        t.mistakes.forEach((m: string) => {
          mistakeCounts[m] = (mistakeCounts[m] || 0) + 1;
        });
      }
    });
    const topMistakes = Object.entries(mistakeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([m, c]) => `${m} (${c}x)`)
      .join(', ') || 'None logged';

    // Sort by timestamp descending so the most recent trades are guaranteed first in sample
    const sortedTrades = [...tradeList].sort((a, b) => {
      const timeA = a.createdAt || (a.date?.seconds ? a.date.seconds * 1000 : 0);
      const timeB = b.createdAt || (b.date?.seconds ? b.date.seconds * 1000 : 0);
      return timeB - timeA;
    });

    const recentTradesSample = sortedTrades.slice(0, 15).map((t: any) => ({
      symbol: t.symbol,
      result: t.result,
      pnlSol: t.pnlSol,
      pnlUsd: t.pnlUsd,
      mistakes: t.mistakes,
      goodTags: t.goodTags,
      setup: t.setupType,
      notes: t.notes ? String(t.notes).slice(0, 200) : undefined,
    }));

    const quantitativeBrief = {
      totalTrades,
      winRate: `${winRate}%`,
      netPnlSol: `${netPnlSol} SOL`,
      topMistakes,
      recentSampleCount: recentTradesSample.length,
    };

    const tradesSummary = totalTrades > 0
      ? `QUANT STATS:\n${JSON.stringify(quantitativeBrief, null, 2)}\n\nRECENT TRADES:\n${JSON.stringify(recentTradesSample, null, 2)}`
      : "No trades logged yet.";

    const systemPrompt = `You are a professional, ruthless, and highly disciplined crypto memecoin trading coach (specializing in Solana dex trading, BullX, Axiom, and Photon).
Your job is to brutally point out emotional errors (FOMO, chasing green candles, overleveraging, moving stop losses, holding to zero) and enforce strict trade management rules.
Keep your response concise, actionable, and formatted with clean bullet points.
CRITICAL RULES:
- DO NOT use any emojis whatsoever.
- Write in a raw, conversational, no-bullshit tone. Do not sound like an AI.`;

    const sanitizedPrompt = customPrompt ? String(customPrompt).slice(0, 500) : null;

    const userPrompt = sanitizedPrompt
      ? `Trader Question: "${sanitizedPrompt}"\n\nTrader Quantitative Performance & Logs:\n${tradesSummary}`
      : `Analyze these memecoin trader statistics and recent trades, then provide:
1. Executive Assessment (1-2 sentences on current performance & discipline)
2. Primary Leak / Bad Habit (what is costing the most money)
3. Actionable Rule for Next Session

Trader Overview:
${tradesSummary}`;

    const selectedProvider = ["deepseek", "gemini", "openai"].includes(provider) ? provider : "deepseek";
    const endpoint = selectedProvider === "gemini"
      ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`
      : selectedProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.deepseek.com/chat/completions";
    const requestBody = selectedProvider === "gemini"
      ? { contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }] }
      : { model: selectedProvider === "openai" ? "gpt-4o-mini" : "deepseek-chat", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], temperature: 0.6, max_tokens: 1500 };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(selectedProvider === "gemini" ? {} : { 'Authorization': `Bearer ${apiKey}` }),
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deepseek API error:', errorText);
      return NextResponse.json({ error: `${selectedProvider} API returned error: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    const advice = selectedProvider === "gemini"
      ? data.candidates?.[0]?.content?.parts?.[0]?.text
      : data.choices?.[0]?.message?.content;

    return NextResponse.json({ advice });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json({ error: 'The AI provider timed out. Please try again.' }, { status: 504 });
    }
    console.error('Error fetching AI analysis:', error);
    return NextResponse.json({ error: 'Failed to fetch AI analysis' }, { status: 500 });
  }
}
