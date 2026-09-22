"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import {
  X,
  Search,
  Loader2,
  Check,
  Plus,
  AlertCircle,
  ShieldCheck,
  AlertTriangle,
  Wallet as WalletIcon,
  Tag,
  Image as ImageIcon,
  Clock,
  Trash2,
  Upload,
  Layers,
} from "lucide-react";
import { Trade } from "../lib/types";
import { useToast } from "./Toast";

export const DEFAULT_GOOD_TAGS = [
  "Followed Rules Perfectly",
  "Good Entry on Pullback",
  "Took Initial at 2x",
  "Respected Stop Loss",
  "Trailing Stop Hit",
  "Waited for Consolidation",
  "Safe Position Sizing",
  "Secured Moonbag",
];

export const DEFAULT_MISTAKE_TAGS = [
  "FOMO / Chased Pump",
  "Revenge Trade",
  "Oversized Position",
  "Held Too Long / Greed",
  "Early Exit / Panic Sell",
  "No Stop Loss",
  "Averaged Down on Red",
  "Traded Low Liquidity",
  "Dev Rug / Dump",
  "Tilted / Overtraded",
];

export const COMMON_SETUPS = [
  "Breakout / ATH Push",
  "Dip Buy / Support Bounce",
  "Narrative / Meta Play",
  "Dev Buy / Fresh Launch",
  "CT / KOL Call",
  "Volume Spike / Momentum",
  "Pump.fun Migration",
  "Raydium Reversal",
  "Whale Accumulation",
];

export const DURATION_PRESETS = [
  { label: "< 1m (Scalp)", value: 1 },
  { label: "5m", value: 5 },
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "4h", value: 240 },
  { label: "1d (Swing)", value: 1440 },
];

interface LogTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTradeLogged: () => void;
  solPrice?: number;
}

export default function LogTradeModal({
  isOpen,
  onClose,
  onTradeLogged,
  solPrice = 150,
}: LogTradeModalProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [ca, setCa] = useState("");
  const [loadingToken, setLoadingToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const [tokenData, setTokenData] = useState<{
    name: string;
    symbol: string;
    priceUsd: string;
    marketCap: number;
    liquidity: number;
    imageUrl?: string;
  } | null>(null);

  // Trade fields
  const [wallet, setWallet] = useState("Main");
  const [result, setResult] = useState<"Win" | "Loss" | "BE">("Win");
  const [setupType, setSetupType] = useState<string>("Breakout / ATH Push");
  const [customSetup, setCustomSetup] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number | undefined>(15);

  // Financial fields
  const [boughtSol, setBoughtSol] = useState("");
  const [boughtUsd, setBoughtUsd] = useState("");
  const [soldSol, setSoldSol] = useState("");
  const [soldUsd, setSoldUsd] = useState("");
  const [pnlSol, setPnlSol] = useState("");
  const [pnlUsd, setPnlUsd] = useState("");
  const [currencyMode, setCurrencyMode] = useState<"SOL" | "USD">("SOL");

  // Screenshot / Chart attachment
  const [screenshotUrl, setScreenshotUrl] = useState<string>("");
  const [isPastingImage, setIsPastingImage] = useState(false);

  // Tags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [customTagPool, setCustomTagPool] = useState<string[]>([]);

  const [notes, setNotes] = useState("");

  // Load user's custom tags from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("memecoin_journal_custom_tags");
      if (saved) setCustomTagPool(JSON.parse(saved));
    } catch (e) {}
  }, []);

  // Global Clipboard Paste Listener for screenshots
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                setScreenshotUrl(event.target.result as string);
                showToast("Chart screenshot pasted from clipboard!", "success");
              }
            };
            reader.readAsDataURL(blob);
          }
          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen, showToast]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCa("");
      setTokenData(null);
      setWallet("Main");
      setResult("Win");
      setSetupType("Breakout / ATH Push");
      setCustomSetup("");
      setDurationMinutes(15);
      setBoughtSol("");
      setBoughtUsd("");
      setSoldSol("");
      setSoldUsd("");
      setPnlSol("");
      setPnlUsd("");
      setCurrencyMode("SOL");
      setScreenshotUrl("");
      setSelectedTags([]);
      setCustomTagInput("");
      setNotes("");
      setFetchError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const fetchTokenData = async (contractAddress = ca) => {
    const cleanCa = contractAddress.trim();
    if (!cleanCa) return;
    setLoadingToken(true);
    setFetchError("");

    let found = false;

    // 1. Try server API route
    try {
      const res = await fetch(`/api/token/${cleanCa}`);
      if (res.ok) {
        const data = await res.json();
        setTokenData(data);
        showToast("Token found", "info", `${data.name} ($${data.symbol})`);
        found = true;
      }
    } catch (e) {
      console.warn("Server token fetch failed, trying direct client fetch:", e);
    }

    // 2. Direct client-side DexScreener fallback
    if (!found) {
      try {
        const directRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${cleanCa}`);
        if (directRes.ok) {
          const directData = await directRes.json();
          if (directData.pairs && directData.pairs.length > 0) {
            const sorted = [...directData.pairs].sort(
              (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
            );
            const best = sorted[0];
            const directObj = {
              name: best.baseToken.name || "Unknown Token",
              symbol: best.baseToken.symbol || "MEME",
              priceUsd: best.priceUsd || "0",
              marketCap: best.marketCap || best.fdv || 0,
              liquidity: best.liquidity?.usd || 0,
              imageUrl: best.info?.imageUrl || null,
            };
            setTokenData(directObj);
            showToast("Token found via DexScreener", "info", `${directObj.name} ($${directObj.symbol})`);
            found = true;
          }
        }
      } catch (clientErr) {
        console.error("Client direct fetch failed:", clientErr);
      }
    }

    if (!found) {
      setFetchError("Token not found on DexScreener. Check contract address or paste name manually.");
    }
    setLoadingToken(false);
  };

  const handleCaChange = (val: string) => {
    setCa(val);
    if (val.trim().length >= 32 && val.trim().length <= 44) {
      fetchTokenData(val.trim());
    }
  };

  const recalculatePnl = (inSol: number, outSol: number) => {
    if (!isNaN(inSol) && !isNaN(outSol)) {
      const diffSol = outSol - inSol;
      const diffUsd = diffSol * solPrice;

      setPnlSol(diffSol.toFixed(3));
      setPnlUsd(diffUsd.toFixed(2));

      if (diffSol > 0.005) setResult("Win");
      else if (diffSol < -0.005) setResult("Loss");
      else setResult("BE");
    }
  };

  const switchCurrencyMode = (newMode: "SOL" | "USD") => {
    if (newMode === currencyMode) return;
    
    // User wants the visual number to STAY the same, just change its unit.
    if (newMode === "USD") {
      if (boughtSol) handleBoughtChange(boughtSol, false);
      if (soldSol) handleSoldChange(soldSol, false);
      if (pnlSol) handlePnlChange(pnlSol, false);
    } else {
      if (boughtUsd) handleBoughtChange(boughtUsd, true);
      if (soldUsd) handleSoldChange(soldUsd, true);
      if (pnlUsd) handlePnlChange(pnlUsd, true);
    }
    setCurrencyMode(newMode);
  };

  const handleBoughtChange = (val: string, isSol: boolean) => {
    const num = parseFloat(val);
    if (isSol) {
      setBoughtSol(val);
      if (!isNaN(num)) {
        setBoughtUsd((num * solPrice).toFixed(2));
        recalculatePnl(num, parseFloat(soldSol) || 0);
      } else setBoughtUsd("");
    } else {
      setBoughtUsd(val);
      if (!isNaN(num)) {
        const solVal = (num / solPrice).toFixed(3);
        setBoughtSol(solVal);
        recalculatePnl(parseFloat(solVal), parseFloat(soldSol) || 0);
      } else setBoughtSol("");
    }
  };

  const handleSoldChange = (val: string, isSol: boolean) => {
    const num = parseFloat(val);
    if (isSol) {
      setSoldSol(val);
      if (!isNaN(num)) {
        setSoldUsd((num * solPrice).toFixed(2));
        recalculatePnl(parseFloat(boughtSol) || 0, num);
      } else setSoldUsd("");
    } else {
      setSoldUsd(val);
      if (!isNaN(num)) {
        const solVal = (num / solPrice).toFixed(3);
        setSoldSol(solVal);
        recalculatePnl(parseFloat(boughtSol) || 0, parseFloat(solVal));
      } else setSoldSol("");
    }
  };

  const handlePnlChange = (val: string, isSol: boolean) => {
    const num = parseFloat(val);
    if (isSol) {
      setPnlSol(val);
      if (!isNaN(num)) {
        setPnlUsd((num * solPrice).toFixed(2));
        if (num > 0.005) setResult("Win");
        else if (num < -0.005) setResult("Loss");
        else setResult("BE");
      } else setPnlUsd("");
    } else {
      setPnlUsd(val);
      if (!isNaN(num)) {
        const solVal = (num / solPrice).toFixed(3);
        setPnlSol(solVal);
        const nSol = parseFloat(solVal);
        if (nSol > 0.005) setResult("Win");
        else if (nSol < -0.005) setResult("Loss");
        else setResult("BE");
      } else setPnlSol("");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast("Image is too large. Please use under 2MB.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setScreenshotUrl(event.target.result as string);
        showToast("Chart screenshot attached!", "success");
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomTag = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    const clean = customTagInput.trim();
    if (!clean) return;

    if (!selectedTags.includes(clean)) {
      setSelectedTags((prev) => [...prev, clean]);
    }
    if (!customTagPool.includes(clean)) {
      const updatedPool = [...customTagPool, clean];
      setCustomTagPool(updatedPool);
      try {
        localStorage.setItem("memecoin_journal_custom_tags", JSON.stringify(updatedPool));
      } catch (err) {}
    }
    setCustomTagInput("");
    showToast(`Added tag "${clean}"`, "success");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenData && !ca) {
      alert("Please enter a valid Contract Address or Token Name.");
      return;
    }

    setSaving(true);
    try {
      const parsedPnlSol = parseFloat(pnlSol) || 0;
      const parsedPnlUsd = parseFloat(pnlUsd) || parsedPnlSol * solPrice;
      const parsedBoughtSol = parseFloat(boughtSol) || 0;
      const parsedBoughtUsd = parseFloat(boughtUsd) || parsedBoughtSol * solPrice;
      const parsedSoldSol = parseFloat(soldSol) || parsedBoughtSol + parsedPnlSol;
      const parsedSoldUsd = parseFloat(soldUsd) || parsedSoldSol * solPrice;

      const finalSetup = customSetup.trim() || setupType;

      await addDoc(collection(db, "trades"), {
        ca: ca.trim(),
        name: tokenData?.name || "Custom Token",
        symbol: tokenData?.symbol || "MEME",
        wallet,
        result,
        setupType: finalSetup,
        durationMinutes: durationMinutes || null,
        screenshotUrl: screenshotUrl || null,
        mcap: tokenData?.marketCap || 0,
        liquidity: tokenData?.liquidity || 0,
        price: parseFloat(tokenData?.priceUsd || "0") || 0,
        boughtSol: parsedBoughtSol,
        boughtUsd: parsedBoughtUsd,
        soldSol: parsedSoldSol,
        soldUsd: parsedSoldUsd,
        pnlSol: parsedPnlSol,
        pnlUsd: parsedPnlUsd,
        mistakes: selectedTags,
        notes: notes.trim(),
        date: serverTimestamp(),
        createdAt: Date.now(),
      });

      showToast(
        "Trade saved to Cloud",
        "success",
        `${tokenData?.name || "Token"} logged (${parsedPnlSol >= 0 ? "+" : ""}${parsedPnlSol} SOL)`
      );
      onTradeLogged();
      onClose();
    } catch (error: any) {
      console.error("Error adding trade document:", error);
      showToast("Error saving trade to Firestore", "error");
    }
    setSaving(false);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-[#e9e9e7] rounded-2xl p-4 sm:p-6 w-full max-w-xl shadow-xl relative my-6 text-[#37352f] max-h-[92vh] overflow-y-auto"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#9b9a97] hover:text-[#37352f] transition-colors p-1.5 rounded-lg hover:bg-[#f1f1ef]"
        >
          <X size={18} />
        </button>

        {/* Modal Title */}
        <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#f1f1ef]">
          <span className="text-xl">📓</span>
          <div>
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-[#37352f]">
              Log New Trade
            </h2>
            <p className="text-xs text-[#787774]">
              Record entry, chart screenshot, setup strategy & discipline tags.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Contract Address Input */}
          <div>
            <label className="block font-medium text-[#787774] mb-1.5 flex items-center justify-between">
              <span>Solana Contract Address (CA)</span>
              <span className="text-[11px] text-[#2383e2]">Autofetches via DexScreener</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={ca}
                onChange={(e) => handleCaChange(e.target.value)}
                placeholder="Paste Solana token mint address (e.g. 95pCcNPexz8...)"
                className="flex-1 bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-3 py-2 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2] focus:bg-white transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => fetchTokenData()}
                disabled={loadingToken || !ca}
                className="px-3 py-2 bg-[#f1f1ef] hover:bg-[#e6e5e3] rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 text-[#37352f] font-medium shrink-0"
              >
                {loadingToken ? (
                  <Loader2 size={14} className="animate-spin text-[#2383e2]" />
                ) : (
                  <Search size={14} />
                )}
              </button>
            </div>
            {fetchError && (
              <p className="text-rose-600 text-[11px] mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {fetchError}
              </p>
            )}
          </div>

          {/* Token Preview Card */}
          {tokenData && (
            <div className="p-3 bg-[#f7f6f3] border border-[#e9e9e7] rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-bold text-emerald-600 text-xs shrink-0">
                  {tokenData.symbol.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-[#37352f] text-xs sm:text-sm">
                    {tokenData.name} <span className="text-[#787774] font-normal">(${tokenData.symbol})</span>
                  </div>
                  <div className="text-[11px] text-[#787774] flex gap-2 sm:gap-3 mt-0.5">
                    <span>MCap: ${(tokenData.marketCap || 0).toLocaleString()}</span>
                    <span>Liq: ${(tokenData.liquidity || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] text-[#787774] block">Current Price</span>
                <span className="font-mono font-medium text-xs">${tokenData.priceUsd}</span>
              </div>
            </div>
          )}

          {/* Setup Type Selector */}
          <div>
            <label className="block font-medium text-[#787774] mb-1.5 flex items-center gap-1">
              <Layers size={12} className="text-[#2383e2]" />
              <span>Setup Strategy / Play</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COMMON_SETUPS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSetupType(s);
                    setCustomSetup("");
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border ${
                    setupType === s && !customSetup
                      ? "bg-blue-50 border-[#2383e2] text-[#2383e2] font-semibold shadow-xs"
                      : "bg-[#fbfbfa] border-[#e3e2de] text-[#5a5957] hover:bg-[#f1f1ef]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={customSetup}
              onChange={(e) => setCustomSetup(e.target.value)}
              placeholder="Or type custom setup (e.g. Cat Meta, Twitter Spaces Call)..."
              className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
            />
          </div>

          {/* Trade Duration Tracker */}
          <div>
            <label className="block font-medium text-[#787774] mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Clock size={12} className="text-amber-600" />
                <span>Trade Duration (Holding Time)</span>
              </span>
              <span className="text-[10px] text-[#9b9a97]">
                {durationMinutes ? `${durationMinutes} minutes` : "Not specified"}
              </span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDurationMinutes(d.value)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border ${
                    durationMinutes === d.value
                      ? "bg-amber-50 border-amber-400 text-amber-900 font-semibold shadow-xs"
                      : "bg-[#fbfbfa] border-[#e3e2de] text-[#5a5957] hover:bg-[#f1f1ef]"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chart Screenshot Attachment (Upload / Paste Cmd+V / URL) */}
          <div>
            <label className="block font-medium text-[#787774] mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <ImageIcon size={12} className="text-purple-600" />
                <span>Chart Screenshot Attachment</span>
              </span>
              <span className="text-[10px] text-purple-600 font-medium">Tip: Press Cmd+V / Ctrl+V to paste screenshot</span>
            </label>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />

            {screenshotUrl ? (
              <div className="relative rounded-xl border border-[#e3e2de] overflow-hidden bg-neutral-900 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshotUrl}
                  alt="Chart Preview"
                  className="w-full h-36 object-contain bg-black/60"
                />
                <button
                  type="button"
                  onClick={() => setScreenshotUrl("")}
                  className="absolute top-2 right-2 p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-md transition-colors text-xs flex items-center gap-1"
                >
                  <Trash2 size={12} />
                  <span>Remove</span>
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-4 border-2 border-dashed border-[#e3e2de] hover:border-[#2383e2] rounded-xl bg-[#fbfbfa] text-center cursor-pointer transition-colors space-y-1.5"
              >
                <div className="flex justify-center text-[#787774]">
                  <Upload size={18} />
                </div>
                <div className="text-xs font-semibold text-[#37352f]">
                  Upload Chart Screenshot or Paste Image (Cmd+V)
                </div>
                <p className="text-[10px] text-[#9b9a97]">
                  Supports PNG, JPG, WebP from BullX, Axiom, DexScreener (max 2MB)
                </p>
              </div>
            )}
          </div>

          {/* Quick Result Selector Buttons */}
          <div>
            <label className="block font-medium text-[#787774] mb-1.5">Trade Result</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setResult("Win")}
                className={`py-2 px-3 rounded-lg border text-center font-medium transition-all flex items-center justify-center gap-1.5 ${
                  result === "Win"
                    ? "bg-emerald-50 border-emerald-400 text-emerald-700 shadow-xs"
                    : "bg-[#fbfbfa] border-[#e3e2de] text-[#787774] hover:bg-[#f1f1ef]"
                }`}
              >
                <span>🏆</span>
                <span>Win</span>
              </button>
              <button
                type="button"
                onClick={() => setResult("BE")}
                className={`py-2 px-3 rounded-lg border text-center font-medium transition-all flex items-center justify-center gap-1.5 ${
                  result === "BE"
                    ? "bg-neutral-100 border-neutral-400 text-neutral-800 shadow-xs"
                    : "bg-[#fbfbfa] border-[#e3e2de] text-[#787774] hover:bg-[#f1f1ef]"
                }`}
              >
                <span>⚖️</span>
                <span>Breakeven</span>
              </button>
              <button
                type="button"
                onClick={() => setResult("Loss")}
                className={`py-2 px-3 rounded-lg border text-center font-medium transition-all flex items-center justify-center gap-1.5 ${
                  result === "Loss"
                    ? "bg-rose-50 border-rose-400 text-rose-700 shadow-xs"
                    : "bg-[#fbfbfa] border-[#e3e2de] text-[#787774] hover:bg-[#f1f1ef]"
                }`}
              >
                <span>💥</span>
                <span>Loss</span>
              </button>
            </div>
          </div>

          {/* Currency Toggle & Financial Fields */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-medium text-[#787774]">
                Financials (1 SOL = ${solPrice.toFixed(2)})
              </label>

              <div className="flex items-center gap-1 bg-[#f1f1ef] p-0.5 rounded-md text-[11px]">
                <button
                  type="button"
                  onClick={() => switchCurrencyMode("SOL")}
                  className={`px-2 py-0.5 rounded font-medium transition-all ${
                    currencyMode === "SOL" ? "bg-white text-[#37352f] shadow-xs" : "text-[#787774]"
                  }`}
                >
                  Enter in SOL
                </button>
                <button
                  type="button"
                  onClick={() => switchCurrencyMode("USD")}
                  className={`px-2 py-0.5 rounded font-medium transition-all ${
                    currencyMode === "USD" ? "bg-white text-[#37352f] shadow-xs" : "text-[#787774]"
                  }`}
                >
                  Enter in USD ($)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className="block font-medium text-[#787774] mb-1">
                  Bought {currencyMode === "SOL" ? "(SOL)" : "(USD $)"}
                </label>
                {currencyMode === "SOL" ? (
                  <div>
                    <input
                      type="number"
                      step="0.001"
                      value={boughtSol}
                      onChange={(e) => handleBoughtChange(e.target.value, true)}
                      placeholder="e.g. 1.5"
                      className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
                    />
                    <span className="text-[10px] text-[#9b9a97] block mt-0.5">
                      {boughtUsd ? `≈ $${boughtUsd}` : "Entry size"}
                    </span>
                  </div>
                ) : (
                  <div>
                    <input
                      type="number"
                      step="1"
                      value={boughtUsd}
                      onChange={(e) => handleBoughtChange(e.target.value, false)}
                      placeholder="e.g. 250"
                      className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
                    />
                    <span className="text-[10px] text-[#9b9a97] block mt-0.5">
                      {boughtSol ? `≈ ${boughtSol} SOL` : "Entry size"}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-medium text-[#787774] mb-1">
                  Sold {currencyMode === "SOL" ? "(SOL)" : "(USD $)"}
                </label>
                {currencyMode === "SOL" ? (
                  <div>
                    <input
                      type="number"
                      step="0.001"
                      value={soldSol}
                      onChange={(e) => handleSoldChange(e.target.value, true)}
                      placeholder="e.g. 3.2"
                      className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
                    />
                    <span className="text-[10px] text-[#9b9a97] block mt-0.5">
                      {soldUsd ? `≈ $${soldUsd}` : "Exit value"}
                    </span>
                  </div>
                ) : (
                  <div>
                    <input
                      type="number"
                      step="1"
                      value={soldUsd}
                      onChange={(e) => handleSoldChange(e.target.value, false)}
                      placeholder="e.g. 500"
                      className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
                    />
                    <span className="text-[10px] text-[#9b9a97] block mt-0.5">
                      {soldSol ? `≈ ${soldSol} SOL` : "Exit value"}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-medium text-[#787774] mb-1">Net P&L (SOL)</label>
                <input
                  type="number"
                  step="0.001"
                  value={pnlSol}
                  onChange={(e) => handlePnlChange(e.target.value, true)}
                  placeholder="+1.7 / -0.5"
                  required
                  className={`w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-[#2383e2] ${
                    parseFloat(pnlSol) > 0
                      ? "text-emerald-600"
                      : parseFloat(pnlSol) < 0
                      ? "text-rose-600"
                      : "text-[#37352f]"
                  }`}
                />
                <span className="text-[10px] text-[#9b9a97] block mt-0.5">Realized SOL</span>
              </div>

              <div>
                <label className="block font-medium text-[#787774] mb-1">Net P&L (USD $)</label>
                <input
                  type="number"
                  step="0.1"
                  value={pnlUsd}
                  onChange={(e) => handlePnlChange(e.target.value, false)}
                  placeholder="+$255.00"
                  className={`w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-[#2383e2] ${
                    parseFloat(pnlUsd) > 0
                      ? "text-emerald-600"
                      : parseFloat(pnlUsd) < 0
                      ? "text-rose-600"
                      : "text-[#37352f]"
                  }`}
                />
                <span className="text-[10px] text-[#9b9a97] block mt-0.5">Realized USD</span>
              </div>
            </div>
          </div>

          {/* Wallet Selection */}
          <div>
            <label className="block font-medium text-[#787774] mb-1 flex items-center gap-1">
              <WalletIcon size={12} />
              <span>Wallet Used</span>
            </label>
            <select
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
            >
              <option value="Main">Main Wallet (Phantom)</option>
              <option value="Sniper">Sniper Bot (BullX / Axiom)</option>
              <option value="Degen">Degen Bag (Photon / Trojan)</option>
              <option value="Moonbag">Moonbag Long Term</option>
              <option value="Paper">Paper Trading Bag (Simulated)</option>
            </select>
          </div>

          {/* Categorized Tags */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-xs text-[#37352f] flex items-center gap-1.5">
                <Tag size={13} className="text-[#2383e2]" />
                <span>Execution & Psychology Tags</span>
              </label>
              <span className="text-[11px] text-[#9b9a97]">{selectedTags.length} selected</span>
            </div>

            {/* Section A: Good Execution & Discipline */}
            <div>
              <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 mb-1.5">
                <ShieldCheck size={12} />
                <span>Good Execution & Discipline (Things you did right)</span>
              </div>
              <div className="flex flex-wrap gap-1.5 p-2 bg-emerald-50/40 border border-emerald-200/60 rounded-lg">
                {DEFAULT_GOOD_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 border ${
                        isSelected
                          ? "bg-emerald-100 border-emerald-400 text-emerald-800 font-semibold shadow-xs"
                          : "bg-white border-emerald-200 text-emerald-900 hover:bg-emerald-50"
                      }`}
                    >
                      {isSelected && <Check size={11} />}
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section B: Mistakes & Traps */}
            <div>
              <div className="flex items-center gap-1 text-[11px] font-medium text-rose-700 mb-1.5">
                <AlertTriangle size={12} />
                <span>Mistakes & Psychological Traps</span>
              </div>
              <div className="flex flex-wrap gap-1.5 p-2 bg-rose-50/40 border border-rose-200/60 rounded-lg">
                {DEFAULT_MISTAKE_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 border ${
                        isSelected
                          ? "bg-rose-100 border-rose-400 text-rose-800 font-semibold shadow-xs"
                          : "bg-white border-rose-200 text-rose-900 hover:bg-rose-50"
                      }`}
                    >
                      {isSelected && <Check size={11} />}
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Tag Input */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomTag(e);
                  }
                }}
                placeholder="Add custom tag (e.g. Scalped 30s pump)..."
                className="flex-1 bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
              />
              <button
                type="button"
                onClick={(e) => handleAddCustomTag(e)}
                className="px-3 py-1.5 bg-[#2383e2] hover:bg-[#1a73ca] text-white rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors shadow-xs"
              >
                <Plus size={13} />
                <span>Add Tag</span>
              </button>
            </div>
          </div>

          {/* Trade Notes */}
          <div>
            <label className="block font-medium text-[#787774] mb-1">Trade Notes & Rationale</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why did you enter? Did you stick to take-profit levels? What would you do differently?"
              className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg p-2.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2] resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f1f1ef]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[#787774] hover:bg-[#f1f1ef] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#2383e2] hover:bg-[#1a73ca] text-white font-medium rounded-lg text-xs shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <span>Save Trade to Cloud</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
