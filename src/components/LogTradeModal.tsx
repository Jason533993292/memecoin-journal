"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
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
import {
  DEFAULT_GOOD_TAGS,
  DEFAULT_MISTAKE_TAGS,
  COMMON_SETUPS,
  DURATION_PRESETS,
} from "../lib/constants";
import { compressImage } from "../lib/utils";
import { buildTradeAmounts, getTradeCreateValidationError, parseQuickTradePaste } from "../lib/tradeInput";
import { useAuth } from "../context/AuthContext";
import { parseLocalStorageValue, useLocalStorageValue, writeLocalStorageValue } from "../lib/useLocalStorage";
import { selectSolanaTokenPair } from "../lib/tokenMarketData";

// Re-export for backward compatibility
export { DEFAULT_GOOD_TAGS, DEFAULT_MISTAKE_TAGS, COMMON_SETUPS, DURATION_PRESETS };

interface LogTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTradeLogged: () => void;
  initialData?: Partial<Trade> | null;
  solPrice?: number;
}

function toLocalDateTimeInput(timestamp: number): string {
  const date = new Date(timestamp);
  return new Date(timestamp - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function LogTradeModal({
  isOpen,
  onClose,
  onTradeLogged,
  initialData = null,
  solPrice = 150,
}: LogTradeModalProps) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const caDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const tokenLookupRef = useRef(0);
  const formRef = useRef<HTMLFormElement | null>(null);

  const [ca, setCa] = useState(initialData?.ca || "");
  const [loadingToken, setLoadingToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [quickPaste, setQuickPaste] = useState("");

  const [tokenData, setTokenData] = useState<{
    name: string;
    symbol: string;
    priceUsd: string;
    marketCap: number;
    liquidity: number;
    imageUrl?: string;
  } | null>(null);

  // Trade fields
  const initialSetup = initialData?.setupType || "Breakout / ATH Push";
  const isKnownInitialSetup = COMMON_SETUPS.includes(initialSetup);
  const [wallet, setWallet] = useState(initialData?.wallet || "Paper");
  const [result, setResult] = useState<"Win" | "Loss" | "BE" | "">(initialData?.result || "");
  const [setupType, setSetupType] = useState<string>(isKnownInitialSetup ? initialSetup : "Custom");
  const [customSetup, setCustomSetup] = useState(isKnownInitialSetup ? "" : initialSetup);
  const [durationMinutes, setDurationMinutes] = useState<number | undefined>(initialData?.durationMinutes || 15);
  const [tradedAtInput, setTradedAtInput] = useState(() => toLocalDateTimeInput(Date.now()));

  // Financial fields
  const [boughtSol, setBoughtSol] = useState(initialData?.boughtSol ? String(initialData.boughtSol) : "");
  const [boughtUsd, setBoughtUsd] = useState(initialData?.boughtUsd ? String(initialData.boughtUsd) : "");
  const [soldSol, setSoldSol] = useState(initialData?.soldSol ? String(initialData.soldSol) : "");
  const [soldUsd, setSoldUsd] = useState(initialData?.soldUsd ? String(initialData.soldUsd) : "");
  const [pnlSol, setPnlSol] = useState(initialData?.pnlSol ? String(initialData.pnlSol) : "");
  const [pnlUsd, setPnlUsd] = useState(initialData?.pnlUsd ? String(initialData.pnlUsd) : "");
  const [initialRiskSol, setInitialRiskSol] = useState(initialData?.initialRiskSol ? String(initialData.initialRiskSol) : "");
  const [feesSol, setFeesSol] = useState(initialData?.feesSol ? String(initialData.feesSol) : "");
  const [stopPrice, setStopPrice] = useState(initialData?.stopPrice ? String(initialData.stopPrice) : "");
  const [entryLiquidityUsd, setEntryLiquidityUsd] = useState(initialData?.entryLiquidityUsd ? String(initialData.entryLiquidityUsd) : "");
  const [exitLiquidityUsd, setExitLiquidityUsd] = useState(initialData?.exitLiquidityUsd ? String(initialData.exitLiquidityUsd) : "");
  const [entryMarketCapUsd, setEntryMarketCapUsd] = useState(initialData?.entryMarketCapUsd ? String(initialData.entryMarketCapUsd) : "");
  const [exitMarketCapUsd, setExitMarketCapUsd] = useState(initialData?.exitMarketCapUsd ? String(initialData.exitMarketCapUsd) : "");
  const [slippagePct, setSlippagePct] = useState(initialData?.slippagePct ? String(initialData.slippagePct) : "");
  const [currencyMode, setCurrencyMode] = useState<"SOL" | "USD">("SOL");

  // Screenshot / Chart attachment
  const [screenshotUrl, setScreenshotUrl] = useState<string>("");

  // Tags - separated into Good Execution vs Mistakes
  const [selectedGoodTags, setSelectedGoodTags] = useState<string[]>(initialData?.goodTags || []);
  const [selectedMistakes, setSelectedMistakes] = useState<string[]>(initialData?.mistakes || []);
  const [customTagInput, setCustomTagInput] = useState("");
  const [customTagType, setCustomTagType] = useState<"good" | "mistake">("mistake");
  const customTagStorageKey = user ? "memecoin_journal_" + user.uid + "_custom_tags" : "custom_tags";
  const storedCustomTags = useLocalStorageValue(customTagStorageKey);
  const customTagPool = useMemo(() => {
    const parsed = parseLocalStorageValue<unknown>(storedCustomTags, []);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string").slice(0, 40)
      : [];
  }, [storedCustomTags]);

  const [notes, setNotes] = useState(initialData?.notes ? `[Clone] ${initialData.notes}` : "");
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(initialData?.initialRiskSol || initialData?.feesSol || initialData?.stopPrice)
  );
  const [showAllTags, setShowAllTags] = useState(false);

  const parseQuickPaste = (value: string) => {
    setQuickPaste(value);
    const parsed = parseQuickTradePaste(value);
    if (parsed.contractAddress) setCa(parsed.contractAddress);
    if (parsed.bought) handleBoughtChange(parsed.bought, true);
    if (parsed.sold) handleSoldChange(parsed.sold, true);
  };

  const attachImage = useCallback(async (rawUrl: string) => {
    try {
      const compressed = await compressImage(rawUrl);
      setScreenshotUrl(compressed);
      showToast("Chart screenshot attached and optimized.", "success");
    } catch {
      showToast("Screenshot could not be attached", "error", "Choose a smaller image or another file.");
    }
  }, [showToast]);

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
            if (blob.size > 10 * 1024 * 1024) {
              showToast("Image must be smaller than 10 MB", "error");
              break;
            }
            const reader = new FileReader();
            reader.onload = async (event) => {
              if (event.target?.result) {
                await attachImage(event.target.result as string);
              }
            };
            reader.onerror = () => showToast("The pasted image could not be read", "error");
            reader.readAsDataURL(blob);
          }
          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [attachImage, isOpen, showToast]);

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (caDebounceRef.current) clearTimeout(caDebounceRef.current);
    };
  }, []);

  // Close on Escape & Save on Cmd+Enter directly via form submit
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

  if (!isOpen) return null;

  const fetchTokenData = async (contractAddress = ca) => {
    const cleanCa = contractAddress.trim();
    if (!cleanCa) return;
    const lookupId = ++tokenLookupRef.current;
    setLoadingToken(true);
    setFetchError("");

    // Token details are public market data. Looking them up directly keeps the
    // trade form responsive even if an optional server-side service is offline.
    try {
      const directRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${cleanCa}`);
      if (directRes.ok) {
        const directData = await directRes.json();
        const best = selectSolanaTokenPair(directData, cleanCa);
        if (best && lookupId === tokenLookupRef.current) {
          const directObj = {
            name: typeof best.baseToken?.name === "string" ? best.baseToken.name : "Unknown Token",
            symbol: typeof best.baseToken?.symbol === "string" ? best.baseToken.symbol : "MEME",
            priceUsd: typeof best.priceUsd === "string" ? best.priceUsd : "0",
            marketCap: Number(best.marketCap) || Number(best.fdv) || 0,
            liquidity: Number(best.liquidity?.usd) || 0,
            imageUrl: typeof best.info?.imageUrl === "string" ? best.info.imageUrl : undefined,
          };
          setTokenData(directObj);
          showToast("Token found", "info", `${directObj.name} ($${directObj.symbol})`);
          setLoadingToken(false);
          return;
        }
      }
    } catch (clientErr) {
      console.error("Token lookup failed:", clientErr);
    }

    if (lookupId === tokenLookupRef.current) {
      setFetchError("Token not found on DexScreener. Check contract address or paste name manually.");
      setLoadingToken(false);
    }
  };

  const handleCaChange = (val: string) => {
    setCa(val);
    setTokenData(null);
    setFetchError("");
    tokenLookupRef.current += 1;
    if (caDebounceRef.current) clearTimeout(caDebounceRef.current);
    if (val.trim().length >= 32 && val.trim().length <= 44) {
      caDebounceRef.current = setTimeout(() => {
        fetchTokenData(val.trim());
      }, 450);
    }
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

  // Image Upload / Drag & Drop Handler with compression
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
        await attachImage(event.target.result as string);
      }
    };
    reader.onerror = () => showToast("The selected image could not be read", "error");
    reader.readAsDataURL(file);
  };

  const toggleGoodTag = (tag: string) => {
    if (selectedGoodTags.includes(tag)) {
      setSelectedGoodTags(selectedGoodTags.filter((item) => item !== tag));
    } else if (selectedGoodTags.length >= 20) {
      showToast("Tag limit reached", "error", "Choose up to 20 execution tags per trade.");
    } else {
      setSelectedGoodTags([...selectedGoodTags, tag]);
    }
  };

  const toggleMistake = (tag: string) => {
    if (selectedMistakes.includes(tag)) {
      setSelectedMistakes(selectedMistakes.filter((item) => item !== tag));
    } else if (selectedMistakes.length >= 20) {
      showToast("Tag limit reached", "error", "Choose up to 20 mistakes per trade.");
    } else {
      setSelectedMistakes([...selectedMistakes, tag]);
    }
  };

  const handleAddCustomTag = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    const clean = customTagInput.trim();
    if (!clean) return;
    if (clean.length > 80) {
      showToast("Tag is too long", "error", "Keep custom tags to 80 characters or fewer.");
      return;
    }

    if (customTagType === "good") {
      if (!selectedGoodTags.includes(clean)) {
        if (selectedGoodTags.length >= 20) {
          showToast("Tag limit reached", "error", "Choose up to 20 execution tags per trade.");
          return;
        }
        setSelectedGoodTags((prev) => [...prev, clean]);
      }
    } else {
      if (!selectedMistakes.includes(clean)) {
        if (selectedMistakes.length >= 20) {
          showToast("Tag limit reached", "error", "Choose up to 20 mistakes per trade.");
          return;
        }
        setSelectedMistakes((prev) => [...prev, clean]);
      }
    }

    if (!customTagPool.includes(clean)) {
      const updatedPool = [...customTagPool, clean];
      if (!user || !writeLocalStorageValue(customTagStorageKey, JSON.stringify(updatedPool))) {
        showToast("Tag could not be saved", "error", "Browser storage may be full or disabled.");
      }
    }
    setCustomTagInput("");
    showToast(`Added ${customTagType} tag "${clean}"`, "success");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenData && !ca) {
      showToast("Please enter a valid Contract Address or Token Name.", "error");
      return;
    }
    if (!result) {
      showToast("Choose the trade result", "error", "Select Win, Loss, or Break-Even before saving.");
      return;
    }
    if (setupType === "Custom" && !customSetup.trim()) {
      showToast("Describe the custom setup", "error", "Add a short setup name before saving.");
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
      const tradedAt = new Date(tradedAtInput).getTime();
      if (!Number.isFinite(tradedAt)) throw new RangeError("Choose a valid trade date and time.");

      if (!user) throw new Error("Please sign in before saving a trade.");
      const tradesCol = collection(db, "users", user.uid, "trades");

      const tradeDocument = {
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
        initialRiskSol: parsedInitialRiskSol,
        feesSol: parsedFeesSol,
        stopPrice: parsedStopPrice,
        entryLiquidityUsd: parsedEntryLiquidity,
        exitLiquidityUsd: parsedExitLiquidity,
        entryMarketCapUsd: parsedEntryMcap,
        exitMarketCapUsd: parsedExitMcap,
        slippagePct: parsedSlippage,
        entryTimezoneOffset: new Date().getTimezoneOffset(),
        tradedAt,
        solUsdRate: solPrice > 0 ? solPrice : null,
        solUsdRateSource: solPrice > 0 ? "live-at-entry" : "unknown",
        tradeMode: wallet === "Paper" ? "paper" : "real",
        goodTags: selectedGoodTags,
        mistakes: selectedMistakes,
        notes: notes.trim(),
        date: Timestamp.fromMillis(tradedAt),
        createdAt: Date.now(),
      };
      const validationError = getTradeCreateValidationError(tradeDocument);
      if (validationError) throw new RangeError(validationError);

      await addDoc(tradesCol, tradeDocument);

      showToast(
        "Trade saved to Cloud",
        "success",
        `${tokenData?.name || "Token"} logged (${parsedPnlSol >= 0 ? "+" : ""}${parsedPnlSol} SOL)`
      );
      onTradeLogged();
      onClose();
    } catch (error: unknown) {
      console.error("Error adding trade document:", error);
      const description = error instanceof Error && error.message
        ? error.message
        : "Check required fields and try again.";
      showToast("Could not save trade", "error", description);
    }
    setSaving(false);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-[#e9e9e7] rounded-2xl w-full max-w-xl shadow-xl relative text-[#37352f] flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Sticky Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 pb-4 border-b border-[#f1f1ef] shrink-0 bg-white z-10 relative">
          <div className="flex items-center gap-2">
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
          <button
            onClick={onClose}
            className="text-[#9b9a97] hover:text-[#37352f] transition-colors p-1.5 rounded-lg hover:bg-[#f1f1ef]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-4 sm:p-6 pt-4 overflow-y-auto custom-scrollbar">
          <form ref={formRef} id="log-trade-form" onSubmit={handleSubmit} className="space-y-4 text-xs">
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

            <div className="rounded-lg border border-dashed border-[#cfd8e3] bg-blue-50/30 p-3">
              <label className="block text-[11px] font-semibold text-[#37352f] mb-1">Quick paste (optional)</label>
              <textarea
                value={quickPaste}
                onChange={(e) => parseQuickPaste(e.target.value)}
                placeholder="Paste address + bought/sold, e.g. 9x... bought 0.5 sold 0.8"
                rows={2}
                className="w-full bg-white border border-[#d9e2ec] rounded-lg px-2.5 py-2 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2] font-mono"
              />
              <p className="text-[10px] text-[#787774] mt-1">Fills the contract address and SOL amounts. Review the values before saving.</p>
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
                <div className="text-right font-mono text-xs text-[#37352f] font-semibold">
                  ${parseFloat(tokenData.priceUsd || "0").toFixed(6)}
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
                <button
                  type="button"
                  onClick={() => setSetupType("Custom")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border ${
                    setupType === "Custom"
                      ? "bg-blue-50 border-[#2383e2] text-[#2383e2] font-semibold shadow-xs"
                      : "bg-[#fbfbfa] border-[#e3e2de] text-[#5a5957] hover:bg-[#f1f1ef]"
                  }`}
                >
                  Custom
                </button>
              </div>
              {setupType === "Custom" && <input
                  type="text"
                  value={customSetup}
                  onChange={(e) => setCustomSetup(e.target.value)}
                  placeholder="Describe your custom setup..."
                  className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
                />}
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

            <div>
              <label htmlFor="new-trade-date" className="mb-1.5 block font-medium text-[#787774]">Trade date and time</label>
              <input
                id="new-trade-date"
                type="datetime-local"
                value={tradedAtInput}
                onChange={(event) => setTradedAtInput(event.target.value)}
                className="w-full rounded-lg border border-[#e3e2de] bg-[#fbfbfa] px-3 py-2 text-xs text-[#37352f] focus:border-[#2383e2] focus:outline-none"
                required
              />
            </div>

            {/* Optional chart screenshot */}
            <details className="rounded-xl border border-[#e9e9e7] bg-[#fbfbfa] p-3" open={screenshotUrl ? true : undefined}>
              <summary className="cursor-pointer list-none font-medium text-[#787774] flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <ImageIcon size={12} className="text-purple-600" />
                  <span>Chart Screenshot <span className="text-[#9b9a97]">(optional)</span></span>
                </span>
                <span className="text-[10px] text-purple-600 font-medium">Add image</span>
              </summary>

              <div className="mt-3">

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
            </details>

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
                    placeholder={currencyMode === "SOL" ? "0.5 SOL" : "$75"}
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
                    placeholder={currencyMode === "SOL" ? "1.2 SOL" : "$180"}
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
                    placeholder={currencyMode === "SOL" ? "+0.70 SOL" : "+$105"}
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

                  <div className="col-span-2 sm:col-span-3 pt-2 border-t border-[#f1f1ef]">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9b9a97] mb-2">Expert market context</p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {[["Entry liquidity ($)", entryLiquidityUsd, setEntryLiquidityUsd], ["Exit liquidity ($)", exitLiquidityUsd, setExitLiquidityUsd], ["Entry mcap ($)", entryMarketCapUsd, setEntryMarketCapUsd], ["Exit mcap ($)", exitMarketCapUsd, setExitMarketCapUsd], ["Slippage (%)", slippagePct, setSlippagePct]].map(([label, value, setter]) => (
                        <label key={String(label)} className="text-[10px] text-[#787774]">{String(label)}<input type="number" step="any" value={String(value)} onChange={(e) => (setter as (v: string) => void)(e.target.value)} className="mt-1 w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]" /></label>
                      ))}
                    </div>
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
                <option value="Paper">Paper Trading Bag (Simulated)</option>
              </select>
            </div>

            {/* Categorized Tags: Separated into Good vs Mistakes */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-xs text-[#37352f] flex items-center gap-1.5">
                  <Tag size={13} className="text-[#2383e2]" />
                  <span>Execution & Psychology Tags</span>
                </label>
                <span className="text-[11px] text-[#9b9a97]">
                  {selectedGoodTags.length + selectedMistakes.length} selected
                </span>
              </div>

              {/* Section A: Good Execution & Discipline */}
              <div>
                <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 mb-1.5">
                  <ShieldCheck size={12} />
                  <span>Good Execution & Discipline (Things you did right)</span>
                </div>
                <div className="flex flex-wrap gap-1.5 p-2 bg-emerald-50/40 border border-emerald-200/60 rounded-lg">
                  {DEFAULT_GOOD_TAGS.filter((tag, index) => showAllTags || index < 4 || selectedGoodTags.includes(tag)).map((tag) => {
                    const isSelected = selectedGoodTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleGoodTag(tag)}
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
                  {DEFAULT_MISTAKE_TAGS.filter((tag, index) => showAllTags || index < 5 || selectedMistakes.includes(tag)).map((tag) => {
                    const isSelected = selectedMistakes.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleMistake(tag)}
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

              <button
                type="button"
                onClick={() => setShowAllTags((visible) => !visible)}
                className="text-[11px] font-medium text-[#2383e2] hover:underline"
              >
                {showAllTags ? "Show fewer tags" : "Show all tags and custom tags"}
              </button>

              {/* Custom Tag Input with explicit Good vs Mistake selection */}
              {showAllTags && <div className="flex flex-wrap gap-2 pt-1 items-center">
                <div className="flex items-center gap-1 bg-[#f1f1ef] p-0.5 rounded-lg border border-[#e3e2de] text-[11px]">
                  <button
                    type="button"
                    onClick={() => setCustomTagType("mistake")}
                    className={`px-2 py-0.5 rounded font-medium transition-all ${
                      customTagType === "mistake"
                        ? "bg-white text-rose-700 shadow-xs font-semibold"
                        : "text-[#787774]"
                    }`}
                  >
                    Mistake
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomTagType("good")}
                    className={`px-2 py-0.5 rounded font-medium transition-all ${
                      customTagType === "good"
                        ? "bg-white text-emerald-700 shadow-xs font-semibold"
                        : "text-[#787774]"
                    }`}
                  >
                    Good Tag
                  </button>
                </div>
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
                  className="flex-1 min-w-[150px] bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
                />
                <button
                  type="button"
                  onClick={(e) => handleAddCustomTag(e)}
                  className="px-3 py-1.5 bg-[#2383e2] hover:bg-[#1a73ca] text-white rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors shadow-xs"
                >
                  <Plus size={13} />
                  <span>Add Tag</span>
                </button>
              </div>}
            </div>

            {/* Trade Notes */}
            <div>
              <label className="block font-medium text-[#787774] mb-1">Trade Notes & Rationale</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={4000}
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
                id="log-trade-submit-btn"
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
    </div>
  );
}
