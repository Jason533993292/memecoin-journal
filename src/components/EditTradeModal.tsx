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

  const [ca, setCa] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [saving, setSaving] = useState(false);

  const [mcap, setMcap] = useState<number | undefined>(undefined);
  const [liquidity, setLiquidity] = useState<number | undefined>(undefined);
  const [price, setPrice] = useState<number | undefined>(undefined);

  // Trade fields
  const [wallet, setWallet] = useState("Main");
  const [result, setResult] = useState<"Win" | "Loss" | "BE">("Win");
  const [setupType, setSetupType] = useState<string>("Breakout / ATH Push");
  const [customSetup, setCustomSetup] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number | undefined>(15);
  const [screenshotUrl, setScreenshotUrl] = useState<string>("");

  const [boughtSol, setBoughtSol] = useState("");
  const [boughtUsd, setBoughtUsd] = useState("");
  const [soldSol, setSoldSol] = useState("");
  const [soldUsd, setSoldUsd] = useState("");
  const [pnlSol, setPnlSol] = useState("");
  const [pnlUsd, setPnlUsd] = useState("");
  const [initialRiskSol, setInitialRiskSol] = useState("");
  const [feesSol, setFeesSol] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [currencyMode, setCurrencyMode] = useState<"SOL" | "USD">("SOL");

  const [selectedMistakes, setSelectedMistakes] = useState<string[]>([]);
  const [selectedGoodTags, setSelectedGoodTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (trade) {
      setCa(trade.ca || "");
      setName(trade.name || "");
      setSymbol(trade.symbol || "");
      setWallet(trade.wallet || "Main");
      setResult(trade.result || "Win");
      setSetupType(trade.setupType || "Breakout / ATH Push");
      setDurationMinutes(trade.durationMinutes || 15);
      setScreenshotUrl(trade.screenshotUrl || "");

      const bSol = trade.boughtSol !== undefined ? String(trade.boughtSol) : "";
      const sSol = trade.soldSol !== undefined ? String(trade.soldSol) : "";
      const pSol = trade.pnlSol !== undefined ? String(trade.pnlSol) : "";

      setBoughtSol(bSol);
      setBoughtUsd(trade.boughtUsd ? String(trade.boughtUsd) : bSol ? (parseFloat(bSol) * solPrice).toFixed(2) : "");
      setSoldSol(sSol);
      setSoldUsd(trade.soldUsd ? String(trade.soldUsd) : sSol ? (parseFloat(sSol) * solPrice).toFixed(2) : "");
      setPnlSol(pSol);
      setPnlUsd(trade.pnlUsd ? String(trade.pnlUsd) : pSol ? (parseFloat(pSol) * solPrice).toFixed(2) : "");
      setInitialRiskSol(trade.initialRiskSol !== undefined && trade.initialRiskSol !== null ? String(trade.initialRiskSol) : "");
      setFeesSol(trade.feesSol !== undefined && trade.feesSol !== null ? String(trade.feesSol) : "");
      setStopPrice(trade.stopPrice !== undefined && trade.stopPrice !== null ? String(trade.stopPrice) : "");

      if (trade.initialRiskSol || trade.feesSol || trade.stopPrice) {
        setShowAdvanced(true);
      }

      setSelectedMistakes(trade.mistakes || []);
      setSelectedGoodTags(trade.goodTags || []);
      setNotes(trade.notes || "");
      setMcap(trade.mcap);
      setLiquidity(trade.liquidity);
      setPrice(trade.price);
    }
  }, [trade, solPrice]);

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
    const num = parseFloat(val);
    if (isSol) {
      setBoughtSol(val);
      if (!isNaN(num)) {
        setBoughtUsd((num * solPrice).toFixed(2));
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
    const num = parseFloat(val);
    if (isSol) {
      setSoldSol(val);
      if (!isNaN(num)) {
        setSoldUsd((num * solPrice).toFixed(2));
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
        const sNum = parseFloat(solVal);
        if (sNum > 0.005) setResult("Win");
        else if (sNum < -0.005) setResult("Loss");
        else setResult("BE");
      } else setPnlSol("");
    }
  };

  const toggleGoodTag = (tag: string) => {
    setSelectedGoodTags((prev) =>
      prev.includes(tag) ? prev.filter((g) => g !== tag) : [...prev, tag]
    );
  };

  const toggleMistake = (tag: string) => {
    setSelectedMistakes((prev) =>
      prev.includes(tag) ? prev.filter((m) => m !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trade) return;

    setSaving(true);
    try {
      const parsedPnlSol = parseFloat(pnlSol) || 0;
      const parsedPnlUsd = parseFloat(pnlUsd) || parsedPnlSol * solPrice;
      const parsedBoughtSol = parseFloat(boughtSol) || 0;
      const parsedBoughtUsd = parseFloat(boughtUsd) || parsedBoughtSol * solPrice;
      const parsedSoldSol = parseFloat(soldSol) || parsedBoughtSol + parsedPnlSol;
      const parsedSoldUsd = parseFloat(soldUsd) || parsedSoldSol * solPrice;
      const parsedInitialRiskSol = parseFloat(initialRiskSol) || null;
      const parsedFeesSol = parseFloat(feesSol) || null;
      const parsedStopPrice = parseFloat(stopPrice) || null;

      const finalSetup = customSetup.trim() || setupType;

      const currentUser = auth.currentUser;
      const tradeRef = currentUser
        ? doc(db, "users", currentUser.uid, "trades", trade.id)
        : doc(db, "trades", trade.id);

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
              <span>Advanced Risk & Fee Parameters</span>
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
