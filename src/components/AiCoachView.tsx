"use client";

import { useState } from "react";
import { Trade, AiCoachBrief } from "../lib/types";
import { Bot, Sparkles, RefreshCw, AlertTriangle, ShieldCheck, TrendingDown, Target, HelpCircle } from "lucide-react";
import { DEFAULT_GOOD_TAGS } from "./LogTradeModal";

interface AiCoachViewProps {
  trades: Trade[];
  aiBrief: AiCoachBrief | null;
  onRefreshAiBrief: () => void;
  loadingAi: boolean;
}

export default function AiCoachView({
  trades,
  aiBrief,
  onRefreshAiBrief,
  loadingAi,
}: AiCoachViewProps) {
  const [customQuestion, setCustomQuestion] = useState("");
  const [customAnswer, setCustomAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim()) return;
    setAsking(true);
    setCustomAnswer(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trades: trades.slice(0, 10),
          customPrompt: customQuestion.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCustomAnswer(data.advice || "No response received.");
      } else {
        setCustomAnswer("Failed to connect to DeepSeek API. Please check your key.");
      }
    } catch (err) {
      setCustomAnswer("Error querying AI coach.");
    }
    setAsking(false);
  };

  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.result === "Win").length;
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(0) : "0";

  // Calculate most common mistake
  const mistakeCounts: Record<string, number> = {};
  trades.forEach((t) => {
    t.mistakes?.forEach((m) => {
      if (!DEFAULT_GOOD_TAGS.includes(m)) {
        mistakeCounts[m] = (mistakeCounts[m] || 0) + 1;
      }
    });
  });

  const sortedMistakes = Object.entries(mistakeCounts).sort((a, b) => b[1] - a[1]);
  const primaryTilt = sortedMistakes.length > 0 ? sortedMistakes[0][0] : "None detected yet";

  return (
    <div className="space-y-6 pb-16">
      {/* Title */}
      <div className="pt-6">
        <div className="flex items-center gap-2 text-xs text-[#787774] mb-2">
          <span>Journal</span>
          <span>/</span>
          <span className="text-[#37352f] font-medium flex items-center gap-1">
            <span>🧠</span>
            <span>Trade Review & AI Coach</span>
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧠</span>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#37352f]">
                AI Trade Review
              </h1>
              <p className="text-xs text-[#787774] mt-0.5">
                DeepSeek AI analyzes your win rate, execution discipline, and mistakes.
              </p>
            </div>
          </div>

          <button
            onClick={onRefreshAiBrief}
            disabled={loadingAi || trades.length === 0}
            className="bg-[#2383e2] hover:bg-[#1a73ca] text-white px-3.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loadingAi ? "animate-spin" : ""} />
            <span>{loadingAi ? "Analyzing..." : "Refresh AI Review"}</span>
          </button>
        </div>
      </div>

      {/* Snapshot Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-[#787774] mb-1">
            <Target size={14} className="text-[#2383e2]" />
            <span>Discipline Win Rate</span>
          </div>
          <div className="text-2xl font-bold text-[#37352f]">{winRate}%</div>
          <span className="text-[11px] text-[#9b9a97]">Across {totalTrades} logged trades</span>
        </div>

        <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-[#787774] mb-1">
            <AlertTriangle size={14} className="text-rose-500" />
            <span>Primary Tilt Trigger</span>
          </div>
          <div className="text-base font-semibold text-rose-700 truncate">{primaryTilt}</div>
          <span className="text-[11px] text-[#9b9a97]">
            {sortedMistakes.length > 0 ? `${sortedMistakes[0][1]} trades triggered this` : "Clean execution"}
          </span>
        </div>

        <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-[#787774] mb-1">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>AI Status</span>
          </div>
          <div className="text-base font-semibold text-emerald-700">DeepSeek Chat V3</div>
          <span className="text-[11px] text-[#9b9a97]">Cached (Only runs when requested)</span>
        </div>
      </div>

      {/* Coach Output Box */}
      <div className="bg-white border border-[#e9e9e7] rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#f1f1ef]">
          <div className="flex items-center gap-2 font-semibold text-sm text-[#37352f]">
            <Bot size={18} className="text-[#2383e2]" />
            <span>Coach's Direct Evaluation</span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            Live DeepSeek Analysis
          </span>
        </div>

        <div className="bg-[#fbfbfa] p-4 rounded-lg border border-[#e9e9e7] leading-relaxed text-xs text-[#37352f] whitespace-pre-line font-sans">
          {aiBrief?.advice ||
            "Click 'Refresh AI Review' above to send your recent trades and mistake tags to DeepSeek. Your AI coach will review your entries, sizing discipline, and exit timing."}
        </div>
      </div>

      {/* Interactive Question to AI Coach */}
      <div className="bg-white border border-[#e9e9e7] rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 font-semibold text-sm text-[#37352f]">
          <HelpCircle size={18} className="text-amber-500" />
          <span>Ask Your Trading Coach Anything</span>
        </div>
        <p className="text-xs text-[#787774]">
          Ask specific questions like "Why am I losing money on Tuesdays?" or "How can I stop chasing 50% green candles?"
        </p>

        <form onSubmit={handleAskQuestion} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              placeholder="e.g. Look at my trades and tell me what my worst habit is..."
              className="flex-1 bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-3 py-2 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
            />
            <button
              type="submit"
              disabled={asking || !customQuestion.trim()}
              className="px-4 py-2 bg-[#2383e2] hover:bg-[#1a73ca] text-white text-xs font-medium rounded-lg disabled:opacity-50 flex items-center gap-1.5 transition-colors"
            >
              {asking ? <RefreshCw size={13} className="animate-spin" /> : <span>Ask Coach</span>}
            </button>
          </div>
        </form>

        {customAnswer && (
          <div className="mt-4 p-4 bg-blue-50/50 border border-blue-200 rounded-lg text-xs text-[#37352f] leading-relaxed">
            <strong className="block text-blue-900 font-semibold mb-1">Coach's Answer:</strong>
            <p className="whitespace-pre-line">{customAnswer}</p>
          </div>
        )}
      </div>
    </div>
  );
}
