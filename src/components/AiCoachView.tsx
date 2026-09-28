"use client";

import { useState, useEffect, useMemo } from "react";
import { Trade, AiCoachBrief } from "../lib/types";
import { Bot, Sparkles, RefreshCw, AlertTriangle, ShieldCheck, Target, HelpCircle, Eye, EyeOff, KeyRound } from "lucide-react";
import { DEFAULT_GOOD_TAGS } from "../lib/constants";
import { getTradeTimestamp } from "../lib/utils";

interface AiCoachViewProps {
  trades: Trade[];
  aiBrief: AiCoachBrief | null;
  onRefreshAiBrief: () => void;
  loadingAi: boolean;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c)
  );
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
  const [apiKey, setApiKey] = useState("");
  const [isApiKeySet, setIsApiKeySet] = useState(true);
  const [showKey, setShowKey] = useState(false);

  // Load API key from local storage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem("ai_provider_api_key") || localStorage.getItem("deepseek_local_key");
    if (storedKey) {
      setApiKey(storedKey);
    } else {
      setIsApiKeySet(false);
    }
  }, []);

  const saveApiKey = async () => {
    if (apiKey.trim()) {
    localStorage.setItem("ai_provider_api_key", apiKey.trim());
      setIsApiKeySet(true);
    }
  };

  const resetApiKey = () => {
    localStorage.removeItem("ai_provider_api_key");
    setApiKey("");
    setIsApiKeySet(false);
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim()) return;
    setAsking(true);
    setCustomAnswer(null);

    // Ensure trades are sorted descending by timestamp before sampling
    const sortedTrades = [...trades].sort((a, b) => getTradeTimestamp(b) - getTradeTimestamp(a));

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trades: sortedTrades.slice(0, 15),
          customPrompt: customQuestion.trim(),
          clientApiKey: apiKey,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCustomAnswer(data.advice || "No response received.");
      } else {
        const errData = await res.json().catch(() => ({}));
        setCustomAnswer(errData.error || "Failed to connect to the AI provider. Check that your API key matches the configured provider.");
      }
    } catch (err) {
      setCustomAnswer("Error querying AI coach.");
    }
    setAsking(false);
  };

  const { totalTrades, winRate, primaryTilt, sortedMistakes } = useMemo(() => {
    const total = trades.length;
    const wins = trades.filter((t) => t.result === "Win").length;
    const wr = total > 0 ? ((wins / total) * 100).toFixed(0) : "0";

    const mistakeCounts: Record<string, number> = {};
    trades.forEach((t) => {
      t.mistakes?.forEach((m) => {
        if (!DEFAULT_GOOD_TAGS.includes(m)) {
          mistakeCounts[m] = (mistakeCounts[m] || 0) + 1;
        }
      });
    });

    const sorted = Object.entries(mistakeCounts).sort((a, b) => b[1] - a[1]);
    const tilt = sorted.length > 0 ? sorted[0][0] : "None detected yet";

    return { totalTrades: total, winRate: wr, primaryTilt: tilt, sortedMistakes: sorted };
  }, [trades]);

  const renderFormattedText = (text: string) => {
    if (!text) return null;
    const escaped = escapeHtml(text);
    const html = escaped
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[#37352f]">$1</strong>')
      .replace(/### (.*?)\n/g, '<strong class="block text-sm mt-2 mb-1">$1</strong>\n')
      .replace(/## (.*?)\n/g, '<strong class="block text-base mt-3 mb-1">$1</strong>\n')
      .replace(/# (.*?)\n/g, '<strong class="block text-lg mt-4 mb-2">$1</strong>\n');
    return <div dangerouslySetInnerHTML={{ __html: html }} className="whitespace-pre-line font-sans" />;
  };

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
                AI analysis reviews your win rate, execution discipline, and mistakes.
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

        <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#787774] mb-1">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>AI Status</span>
            </div>
            <div className="text-base font-semibold text-emerald-700">DeepSeek Chat V3</div>
          </div>
          {isApiKeySet && (
            <button
              onClick={resetApiKey}
              className="mt-2 self-start flex items-center gap-1 text-[10px] text-amber-600 hover:text-amber-700 font-medium px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 transition-colors border border-amber-200"
            >
              <KeyRound size={10} />
              <span>Reset API Key</span>
            </button>
          )}
        </div>
      </div>

      {/* API Key Setup Box */}
      {!isApiKeySet && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 shadow-xs space-y-3">
          <div className="flex items-center gap-2 font-semibold text-sm text-rose-900">
            <AlertTriangle size={18} />
            <span>Set up an AI provider API key</span>
          </div>
          <p className="text-xs text-rose-700 leading-relaxed">
              Add an API key to unlock the AI coach. It is stored locally in your browser and sent only when you request an analysis. The current endpoint uses DeepSeek-compatible chat API keys; a Google/Gemini key needs a Gemini endpoint integration first.
          </p>
          <div className="flex gap-2 pt-2">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-white border border-rose-200 rounded-lg px-3 py-2 pr-10 text-xs text-[#37352f] focus:outline-none focus:border-rose-400"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-rose-400 hover:text-rose-600 p-1"
                title={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button
              onClick={saveApiKey}
              disabled={!apiKey.trim()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              Save Key Locally
            </button>
          </div>
        </div>
      )}

      {/* Coach Output Box */}
      <div className="bg-white border border-[#e9e9e7] rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#f1f1ef]">
          <div className="flex items-center gap-2 font-semibold text-sm text-[#37352f]">
            <Bot size={18} className="text-[#2383e2]" />
            <span>Coach's Direct Evaluation</span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            Live AI Analysis
          </span>
        </div>

        <div className="bg-[#fbfbfa] p-4 rounded-lg border border-[#e9e9e7] leading-relaxed text-xs text-[#37352f] whitespace-pre-line font-sans">
          {aiBrief?.advice ? (
            renderFormattedText(aiBrief.advice)
          ) : (
            "Click 'Refresh AI Review' above to send your recent trades and mistake tags to the configured AI provider. Your coach will review your entries, sizing discipline, and exit timing."
          )}
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
            {renderFormattedText(customAnswer)}
          </div>
        )}
      </div>
    </div>
  );
}
