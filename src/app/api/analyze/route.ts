import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { trades, customPrompt } = body;

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'DeepSeek API key is not configured.' }, { status: 500 });
    }

    const tradeList = Array.isArray(trades) ? trades : [];

    // Calculate quantitative performance context
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

    const recentTradesSample = tradeList.slice(0, 15).map((t: any) => ({
      symbol: t.symbol,
      result: t.result,
      pnlSol: t.pnlSol,
      pnlUsd: t.pnlUsd,
      mistakes: t.mistakes,
      setup: t.setupType,
      notes: t.notes,
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
Keep your response concise, actionable, and formatted with clean bullet points.`;

    const userPrompt = customPrompt
      ? `Trader Question: "${customPrompt}"\n\nTrader Quantitative Performance & Logs:\n${tradesSummary}`
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
        max_tokens: 380,
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
