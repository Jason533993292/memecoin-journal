"use client";

import { useState, useEffect, useRef } from "react";
import { db, auth } from "../lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import {
  X,
  Search,
  Loader2,
  Check,
  Plus,
  AlertCircle,
  Trash2,
  Wallet as WalletIcon,
  Tag,
  Image as ImageIcon,
  Clock,
  Upload,
  Layers,
} from "lucide-react";
import { Trade } from "../lib/types";
import { useToast } from "./Toast";
import { COMMON_SETUPS, DURATION_PRESETS, DEFAULT_GOOD_TAGS, DEFAULT_MISTAKE_TAGS } from "../lib/constants";
import { compressImage } from "../lib/utils";
import { buildTradeAmounts } from "../lib/tradeInput";

interface EditTradeModalProps {
  trade: Trade | null;
  isOpen: boolean;
  onClose: () => void;
  onTradeUpdated: () => void;
  solPrice?: number;
}

export default function EditTradeModal({
  trade,
  isOpen,
  onClose,
  onTradeUpdated,
  solPrice = 150,
}: EditTradeModalProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const [ca, setCa] = useState(trade?.ca || "");
  const [name, setName] = useState(trade?.name || "");
  const [symbol, setSymbol] = useState(trade?.symbol || "");
  const [saving, setSaving] = useState(false);

  const [mcap, setMcap] = useState<number | undefined>(trade?.mcap);
  const [liquidity, setLiquidity] = useState<number | undefined>(trade?.liquidity);
  const [price, setPrice] = useState<number | undefined>(trade?.price);

  // Trade fields
  const [wallet, setWallet] = useState(trade?.wallet || "Main");
  const [result, setResult] = useState<"Win" | "Loss" | "BE">(trade?.result || "Win");
  const [setupType, setSetupType] = useState<string>(trade?.setupType || "Breakout / ATH Push");
  const [customSetup, setCustomSetup] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number | undefined>(trade?.durationMinutes || 15);
  const [screenshotUrl, setScreenshotUrl] = useState<string>(trade?.screenshotUrl || "");

  const [boughtSol, setBoughtSol] = useState(trade?.boughtSol != null ? String(trade.boughtSol) : "");
  const [boughtUsd, setBoughtUsd] = useState(
    trade?.boughtUsd != null
      ? String(trade.boughtUsd)
      : trade?.boughtSol != null && solPrice > 0
        ? (trade.boughtSol * solPrice).toFixed(2)
        : ""
  );
  const [soldSol, setSoldSol] = useState(trade?.soldSol != null ? String(trade.soldSol) : "");
  const [soldUsd, setSoldUsd] = useState(
    trade?.soldUsd != null
      ? String(trade.soldUsd)
      : trade?.soldSol != null && solPrice > 0
        ? (trade.soldSol * solPrice).toFixed(2)
        : ""
  );
  const [pnlSol, setPnlSol] = useState(trade?.pnlSol != null ? String(trade.pnlSol) : "");
  const [pnlUsd, setPnlUsd] = useState(
    trade?.pnlUsd != null
      ? String(trade.pnlUsd)
      : trade?.pnlSol != null && solPrice > 0
        ? (trade.pnlSol * solPrice).toFixed(2)
        : ""
  );
  const [initialRiskSol, setInitialRiskSol] = useState(trade?.initialRiskSol != null ? String(trade.initialRiskSol) : "");
  const [feesSol, setFeesSol] = useState(trade?.feesSol != null ? String(trade.feesSol) : "");
  const [stopPrice, setStopPrice] = useState(trade?.stopPrice != null ? String(trade.stopPrice) : "");
  const [entryLiquidityUsd, setEntryLiquidityUsd] = useState(trade?.entryLiquidityUsd != null ? String(trade.entryLiquidityUsd) : "");
  const [exitLiquidityUsd, setExitLiquidityUsd] = useState(trade?.exitLiquidityUsd != null ? String(trade.exitLiquidityUsd) : "");
  const [entryMarketCapUsd, setEntryMarketCapUsd] = useState(trade?.entryMarketCapUsd != null ? String(trade.entryMarketCapUsd) : "");
  const [exitMarketCapUsd, setExitMarketCapUsd] = useState(trade?.exitMarketCapUsd != null ? String(trade.exitMarketCapUsd) : "");
  const [slippagePct, setSlippagePct] = useState(trade?.slippagePct != null ? String(trade.slippagePct) : "");
  const [currencyMode, setCurrencyMode] = useState<"SOL" | "USD">("SOL");

  const [selectedMistakes, setSelectedMistakes] = useState<string[]>(trade?.mistakes || []);
  const [selectedGoodTags, setSelectedGoodTags] = useState<string[]>(trade?.goodTags || []);
  const [notes, setNotes] = useState(trade?.notes || "");
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(trade?.initialRiskSol || trade?.feesSol || trade?.stopPrice)
  );

  // Global Clipboard Paste Listener for screenshots with compression
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = async (event) => {
              if (event.target?.result) {
                const rawUrl = event.target.result as string;
                const compressed = await compressImage(rawUrl);
                setScreenshotUrl(compressed);
                showToast("Chart screenshot attached & optimized!", "success");
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

  // Close on Escape & Save on Cmd+Enter
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !trade) return null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please choose an image file", "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast("Image must be smaller than 10 MB", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result) {
        const rawUrl = event.target.result as string;
        const compressed = await compressImage(rawUrl);
        setScreenshotUrl(compressed);
        showToast("Chart screenshot updated & optimized!", "success");
      }
    };
    reader.readAsDataURL(file);
  };

  const recalculatePnl = (inSol: number, outSol: number) => {
    if (!isNaN(inSol) && !isNaN(outSol) && inSol > 0 && outSol >= 0) {
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
    if (newMode === "USD" && solPrice <= 0) {
      showToast("Live SOL price is unavailable", "info", "Try again in a moment before entering amounts in USD.");
      return;
    }

    if (newMode === "USD") {
      const sBought = parseFloat(boughtSol);
      if (!isNaN(sBought)) setBoughtUsd((sBought * solPrice).toFixed(2));
      const sSold = parseFloat(soldSol);
      if (!isNaN(sSold)) setSoldUsd((sSold * solPrice).toFixed(2));
      const sPnl = parseFloat(pnlSol);
      if (!isNaN(sPnl)) setPnlUsd((sPnl * solPrice).toFixed(2));
    } else {
      const uBought = parseFloat(boughtUsd);
      if (!isNaN(uBought)) setBoughtSol((uBought / solPrice).toFixed(3));
      const uSold = parseFloat(soldUsd);
      if (!isNaN(uSold)) setSoldSol((uSold / solPrice).toFixed(3));
      const uPnl = parseFloat(pnlUsd);
      if (!isNaN(uPnl)) setPnlSol((uPnl / solPrice).toFixed(3));
    }

    setCurrencyMode(newMode);
  };

  const handleBoughtChange = (val: string, isSol: boolean) => {
    if (!isSol && solPrice <= 0) return;
    const num = parseFloat(val);
    if (isSol) {
      setBoughtSol(val);
      if (!isNaN(num)) {
        setBoughtUsd(solPrice > 0 ? (num * solPrice).toFixed(2) : "");
        if (soldSol) recalculatePnl(num, parseFloat(soldSol) || 0);
      } else {
        setBoughtUsd("");
      }
    } else {
      setBoughtUsd(val);
      if (!isNaN(num)) {
        const solVal = (num / solPrice).toFixed(3);
        setBoughtSol(solVal);
        if (soldSol || soldUsd) recalculatePnl(parseFloat(solVal), parseFloat(soldSol) || 0);
      } else {
        setBoughtSol("");
      }
    }
  };

  const handleSoldChange = (val: string, isSol: boolean) => {
    if (!isSol && solPrice <= 0) return;
    const num = parseFloat(val);
    if (isSol) {
      setSoldSol(val);
      if (!isNaN(num)) {
        setSoldUsd(solPrice > 0 ? (num * solPrice).toFixed(2) : "");
        if (boughtSol) recalculatePnl(parseFloat(boughtSol) || 0, num);
      } else {
        setSoldUsd("");
      }
    } else {
      setSoldUsd(val);
      if (!isNaN(num)) {
        const solVal = (num / solPrice).toFixed(3);
        setSoldSol(solVal);
        if (boughtSol || boughtUsd) recalculatePnl(parseFloat(boughtSol) || 0, parseFloat(solVal));
      } else {
        setSoldSol("");
      }
    }
  };

  const handlePnlChange = (val: string, isSol: boolean) => {
    if (!isSol && solPrice <= 0) return;
    const num = parseFloat(val);
    if (isSol) {
      setPnlSol(val);
      if (!isNaN(num)) {
        setPnlUsd(solPrice > 0 ? (num * solPrice).toFixed(2) : "");
        if (num > 0.005) setResult("Win");
        else if (num < -0.005) setResult("Loss");
        else setResult("BE");
      } else setPnlUsd("");
    } else {
      setPnlUsd(val);
      if (!isNaN(num)) {
        const solVal = (num / solPrice).toFixed(3);
        setPnlSol(solVal);
        const sNum = parseFloat(solVal);
        if (sNum > 0.005) setResult("Win");
        else if (sNum < -0.005) setResult("Loss");
        else setResult("BE");
      } else setPnlSol("");
    }
  };

  const toggleGoodTag = (tag: string) => {
    if (selectedGoodTags.includes(tag)) {
      setSelectedGoodTags(selectedGoodTags.filter((current) => current !== tag));
    } else if (selectedGoodTags.length >= 20) {
      showToast("Tag limit reached", "error", "Choose up to 20 execution tags per trade.");
    } else {
      setSelectedGoodTags([...selectedGoodTags, tag]);
    }
  };

  const toggleMistake = (tag: string) => {
    if (selectedMistakes.includes(tag)) {
      setSelectedMistakes(selectedMistakes.filter((current) => current !== tag));
    } else if (selectedMistakes.length >= 20) {
      showToast("Tag limit reached", "error", "Choose up to 20 mistakes per trade.");
    } else {
      setSelectedMistakes([...selectedMistakes, tag]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trade) return;
    if (solPrice <= 0 && (!boughtUsd.trim() || !soldUsd.trim() || !pnlUsd.trim())) {
      showToast("Cannot calculate USD values yet", "error", "Wait for the live SOL price to load before editing this trade.");
      return;
    }

    setSaving(true);
    try {
      const amounts = buildTradeAmounts({
        boughtSol,
        soldSol,
        pnlSol,
        boughtUsd,
        soldUsd,
        pnlUsd,
        solPrice,
      });
      const { parsedPnlSol, parsedPnlUsd, parsedBoughtSol, parsedBoughtUsd, parsedSoldSol, parsedSoldUsd } = {
        parsedPnlSol: amounts.pnlSol,
        parsedPnlUsd: amounts.pnlUsd,
        parsedBoughtSol: amounts.boughtSol,
        parsedBoughtUsd: amounts.boughtUsd,
        parsedSoldSol: amounts.soldSol,
        parsedSoldUsd: amounts.soldUsd,
      };
      const parsedInitialRiskSol = parseFloat(initialRiskSol) || null;
      const parsedFeesSol = parseFloat(feesSol) || null;
      const parsedStopPrice = parseFloat(stopPrice) || null;
      const parsedEntryLiquidity = parseFloat(entryLiquidityUsd) || null;
      const parsedExitLiquidity = parseFloat(exitLiquidityUsd) || null;
      const parsedEntryMcap = parseFloat(entryMarketCapUsd) || null;
      const parsedExitMcap = parseFloat(exitMarketCapUsd) || null;
      const parsedSlippage = parseFloat(slippagePct) || null;

      const finalSetup = customSetup.trim() || setupType;

      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Please sign in before editing a trade.");
      const tradeRef = doc(db, "users", currentUser.uid, "trades", trade.id);

      await updateDoc(tradeRef, {
        ca: ca.trim(),
        name: name.trim(),
        symbol: symbol.trim(),
        wallet,
        result,
        setupType: finalSetup,
        durationMinutes: durationMinutes || null,
        screenshotUrl: screenshotUrl || null,
        mcap: mcap || 0,
        liquidity: liquidity || 0,
        price: price || 0,
        boughtSol: parsedBoughtSol,
        boughtUsd: parsedBoughtUsd,
        soldSol: parsedSoldSol,
        soldUsd: parsedSoldUsd,
        pnlSol: parsedPnlSol,
        pnlUsd: parsedPnlUsd,
        initialRiskSol: parsedInitialRiskSol,
        feesSol: parsedFeesSol,
        stopPrice: parsedStopPrice,
        entryLiquidityUsd: parsedEntryLiquidity,
        exitLiquidityUsd: parsedExitLiquidity,
        entryMarketCapUsd: parsedEntryMcap,
        exitMarketCapUsd: parsedExitMcap,
        slippagePct: parsedSlippage,
        goodTags: selectedGoodTags,
        mistakes: selectedMistakes,
        notes: notes.trim(),
      });

      showToast("Trade updated successfully", "success");
      onTradeUpdated();
      onClose();
    } catch (error) {
      console.error("Error updating trade:", error);
      showToast("Failed to update trade", "error");
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
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#9b9a97] hover:text-[#37352f] transition-colors p-1.5 rounded-lg hover:bg-[#f1f1ef]"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#f1f1ef]">
          <span className="text-xl">✏️</span>
          <div>
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-[#37352f]">
              Edit Trade: ${symbol || trade.symbol}
            </h2>
            <p className="text-xs text-[#787774]">Modify financial metrics, chart screenshots, and notes.</p>
          </div>
        </div>

        <form ref={formRef} id="edit-trade-form" onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Token Identification */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#787774] mb-1">Token Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-[#787774] mb-1">Token Symbol</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
                required
              />
            </div>
          </div>

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
              placeholder="Or custom setup..."
              className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
            />
          </div>

          {/* Trade Duration */}
          <div>
            <label className="block font-medium text-[#787774] mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Clock size={12} className="text-amber-600" />
                <span>Trade Duration</span>
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

          {/* Chart Screenshot */}
          <div>
            <label className="block font-medium text-[#787774] mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <ImageIcon size={12} className="text-purple-600" />
                <span>Chart Screenshot</span>
              </span>
              <span className="text-[10px] text-purple-600 font-medium">Cmd+V to paste screenshot</span>
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
                  alt="Chart Screenshot"
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
                className="border border-dashed border-[#e3e2de] hover:border-[#2383e2] rounded-xl p-4 text-center cursor-pointer bg-[#fbfbfa] hover:bg-blue-50/20 transition-all"
              >
                <Upload size={18} className="mx-auto text-[#787774] mb-1" />
                <p className="text-xs font-medium text-[#37352f]">Upload Chart Image or Paste (Cmd+V)</p>
                <p className="text-[10px] text-[#9b9a97] mt-0.5">Supports PNG, JPG, WebP (auto-compressed)</p>
              </div>
            )}
          </div>

          {/* Trade Result (Win/Loss/BE) */}
          <div>
            <label className="block font-medium text-[#787774] mb-1.5">Trade Result</label>
            <div className="grid grid-cols-3 gap-2">
              {(["Win", "Loss", "BE"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setResult(r)}
                  className={`py-2 rounded-lg font-semibold text-xs transition-all border ${
                    result === r
                      ? r === "Win"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs"
                        : r === "Loss"
                        ? "bg-rose-50 border-rose-500 text-rose-700 shadow-xs"
                        : "bg-neutral-100 border-neutral-400 text-neutral-800 shadow-xs"
                      : "bg-[#fbfbfa] border-[#e3e2de] text-[#787774] hover:bg-[#f1f1ef]"
                  }`}
                >
                  {r === "Win" ? "🏆 Win" : r === "Loss" ? "💀 Loss" : "⚖️ Break-Even"}
                </button>
              ))}
            </div>
          </div>

          {/* Financial Numbers with Currency Toggle */}
          <div className="space-y-3 p-3.5 bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-[#37352f]">Financial Metrics</span>
              <div className="flex items-center gap-0.5 bg-[#f1f1ef] p-0.5 rounded-md text-[11px]">
                <button
                  type="button"
                  onClick={() => switchCurrencyMode("SOL")}
                  className={`px-2 py-0.5 rounded font-medium transition-all ${
                    currencyMode === "SOL"
                      ? "bg-white text-[#37352f] shadow-xs font-semibold"
                      : "text-[#787774]"
                  }`}
                >
                  SOL
                </button>
                <button
                  type="button"
                  onClick={() => switchCurrencyMode("USD")}
                  className={`px-2 py-0.5 rounded font-medium transition-all ${
                    currencyMode === "USD"
                      ? "bg-white text-[#37352f] shadow-xs font-semibold"
                      : "text-[#787774]"
                  }`}
                >
                  USD ($)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div>
                <label className="block font-medium text-[#787774] mb-1">
                  Bought ({currencyMode})
                </label>
                <input
                  type="number"
                  step="any"
                  value={currencyMode === "SOL" ? boughtSol : boughtUsd}
                  onChange={(e) => handleBoughtChange(e.target.value, currencyMode === "SOL")}
                  className="w-full bg-white border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2] font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-[#787774] mb-1">
                  Sold ({currencyMode})
                </label>
                <input
                  type="number"
                  step="any"
                  value={currencyMode === "SOL" ? soldSol : soldUsd}
                  onChange={(e) => handleSoldChange(e.target.value, currencyMode === "SOL")}
                  className="w-full bg-white border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2] font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-[#787774] mb-1">
                  Net P&L ({currencyMode})
                </label>
                <input
                  type="number"
                  step="any"
                  value={currencyMode === "SOL" ? pnlSol : pnlUsd}
                  onChange={(e) => handlePnlChange(e.target.value, currencyMode === "SOL")}
                  className={`w-full bg-white border rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold focus:outline-none ${
                    (parseFloat(pnlSol) || 0) >= 0
                      ? "text-emerald-700 border-emerald-300 focus:border-emerald-500"
                      : "text-rose-700 border-rose-300 focus:border-rose-500"
                  }`}
                  required
                />
              </div>
            </div>
          </div>

          {/* Advanced Metrics Accordion */}
          <div className="border border-[#e9e9e7] rounded-xl p-3 bg-white">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between text-xs font-medium text-[#787774] hover:text-[#37352f]"
            >
              <span>Expert / Advanced Fields</span>
              <span>{showAdvanced ? "▲" : "▼"}</span>
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 mt-2 border-t border-[#f1f1ef]">
                <div>
                  <label className="block font-medium text-[#787774] mb-1">
                    Initial Risk (SOL)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={initialRiskSol}
                    onChange={(e) => setInitialRiskSol(e.target.value)}
                    placeholder="e.g. 0.25 SOL"
                    className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
                  />
                  <span className="text-[10px] text-[#9b9a97] block mt-0.5">
                    Max loss plan (1R)
                  </span>
                </div>

                <div>
                  <label className="block font-medium text-[#787774] mb-1">
                    Priority Fees (SOL)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={feesSol}
                    onChange={(e) => setFeesSol(e.target.value)}
                    placeholder="e.g. 0.008 SOL"
                    className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
                  />
                  <span className="text-[10px] text-[#9b9a97] block mt-0.5">
                    Jito tip / priority
                  </span>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-medium text-[#787774] mb-1">
                    Stop Loss Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.0000001"
                    value={stopPrice}
                    onChange={(e) => setStopPrice(e.target.value)}
                    placeholder="e.g. 0.0042"
                    className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
                  />
                  <span className="text-[10px] text-[#9b9a97] block mt-0.5">
                    Target invalidation
                  </span>
                  </div>
                <div className="col-span-2 sm:col-span-3 pt-2 border-t border-[#f1f1ef]">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9b9a97] mb-2">Expert market context</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[["Entry liquidity ($)", entryLiquidityUsd, setEntryLiquidityUsd], ["Exit liquidity ($)", exitLiquidityUsd, setExitLiquidityUsd], ["Entry mcap ($)", entryMarketCapUsd, setEntryMarketCapUsd], ["Exit mcap ($)", exitMarketCapUsd, setExitMarketCapUsd], ["Slippage (%)", slippagePct, setSlippagePct]].map(([label, value, setter]) => (
                      <label key={String(label)} className="text-[10px] text-[#787774]">{String(label)}<input type="number" step="any" value={String(value)} onChange={(e) => (setter as (v: string) => void)(e.target.value)} className="mt-1 w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]" /></label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Wallet */}
          <div>
            <label className="block font-medium text-[#787774] mb-1 flex items-center gap-1">
              <WalletIcon size={12} />
              <span>Wallet</span>
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

          {/* Good Execution Habits Tags */}
          <div className="space-y-1.5">
            <label className="font-semibold text-xs text-emerald-800 flex items-center gap-1.5">
              <span>✅</span>
              <span>Good Execution Habits</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_GOOD_TAGS.map((g) => {
                const isSelected = selectedGoodTags.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGoodTag(g)}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 border ${
                      isSelected
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 font-semibold shadow-xs"
                        : "bg-[#fbfbfa] border-[#e3e2de] text-[#5a5957] hover:bg-[#f1f1ef]"
                    }`}
                  >
                    {isSelected && <Check size={11} />}
                    <span>{g}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mistakes & Psychology Tags */}
          <div className="space-y-1.5">
            <label className="font-semibold text-xs text-rose-800 flex items-center gap-1.5">
              <span>⚠️</span>
              <span>Discipline Errors & Tilt</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_MISTAKE_TAGS.map((m) => {
                const isSelected = selectedMistakes.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMistake(m)}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 border ${
                      isSelected
                        ? "bg-rose-50 border-rose-500 text-rose-800 font-semibold shadow-xs"
                        : "bg-[#fbfbfa] border-[#e3e2de] text-[#5a5957] hover:bg-[#f1f1ef]"
                    }`}
                  >
                    {isSelected && <Check size={11} />}
                    <span>{m}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-medium text-[#787774] mb-1">Trade Notes & Rationale</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={4000}
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
              id="edit-trade-submit-btn"
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#2383e2] hover:bg-[#1a73ca] text-white font-medium rounded-lg text-xs shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <span>Update Trade</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
