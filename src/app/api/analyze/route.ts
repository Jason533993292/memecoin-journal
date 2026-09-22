import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { trades, customPrompt } = await request.json();

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'DeepSeek API key is not configured.' }, { status: 500 });
    }

    const tradesSummary = trades && trades.length > 0 
      ? JSON.stringify(
          trades.slice(0, 10).map((t: any) => ({
            symbol: t.symbol,
            result: t.result,
            pnlSol: t.pnlSol,
            pnlUsd: t.pnlUsd,
            mistakes: t.mistakes,
            mcap: t.mcap,
            notes: t.notes,
          })),
          null,
          2
        )
      : "No trades logged yet.";

    const systemPrompt = `You are a professional, ruthless, and highly disciplined crypto memecoin trading coach (specializing in Solana dex trading, BullX, Axiom, and Photon).
Your job is to brutally point out emotional errors (FOMO, chasing green candles, overleveraging, moving stop losses, holding to zero) and enforce strict trade management rules.
Keep your response concise, actionable, and formatted with clean bullet points.`;

    const userPrompt = customPrompt
      ? `Trader Question: "${customPrompt}"\n\nRecent Trader Logs:\n${tradesSummary}`
      : `Analyze these recent memecoin trades and provide:
1. Executive Assessment (1-2 sentences on current performance & discipline)
2. Primary Leak / Bad Habit (what is costing the most money)
3. Actionable Rule for Next Session

Recent Trades:
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
        max_tokens: 350,
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
