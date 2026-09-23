"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "../lib/firebase";
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
import { COMMON_SETUPS, DURATION_PRESETS, DEFAULT_GOOD_TAGS, DEFAULT_MISTAKE_TAGS } from "./LogTradeModal";

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

  const [ca, setCa] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [loadingToken, setLoadingToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState("");

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
  const [customMistakeInput, setCustomMistakeInput] = useState("");
  const [notes, setNotes] = useState("");

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

      setSelectedMistakes(trade.mistakes || []);
      setNotes(trade.notes || "");
      setMcap(trade.mcap);
      setLiquidity(trade.liquidity);
      setPrice(trade.price);
    }
  }, [trade, solPrice]);

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
                showToast("Chart screenshot attached from clipboard!", "success");
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

  if (!isOpen || !trade) return null;

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
        showToast("Chart screenshot updated!", "success");
      }
    };
    reader.readAsDataURL(file);
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

  const toggleMistake = (tag: string) => {
    setSelectedMistakes((prev) =>
      prev.includes(tag) ? prev.filter((m) => m !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomMistake = () => {
    const clean = customMistakeInput.trim();
    if (!clean) return;
    if (!selectedMistakes.includes(clean)) {
      setSelectedMistakes((prev) => [...prev, clean]);
    }
    setCustomMistakeInput("");
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

      const tradeRef = doc(db, "trades", trade.id);
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

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
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
                className="p-3.5 border-2 border-dashed border-[#e3e2de] hover:border-[#2383e2] rounded-xl bg-[#fbfbfa] text-center cursor-pointer transition-colors space-y-1"
              >
                <div className="flex justify-center text-[#787774]">
                  <Upload size={16} />
                </div>
                <div className="text-xs font-semibold text-[#37352f]">Upload / Paste Screenshot (Cmd+V)</div>
              </div>
            )}
          </div>

          {/* Trade Result */}
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

          {/* Financials */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-medium text-[#787774]">
                Financials (1 SOL = ${solPrice.toFixed(2)})
              </label>
              <div className="flex items-center gap-1 bg-[#f1f1ef] p-0.5 rounded-md text-[11px]">
                <button
                  type="button"
                  onClick={() => setCurrencyMode("SOL")}
                  className={`px-2 py-0.5 rounded font-medium transition-all ${
                    currencyMode === "SOL" ? "bg-white text-[#37352f] shadow-xs" : "text-[#787774]"
                  }`}
                >
                  SOL
                </button>
                <button
                  type="button"
                  onClick={() => setCurrencyMode("USD")}
                  className={`px-2 py-0.5 rounded font-medium transition-all ${
                    currencyMode === "USD" ? "bg-white text-[#37352f] shadow-xs" : "text-[#787774]"
                  }`}
                >
                  USD ($)
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
                  required
                  className={`w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-[#2383e2] ${
                    parseFloat(pnlSol) > 0 ? "text-emerald-600" : parseFloat(pnlSol) < 0 ? "text-rose-600" : "text-[#37352f]"
                  }`}
                />
              </div>

              <div>
                <label className="block font-medium text-[#787774] mb-1">Net P&L (USD $)</label>
                <input
                  type="number"
                  step="0.1"
                  value={pnlUsd}
                  onChange={(e) => handlePnlChange(e.target.value, false)}
                  className={`w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-[#2383e2] ${
                    parseFloat(pnlUsd) > 0 ? "text-emerald-600" : parseFloat(pnlUsd) < 0 ? "text-rose-600" : "text-[#37352f]"
                  }`}
                />
              </div>
            </div>

            {/* Quant Risk & Execution Drag (Fees) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#f1f1ef]">
              <div>
                <label className="block font-medium text-[#787774] mb-1">
                  Planned Risk (SOL)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={initialRiskSol}
                  onChange={(e) => setInitialRiskSol(e.target.value)}
                  placeholder="e.g. 0.5 (For R-Multiple)"
                  className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
                />
                <span className="text-[10px] text-[#9b9a97] block mt-0.5">
                  Stop distance (R)
                </span>
              </div>

              <div>
                <label className="block font-medium text-[#787774] mb-1">
                  Network Fees & Bribes
                </label>
                <input
                  type="number"
                  step="0.001"
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

          {/* Mistakes & Psychology Tags */}
          <div className="space-y-2">
            <label className="font-semibold text-xs text-[#37352f] flex items-center gap-1.5">
              <Tag size={13} className="text-[#2383e2]" />
              <span>Discipline & Emotion Tags</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[...DEFAULT_GOOD_TAGS, ...DEFAULT_MISTAKE_TAGS].map((m) => {
                const isSelected = selectedMistakes.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMistake(m)}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 border ${
                      isSelected
                        ? "bg-blue-50 border-[#2383e2] text-[#2383e2] font-semibold shadow-xs"
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
