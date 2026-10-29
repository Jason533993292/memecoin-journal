"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import { Trade, AiCoachBrief, ResearchItem } from "../lib/types";
import { Bot, RefreshCw, AlertTriangle, ShieldCheck, Target, HelpCircle, Eye, EyeOff, KeyRound } from "lucide-react";
import { DEFAULT_GOOD_TAGS } from "../lib/constants";
import { getTradeTimestamp } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import {
  readSessionStorageValue,
  removeSessionStorageValue,
  useLocalStorageValue,
  writeLocalStorageValue,
  writeSessionStorageValue,
} from "../lib/useLocalStorage";
import { useToast } from "./Toast";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { listSupabaseResearch, usesSupabaseJournal } from "@/lib/journalBackend";
import BetaBadge from "./BetaBadge";
import {
  AI_PROVIDER_KEY_HINTS,
  AI_PROVIDER_LABELS,
  AiProvider,
  getAiProviderKeyError,
} from "@/lib/aiProvider";
import { decryptBrowserSecret, encryptBrowserSecret, isEncryptedBrowserSecret } from "@/lib/browserEncryption";

interface AiCoachViewProps {
  trades: Trade[];
  aiBrief: AiCoachBrief | null;
  onRefreshAiBrief: (provider: AiProvider, apiKey: string) => void;
  loadingAi: boolean;
}

function renderInlineMarkup(value: string): ReactNode[] {
  return value.split(/(\*\*[^*]{1,500}\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index} className="font-bold text-[#37352f]">{part.slice(2, -2)}</strong>
      : part,
  );
}

export default function AiCoachView({
  trades,
  aiBrief,
  onRefreshAiBrief,
  loadingAi,
}: AiCoachViewProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [customQuestion, setCustomQuestion] = useState("");
  const [customAnswer, setCustomAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [research, setResearch] = useState<ResearchItem[]>([]);
  const [rememberKey, setRememberKey] = useState(false);
  const [encryptionPassphrase, setEncryptionPassphrase] = useState("");
  const [unlockPassphrase, setUnlockPassphrase] = useState("");
  const [unlockedApiKey, setUnlockedApiKey] = useState("");
  const [keyOperationBusy, setKeyOperationBusy] = useState(false);
  const apiKeyStorageKey = user ? "ai_" + user.uid + "_provider_api_key" : "ai_signed_out_provider_api_key";
  const providerStorageKey = user ? "ai_" + user.uid + "_provider" : "ai_signed_out_provider";
  const savedApiKey = useLocalStorageValue(apiKeyStorageKey);
  const [sessionApiKey, setSessionApiKey] = useState(() =>
    readSessionStorageValue(apiKeyStorageKey) || ""
  );
  const savedProvider = useLocalStorageValue(providerStorageKey);
  const [providerOverride, setProviderOverride] = useState<AiProvider | null>(null);
  const provider: AiProvider =
    providerOverride ||
    (savedProvider === "gemini" || savedProvider === "openai" ? savedProvider : "deepseek");
  const effectiveSavedProvider = savedProvider === "gemini" || savedProvider === "openai"
    ? savedProvider
    : "deepseek";
  const hasEncryptedKey = isEncryptedBrowserSecret(savedApiKey);
  const legacyLocalApiKey = savedApiKey && !hasEncryptedKey ? savedApiKey : "";
  const savedKeyForSession = sessionApiKey || unlockedApiKey || legacyLocalApiKey || "";
  const hasStoredKey = Boolean(sessionApiKey || savedApiKey || unlockedApiKey);
  const providerChanged = Boolean(hasStoredKey && effectiveSavedProvider !== provider);
  const apiKey = apiKeyDraft || (providerChanged ? "" : savedKeyForSession);
  const isApiKeySet = Boolean(savedKeyForSession);
  const savedKeyError = savedKeyForSession
    ? getAiProviderKeyError(effectiveSavedProvider, savedKeyForSession)
    : null;
  const isProviderReady = isApiKeySet && !providerChanged && !savedKeyError;
  const providerLabel = AI_PROVIDER_LABELS[provider];

  useEffect(() => {
    let active = true;
    if (!user) return;
    const loadResearch = async () => {
      try {
        const entries = usesSupabaseJournal()
          ? await listSupabaseResearch(user.uid)
          : (await getDocs(collection(db, "users", user.uid, "research"))).docs.map((entry) => entry.data() as ResearchItem);
        if (active) setResearch(entries.slice(0, 20));
      } catch {
        // AI Coach remains usable from trade history even if research is offline.
      }
    };
    void loadResearch();
    return () => { active = false; };
  }, [user]);

  const saveProviderSettings = async () => {
    const nextKey = apiKeyDraft.trim();
    if (!user) return;
    if ((providerChanged || !savedKeyForSession) && !nextKey) {
      showToast("Add a key for this provider", "error", "The key you saved for another provider cannot be reused.");
      return;
    }
    const keyToValidate = nextKey || savedKeyForSession;
    const keyError = getAiProviderKeyError(provider, keyToValidate);
    if (keyError) {
      showToast(`${providerLabel} key does not match`, "error", keyError);
      return;
    }
    let keySaved = true;
    if (nextKey) {
      if (rememberKey) {
        if (encryptionPassphrase.length < 8) {
          showToast("Choose a stronger encryption passphrase", "error", "Use at least 8 characters. The passphrase is never stored and cannot be recovered.");
          return;
        }
        setKeyOperationBusy(true);
        try {
          const encryptedKey = await encryptBrowserSecret(nextKey, encryptionPassphrase);
          keySaved = writeLocalStorageValue(apiKeyStorageKey, encryptedKey);
          keySaved = removeSessionStorageValue(apiKeyStorageKey) && keySaved;
          setSessionApiKey("");
          setUnlockedApiKey(nextKey);
          setEncryptionPassphrase("");
        } catch (error) {
          showToast("API key could not be encrypted", "error", error instanceof Error ? error.message : "Try a different passphrase.");
          return;
        } finally {
          setKeyOperationBusy(false);
        }
      } else {
        keySaved = writeSessionStorageValue(apiKeyStorageKey, nextKey);
        setSessionApiKey(nextKey);
        keySaved = writeLocalStorageValue(apiKeyStorageKey, null) && keySaved;
      }
    }
    const providerSaved = writeLocalStorageValue(providerStorageKey, provider);
    if (!keySaved || !providerSaved) {
      showToast("API key could not be saved", "error", "Browser storage may be disabled or full.");
      return;
    }
    setApiKeyDraft("");
    setProviderOverride(null);
    showToast(
      rememberKey ? `${providerLabel} key encrypted on this device` : `${providerLabel} key saved for this tab session`,
      "success"
    );
  };

  const unlockSavedKey = async () => {
    if (!savedApiKey || !hasEncryptedKey) return;
    setKeyOperationBusy(true);
    try {
      const unlocked = await decryptBrowserSecret(savedApiKey, unlockPassphrase);
      const keyError = getAiProviderKeyError(effectiveSavedProvider, unlocked);
      if (keyError) throw new Error(keyError);
      setUnlockedApiKey(unlocked);
      setUnlockPassphrase("");
      showToast("Encrypted API key unlocked", "success", "It is available in memory until this page is closed or refreshed.");
    } catch (error) {
      showToast("Could not unlock API key", "error", error instanceof Error ? error.message : "Check your passphrase and try again.");
    } finally {
      setKeyOperationBusy(false);
    }
  };

  const resetApiKey = () => {
    const localRemoved = writeLocalStorageValue(apiKeyStorageKey, null);
    const sessionRemoved = removeSessionStorageValue(apiKeyStorageKey);
    if (!localRemoved || !sessionRemoved) {
      showToast("Could not clear the saved API key", "error", "Check your browser storage settings and try again.");
      return;
    }
    setSessionApiKey("");
    setUnlockedApiKey("");
    setUnlockPassphrase("");
    setEncryptionPassphrase("");
    setApiKeyDraft("");
    showToast("Saved API key removed", "success");
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !customQuestion.trim()) return;
    if (providerChanged || !apiKey) {
      showToast("Save your AI provider settings first", "error", "Select a provider and add its matching API key.");
      return;
    }
    setAsking(true);
    setCustomAnswer(null);

    // Ensure trades are sorted descending by timestamp before sampling
    const sortedTrades = [...trades].sort((a, b) => getTradeTimestamp(b) - getTradeTimestamp(a));

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          trades: sortedTrades.slice(0, 15).map((trade) => ({
            symbol: trade.symbol,
            result: trade.result,
            pnlSol: trade.pnlSol,
            pnlUsd: trade.pnlUsd,
            mistakes: trade.mistakes,
            goodTags: trade.goodTags,
            setupType: trade.setupType,
            createdAt: trade.createdAt,
            date: trade.date,
          })),
          research: research.slice(0, 5).map((item) => ({
            name: item.name,
            symbol: item.symbol,
            stage: item.stage,
            thesis: item.thesis,
            bullCase: item.bullCase,
            bearCase: item.bearCase,
            invalidation: item.invalidation,
            confidence: item.confidence,
            tags: item.tags,
          })),
          customPrompt: customQuestion.trim(),
          clientApiKey: apiKey,
          provider,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCustomAnswer(data.advice || "No response received.");
      } else {
        const errData = await res.json().catch(() => ({}));
        setCustomAnswer(errData.error || "Failed to connect to the AI provider. Check that your API key matches the configured provider.");
      }
    } catch {
      setCustomAnswer("Error querying AI coach.");
    } finally {
      setAsking(false);
    }
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
    const lines = text.slice(0, 12_000).split("\n").slice(0, 180);
    return (
      <div className="space-y-1.5 font-sans">
        {lines.map((rawLine, index) => {
          const line = rawLine.trim();
          if (!line) return <div key={index} className="h-1" aria-hidden="true" />;
          const heading = line.match(/^(#{1,3})\s+(.+)$/);
          if (heading) {
            const size = heading[1].length === 1 ? "text-base mt-4" : heading[1].length === 2 ? "text-sm mt-3" : "text-xs mt-2";
            return <h3 key={index} className={`${size} font-bold text-[#37352f]`}>{renderInlineMarkup(heading[2])}</h3>;
          }
          const bullet = line.match(/^[-*]\s+(.+)$/);
          if (bullet) return <div key={index} className="flex gap-2"><span aria-hidden="true">•</span><p>{renderInlineMarkup(bullet[1])}</p></div>;
          const numbered = line.match(/^(\d{1,2})[.)]\s+(.+)$/);
          if (numbered) return <div key={index} className="flex gap-2"><span className="font-mono text-[#787774]">{numbered[1]}.</span><p>{renderInlineMarkup(numbered[2])}</p></div>;
          return <p key={index}>{renderInlineMarkup(line)}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="journal-page">
      {/* Title */}
      <div data-tour="ai-overview" className="pt-6">
        <div className="flex items-center gap-2 text-xs text-[#787774] mb-2">
          <span>Journal</span>
          <span>/</span>
          <span className="text-[#37352f] font-medium">Trade Review &amp; AI Coach</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-[#37352f]">AI Trade Review</h1>
                <BetaBadge />
              </div>
              <p className="text-xs text-[#787774] mt-0.5">
                AI analysis reviews your win rate, execution discipline, and mistakes.
              </p>
            </div>
          </div>

          <button
            onClick={() => onRefreshAiBrief(provider, apiKey)}
            disabled={loadingAi || trades.length === 0 || !isProviderReady}
            title={!isProviderReady ? "Save a provider API key before requesting a review" : undefined}
            className="bg-[#1a73ca] hover:bg-[#155fa8] text-white px-3.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loadingAi ? "animate-spin" : ""} />
            <span>{loadingAi ? "Analyzing..." : "Refresh AI Review"}</span>
          </button>
        </div>
      </div>

      {/* Snapshot Cards */}
      <div data-tour="ai-snapshot" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-[#787774] mb-1">
            <Target size={14} className="text-[#2383e2]" />
            <span>Win Rate</span>
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
              <ShieldCheck size={14} className={isProviderReady ? "text-emerald-600" : "text-[#9b9a97]"} />
              <span>AI Status</span>
            </div>
            <div className={`text-base font-semibold ${isProviderReady ? "text-emerald-700" : "text-[#787774]"}`}>
              {isProviderReady ? `${providerLabel} configured` : "Not configured"}
            </div>
          </div>
          {hasStoredKey && (
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
      {(
        <div data-tour="ai-provider-settings" className={`border rounded-xl p-6 shadow-xs space-y-3 ${isProviderReady ? "bg-[#fbfbfa] border-[#e9e9e7]" : "bg-rose-50 border-rose-200"}`}>
          <div className={`flex items-center gap-2 font-semibold text-sm ${isProviderReady ? "text-[#37352f]" : "text-rose-900"}`}>
            <AlertTriangle size={18} />
            <span>{isProviderReady ? "AI provider settings" : "Set up an AI provider API key"}</span>
          </div>
          <p className={`text-xs leading-relaxed ${isProviderReady ? "text-[#787774]" : "text-rose-700"}`}>
              Session-only keys stay in this browser tab. If you choose persistent storage, the key is encrypted in this browser with your passphrase. The passphrase is never stored. Keys are sent over HTTPS only when you request analysis, forwarded to your selected provider, and not intentionally stored by the app.
          </p>
          <div className="space-y-2 pt-2">
            <div>
              <label className="sr-only" htmlFor="ai-provider">AI provider</label>
              <select id="ai-provider" value={provider} onChange={(e) => {
                setApiKeyDraft("");
                setProviderOverride(e.target.value as AiProvider);
              }} className="w-full bg-white border border-rose-200 rounded-lg px-3 py-2 text-xs text-[#37352f] focus:outline-none focus:border-rose-400">
                <option value="deepseek">DeepSeek</option>
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
              <input
                aria-label="Provider API key"
                type={showKey ? "text" : "password"}
                value={apiKeyDraft || (providerChanged ? "" : savedKeyForSession)}
                onChange={(e) => setApiKeyDraft(e.target.value)}
                maxLength={300}
                placeholder={provider === "gemini" ? "AIza..." : "sk-..."}
                className="w-full bg-white border border-rose-200 rounded-lg px-3 py-2 pr-10 text-xs text-[#37352f] focus:outline-none focus:border-rose-400"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                title={showKey ? "Hide key" : "Show key"}
                aria-label={showKey ? "Hide API key" : "Show API key"}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              </div>
            </div>
            <p className="text-[11px] text-[#787774]">
              {AI_PROVIDER_KEY_HINTS[provider]} Keys are checked for the selected provider before they are saved.
            </p>
            {savedKeyError && !providerChanged && !apiKeyDraft && (
              <p role="alert" className="text-[11px] font-medium text-rose-700">
                The saved key does not match {AI_PROVIDER_LABELS[effectiveSavedProvider]}. Enter the correct key and save again.
              </p>
            )}
            {hasEncryptedKey && !unlockedApiKey && !sessionApiKey && !apiKeyDraft && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-[11px] font-semibold text-blue-900">An encrypted {AI_PROVIDER_LABELS[effectiveSavedProvider]} key is saved on this device.</p>
                <div className="mt-2 flex gap-2"><input aria-label="Encryption passphrase" type="password" value={unlockPassphrase} onChange={(event) => setUnlockPassphrase(event.target.value)} maxLength={256} placeholder="Enter passphrase to unlock" className="min-w-0 flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-[#37352f]"/><button type="button" disabled={keyOperationBusy || unlockPassphrase.length < 8} onClick={() => void unlockSavedKey()} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Unlock</button></div>
              </div>
            )}
            {legacyLocalApiKey && <p role="alert" className="text-[11px] font-medium text-amber-700">This key was saved by an older version without encryption. Enter it again, enable encrypted persistence below, and save to upgrade it.</p>}
            <button
              type="button"
              onClick={() => void saveProviderSettings()}
              disabled={keyOperationBusy || !apiKey.trim() || (providerChanged && !apiKeyDraft.trim())}
              className="provider-save-button px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              Save Provider Settings
            </button>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-[#787774]">
            <input
              type="checkbox"
              checked={rememberKey}
              onChange={(event) => setRememberKey(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-[#c9c7c2]"
            />
            Keep this key encrypted after I close the browser (off keeps it for this tab session only)
          </label>
          {rememberKey && <div className="rounded-lg border border-[#e3e2de] bg-white p-3"><label className="block text-[11px] font-semibold text-[#37352f]">Encryption passphrase<input aria-label="New encryption passphrase" type="password" value={encryptionPassphrase} onChange={(event) => setEncryptionPassphrase(event.target.value)} minLength={8} maxLength={256} autoComplete="new-password" placeholder="At least 8 characters" className="mt-1.5 w-full rounded-lg border border-[#e3e2de] px-3 py-2 text-xs"/></label><p className="mt-1.5 text-[10px] text-[#787774]">This passphrase never leaves the browser and cannot be recovered. You will enter it after each refresh to unlock the key.</p></div>}
        </div>
      )}

      {/* Coach Output Box */}
      <div data-tour="ai-analysis" className="bg-white border border-[#e9e9e7] rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#f1f1ef]">
          <div className="flex items-center gap-2 font-semibold text-sm text-[#37352f]">
            <Bot size={18} className="text-[#2383e2]" />
            <span>Coach&apos;s Direct Evaluation</span>
          </div>
          <span className={`text-[11px] px-2 py-0.5 rounded border ${aiBrief?.advice ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-neutral-50 text-[#787774] border-[#e3e2de]"}`}>
            {aiBrief?.advice ? "Latest AI Analysis" : "No analysis yet"}
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
      <div data-tour="ai-question" className="bg-white border border-[#e9e9e7] rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 font-semibold text-sm text-[#37352f]">
          <HelpCircle size={18} className="text-amber-500" />
          <span>Ask Your Trading Coach Anything</span>
        </div>
        <p className="text-xs text-[#787774]">
          Ask specific questions like &quot;Why am I losing money on Tuesdays?&quot; or &quot;How can I stop chasing 50% green candles?&quot;
        </p>

        <form onSubmit={handleAskQuestion} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              aria-label="Ask the AI coach"
              placeholder="e.g. Look at my trades and tell me what my worst habit is..."
              className="flex-1 bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-3 py-2 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
            />
            <button
              type="submit"
              disabled={asking || !customQuestion.trim() || !apiKey || providerChanged}
              className="px-4 py-2 bg-[#1a73ca] hover:bg-[#155fa8] text-white text-xs font-medium rounded-lg disabled:opacity-50 flex items-center gap-1.5 transition-colors"
            >
              {asking ? <RefreshCw size={13} className="animate-spin" /> : <span>Ask Coach</span>}
            </button>
          </div>
        </form>

        {customAnswer && (
          <div className="mt-4 p-4 bg-blue-50/50 border border-blue-200 rounded-lg text-xs text-[#37352f] leading-relaxed">
            <strong className="block text-blue-900 font-semibold mb-1">Coach&apos;s Answer:</strong>
            {renderFormattedText(customAnswer)}
          </div>
        )}
      </div>
    </div>
  );
}
