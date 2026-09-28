import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { trades, customPrompt, clientApiKey } = body;
    // Users may supply their own provider key; it is used only for this request and never stored.
    const apiKey = typeof clientApiKey === "string" && clientApiKey.trim().length > 0
      ? clientApiKey.trim().slice(0, 300)
      : process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'DeepSeek API key is not configured.' }, { status: 401 });
    }

    const tradeList = Array.isArray(trades) ? trades.slice(0, 500) : [];

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

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deepseek API error:', errorText);
      return NextResponse.json({ error: `DeepSeek API returned error: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    const advice = data.choices?.[0]?.message?.content || "Keep tracking your trades to unlock coach insights.";

    return NextResponse.json({ advice });
  } catch (error) {
    console.error('Error fetching AI analysis:', error);
    return NextResponse.json({ error: 'Failed to fetch AI analysis' }, { status: 500 });
  }
}
