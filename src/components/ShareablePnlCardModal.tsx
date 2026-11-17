"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useRef, useEffect } from "react";
import { Trade } from "../lib/types";
import {
  X,
  Copy,
  Check,
  Download,
  Image as ImageIcon,
  Upload,
  AtSign,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useToast } from "./Toast";
import { useAuth } from "../context/AuthContext";
import { getTradeBoughtUsd, getTradeSoldUsd, getUsdValueStatus } from "../lib/tradeCalculations";
import { selectSolanaTokenPair } from "../lib/tokenMarketData";
import { useLocalStorageValue, writeLocalStorageValue } from "../lib/useLocalStorage";
import BetaBadge from "./BetaBadge";
import { formatSol } from "../lib/utils";

interface ShareablePnlCardModalProps {
  trade: Trade | null;
  isOpen: boolean;
  onClose: () => void;
  solPrice?: number;
}

interface MemePreset {
  id: string;
  name: string;
  category: "win" | "loss";
  imageSrc: string;
  accentColor: string;
  nodeColor: string;
  objectPosition?: string;
  scrimColor?: string;
}

const MEME_PRESETS: MemePreset[] = [
  // Win / Chad Memes
  {
    id: "jeanphil",
    name: "Jean Phil",
    category: "win",
    imageSrc: "/memes/JeanPhil.jpeg",
    accentColor: "#38bdf8",
    nodeColor: "rgba(56, 189, 248, 0.45)",
    objectPosition: "center right",
    scrimColor: "rgba(8, 15, 22, 0.95)",
  },
  {
    id: "triple_t",
    name: "Triple T",
    category: "win",
    imageSrc: "/memes/Triple T.jpeg",
    accentColor: "#00ff88",
    nodeColor: "rgba(0, 255, 136, 0.45)",
    objectPosition: "center right",
    scrimColor: "rgba(5, 18, 10, 0.95)",
  },
  {
    id: "wolf",
    name: "Wolf of Wall St",
    category: "win",
    imageSrc: "/memes/wolf.jpg",
    accentColor: "#00ffd5",
    nodeColor: "rgba(0, 255, 213, 0.45)",
    objectPosition: "center right",
    scrimColor: "rgba(6, 14, 24, 0.95)",
  },
  {
    id: "huell",
    name: "Huell Cash Bed",
    category: "win",
    imageSrc: "/memes/huell.jpg",
    accentColor: "#38bdf8",
    nodeColor: "rgba(56, 189, 248, 0.45)",
    objectPosition: "center right",
    scrimColor: "rgba(8, 15, 22, 0.95)",
  },
  {
    id: "pepe",
    name: "Pepe Wall St",
    category: "win",
    imageSrc: "/memes/win_pepe.jpg",
    accentColor: "#22c55e",
    nodeColor: "rgba(34, 197, 94, 0.45)",
    objectPosition: "center center",
    scrimColor: "rgba(7, 20, 11, 0.95)",
  },
  // Loss / Down Bad Memes
  {
    id: "wojak",
    name: "McDonald's Wojak",
    category: "loss",
    imageSrc: "/memes/9-5.jpeg",
    accentColor: "#ef4444",
    nodeColor: "rgba(239, 68, 68, 0.45)",
    objectPosition: "center left",
    scrimColor: "rgba(12, 10, 15, 0.95)",
  },
  {
    id: "sadpepe",
    name: "Sad Pepe Rain",
    category: "loss",
    imageSrc: "/memes/sadpepe.jpg",
    accentColor: "#f43f5e",
    nodeColor: "rgba(244, 63, 94, 0.45)",
    objectPosition: "center right",
    scrimColor: "rgba(10, 8, 16, 0.95)",
  },
];

export default function ShareablePnlCardModal({
  trade,
  isOpen,
  onClose,
  solPrice = 150,
}: ShareablePnlCardModalProps) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState<string>(
    trade && (trade.pnlSol || 0) < 0 ? "wojak" : "wolf"
  );
  const [themeFilter, setThemeFilter] = useState<"all" | "win" | "loss">(
    trade && (trade.pnlSol || 0) < 0 ? "loss" : trade ? "win" : "all"
  );
  const [customImageSrc, setCustomImageSrc] = useState<string | null>(null);
  const [unit, setUnit] = useState<"SOL" | "USD">("SOL");
  const [layout, setLayout] = useState<"poster" | "performance">("performance");
  const [loadedBackgroundSrc, setLoadedBackgroundSrc] = useState<string | null>(null);
  const [tokenLogo, setTokenLogo] = useState<{ tradeId: string; url: string } | null>(null);
  const tokenLogoUrl = trade && tokenLogo?.tradeId === trade.id ? tokenLogo.url : null;
  const [cyberFx] = useState(true);
  const traderHandleStorageKey = user ? "memecoin_journal_" + user.uid + "_trader_handle" : "trader_handle";
  const traderHandle = useLocalStorageValue(traderHandleStorageKey) || "";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleHandleChange = (val: string) => {
    if (user) writeLocalStorageValue(traderHandleStorageKey, val);
  };

  // Close on Escape key
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

  // Auto-select Win vs Loss mood and fetch token logo when trade changes
  useEffect(() => {
    if (!trade) return;

    // Fetch public token artwork directly so sharing a card does not depend on
    // optional server-side credentials.
    if (trade?.ca && user) {
      const cleanCa = trade.ca.trim();
      let active = true;
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(cleanCa)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const bestPair = selectSolanaTokenPair(data, cleanCa);
          const imageUrl = bestPair?.info?.imageUrl;
          if (active && typeof imageUrl === "string") {
            setTokenLogo({ tradeId: trade.id, url: imageUrl });
          }
        })
        .catch((e) => console.warn("Failed to fetch token logo:", e));

      return () => {
        active = false;
      };
    }
  }, [trade, user]);

  if (!isOpen || !trade) return null;

  const isWin = (trade.pnlSol || 0) >= 0;
  const roiVal =
    trade.boughtSol && trade.boughtSol > 0
      ? ((trade.pnlSol || 0) / trade.boughtSol) * 100
      : 0;
  const roiFormatted = `${roiVal >= 0 ? "+" : ""}${roiVal.toFixed(2)}%`;

  // Multiple computation (e.g. 2.5x)
  const multiplierVal =
    trade.boughtSol && trade.boughtSol > 0 && trade.soldSol && trade.soldSol > 0
      ? (trade.soldSol / trade.boughtSol).toFixed(1)
      : null;

  // Currency values
  const pnlSol = trade.pnlSol || 0;
  const pnlUsd = getUsdValueStatus(trade, solPrice).value ?? 0;

  const boughtSol = trade.boughtSol || 0;
  const boughtUsd = getTradeBoughtUsd(trade, solPrice).value ?? 0;

  const soldSol = trade.soldSol || 0;
  const soldUsd = getTradeSoldUsd(trade, solPrice).value ?? 0;
  const marketCapUsd = trade.exitMarketCapUsd ?? trade.entryMarketCapUsd ?? trade.mcap ?? 0;

  const formatValue = (sol: number, usd: number, showSign = false) => {
    if (unit === "SOL") {
      const sign = showSign && sol > 0 ? "+" : "";
      return `${sign}${formatSol(sol)} SOL`;
    }
    const sign = showSign && usd > 0 ? "+" : usd < 0 ? "-" : "";
    return `${sign}$${Math.abs(usd).toFixed(2)}`;
  };

  const badgeText = formatValue(pnlSol, pnlUsd, true);
  const profitHeadline = unit === "USD"
    ? `${pnlUsd >= 0 ? "+" : "-"}$${Math.abs(pnlUsd).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : `${pnlSol >= 0 ? "+" : "-"}${formatSol(Math.abs(pnlSol))} SOL`;
  const spentHeadline = unit === "USD"
    ? `$${boughtUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : `${formatSol(boughtSol)} SOL`;
  const marketCapHeadline = marketCapUsd > 0
    ? `$${marketCapUsd >= 1_000_000 ? `${(marketCapUsd / 1_000_000).toFixed(2)}M` : marketCapUsd >= 1_000 ? `${(marketCapUsd / 1_000).toFixed(2)}K` : marketCapUsd.toFixed(0)}`
    : "—";
  const tokenName = (trade.name || trade.symbol || "MEMECOIN").toUpperCase();
  const tokenSymbol = (trade.symbol || "TOKEN").toUpperCase();

  const currentPreset =
    MEME_PRESETS.find((p) => p.id === selectedThemeId) || MEME_PRESETS[0];
  const activeImageSrc = customImageSrc || currentPreset.imageSrc;
  const activeAccentColor = currentPreset.accentColor;

  // Filter presets
  const filteredPresets = MEME_PRESETS.filter((p) => {
    if (themeFilter === "win") return p.category === "win";
    if (themeFilter === "loss") return p.category === "loss";
    return true;
  });

  // Handle custom image upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCustomImageSrc(event.target.result as string);
          showToast("Custom meme image applied!", "success");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper to load image for canvas
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  };

  // Draw HD Card onto Canvas for Download & Copy
  const generateCanvasImage = async (): Promise<HTMLCanvasElement | null> => {
    const canvas = document.createElement("canvas");
    const width = layout === "performance" ? 1080 : 1200;
    const height = layout === "performance" ? 1080 : 675;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // 1. Draw Clean Background Image
    try {
      const img = await loadImage(activeImageSrc);
      const imgRatio = img.width / img.height;
      const canvasRatio = width / height;
      let renderW = width;
      let renderH = height;
      let renderX = 0;
      let renderY = 0;

      if (imgRatio > canvasRatio) {
        renderW = height * imgRatio;
        renderX = width - renderW;
      } else {
        renderH = width / imgRatio;
        renderY = (height - renderH) / 2;
      }

      ctx.drawImage(img, renderX, renderY, renderW, renderH);
    } catch (e) {
      console.warn("Failed to load background image for canvas, using fallback gradient", e);
      ctx.fillStyle = isWin ? "#0c1b29" : "#1c0a0f";
      ctx.fillRect(0, 0, width, height);
    }

    // Darken the full image while preserving enough detail for a dramatic,
    // full-bleed social card.
    const scrimGrad = ctx.createLinearGradient(0, 0, 0, height);
    scrimGrad.addColorStop(0, "rgba(0, 0, 0, 0.5)");
    scrimGrad.addColorStop(0.48, "rgba(0, 0, 0, 0.34)");
    scrimGrad.addColorStop(1, "rgba(0, 0, 0, 0.88)");
    ctx.fillStyle = scrimGrad;
    ctx.fillRect(0, 0, width, height);

    const accent = isWin ? activeAccentColor : "#fb7185";
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    ctx.font = `700 ${layout === "performance" ? 24 : 18}px sans-serif`;
    const watermarkText = traderHandle.trim()
      ? `BY ${traderHandle.toUpperCase()} • MEMECOIN JOURNAL`
      : "MEMECOIN JOURNAL";
    ctx.fillText(watermarkText, width - 58, 62);

    let textStartX = 58;
    const headerY = layout === "performance" ? 170 : 122;
    const logoSize = layout === "performance" ? 104 : 70;

    if (tokenLogoUrl) {
      try {
        const logoImg = await loadImage(tokenLogoUrl);
        const logoX = 58;
        const logoY = headerY - logoSize + 8;

        ctx.save();
        ctx.beginPath();
        ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
        ctx.restore();

        // Border ring around logo
        ctx.strokeStyle = accent;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
        ctx.stroke();

        textStartX = logoX + logoSize + 26;
      } catch {
        // Ignore logo load failure
      }
    }

    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${layout === "performance" ? 52 : 48}px sans-serif`;
    ctx.fillText(tokenName, textStartX, headerY);
    ctx.fillStyle = "rgba(255,255,255,.72)";
    ctx.font = `700 ${layout === "performance" ? 27 : 22}px monospace`;
    ctx.fillText(`$${tokenSymbol}`, textStartX, headerY + 36);

    if (layout === "performance") {
      ctx.fillStyle = "rgba(255,255,255,.72)";
      ctx.font = "500 25px sans-serif";
      ctx.fillText("PROFIT", 58, 284);
      ctx.fillStyle = accent;
      ctx.font = "900 84px sans-serif";
      ctx.fillText(profitHeadline, 58, 372);

      ctx.font = "800 38px sans-serif";
      const roiWidth = ctx.measureText(roiFormatted).width + 52;
      ctx.fillStyle = isWin ? "rgba(16,185,129,.18)" : "rgba(244,63,94,.18)";
      ctx.strokeStyle = isWin ? "rgba(16,185,129,.6)" : "rgba(244,63,94,.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(58, 395, roiWidth, 70, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.fillText(`${isWin ? "▲" : "▼"} ${roiFormatted}`, 82, 443);

      // A restrained execution curve gives the card the same visual rhythm as
      // the references without pretending to be historical price data.
      const curve = new Path2D();
      curve.moveTo(58, 690);
      curve.bezierCurveTo(175, 690, 180, 545, 310, 595);
      curve.bezierCurveTo(430, 640, 470, 515, 590, 610);
      curve.bezierCurveTo(700, 695, 760, 505, 842, 550);
      curve.bezierCurveTo(915, 590, 950, isWin ? 430 : 675, 1022, isWin ? 470 : 650);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 8;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 18;
      ctx.stroke(curve);
      ctx.shadowBlur = 0;

      ctx.strokeStyle = "rgba(255,255,255,.18)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(58, 795);
      ctx.lineTo(1022, 795);
      ctx.stroke();

      const metrics = [
        ["SPENT", spentHeadline],
        ["AVERAGE ENTRY", trade.entryMarketCapUsd ? `$${trade.entryMarketCapUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"],
        ["MARKET CAP", marketCapHeadline],
      ];
      metrics.forEach(([label, value], index) => {
        const x = 58 + index * 320;
        ctx.fillStyle = "#ffffff";
        ctx.font = "800 34px sans-serif";
        ctx.fillText(value, x, 858);
        ctx.fillStyle = "rgba(255,255,255,.72)";
        ctx.font = "500 22px sans-serif";
        ctx.fillText(label, x, 891);
      });

      ctx.fillStyle = "rgba(0,0,0,.48)";
      ctx.beginPath();
      ctx.roundRect(58, 936, 964, 92, 18);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 27px monospace";
      const walletLabel = trade.wallet ? `${trade.wallet.slice(0, 7)}…${trade.wallet.slice(-5)}` : "PRIVATE WALLET";
      ctx.fillText(walletLabel, 86, 992);
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,.78)";
      ctx.fillText(trade.venue || "SOLANA", 994, 992);
    } else {
      ctx.fillStyle = "rgba(255,255,255,.72)";
      ctx.font = "600 23px sans-serif";
      ctx.fillText("REALIZED P&L", 58, 244);
      ctx.fillStyle = accent;
      ctx.font = "900 96px sans-serif";
      ctx.fillText(profitHeadline, 58, 338);
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 54px sans-serif";
      ctx.fillText(roiFormatted, 62, 405);

      const metrics = [
        ["INVESTED", formatValue(boughtSol, boughtUsd)],
        ["POSITION", formatValue(soldSol, soldUsd)],
        ["ROI", roiFormatted],
      ];
      metrics.forEach(([label, value], index) => {
        const x = 58 + index * 330;
        ctx.fillStyle = "rgba(255,255,255,.75)";
        ctx.font = "700 20px sans-serif";
        ctx.fillText(label, x, 552);
        ctx.fillStyle = index === 2 ? accent : "#ffffff";
        ctx.font = "800 34px sans-serif";
        ctx.fillText(value, x, 596);
      });
    }

    return canvas;
  };

  const handleDownloadImage = async () => {
    setDownloading(true);
    try {
      const canvas = await generateCanvasImage();
      if (!canvas) return;
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${tokenSymbol}-PnL-${selectedThemeId}.png`;
      a.click();
      showToast("HD Meme P&L Card downloaded!", "success");
    } catch (e) {
      console.error("Failed to generate image:", e);
      showToast("Could not generate image file", "error");
    }
    setDownloading(false);
  };

  const handleCopyImage = async () => {
    setCopiedImage(true);
    try {
      const canvas = await generateCanvasImage();
      if (canvas && typeof ClipboardItem !== "undefined") {
        canvas.toBlob(async (blob) => {
          if (blob) {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            showToast("HD P&L Card copied to clipboard!", "success");
          }
        });
      }
    } catch (e) {
      console.error(e);
      showToast("Direct image copy unsupported on this browser, downloading image...", "info");
      handleDownloadImage();
    }
    setTimeout(() => setCopiedImage(false), 2000);
  };

  // Direct 1-Click Share to X (Twitter)
  const handleShareToTwitter = async () => {
    // 1. Copy image to clipboard for easy Cmd+V attachment
    try {
      const canvas = await generateCanvasImage();
      if (canvas && typeof ClipboardItem !== "undefined") {
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            } catch {
              // Ignore clipboard restriction
            }
          }
        });
      }
    } catch {
      // Ignore
    }

    // 2. Format post copy
    const authorTag = traderHandle.trim() ? `${traderHandle.trim()} ` : "";
    const statusPhrase = isWin
      ? `Closed another winner on $${tokenSymbol}`
      : `Closed a losing trade on $${tokenSymbol}`;

    const tweetText = `${statusPhrase} (${roiFormatted})

P&L: ${formatValue(pnlSol, pnlUsd, true)}
In: ${formatValue(boughtSol, boughtUsd)} | Out: ${formatValue(soldSol, soldUsd)}${multiplierVal ? ` (${multiplierVal}x)` : ""}

${authorTag ? `Traded by ${authorTag}\n` : ""}Logged on Memecoin Journal
#Solana #MemeCoins $${tokenSymbol}`;

    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    showToast("Card copied to clipboard! Paste (Cmd+V) into your tweet.", "info");
  };

  const shareText = `$${tokenSymbol} trade closed
ROI: ${roiFormatted}${multiplierVal ? ` (${multiplierVal}x)` : ""}
Net: ${badgeText}
Bought: ${formatValue(boughtSol, boughtUsd)} | Sold: ${formatValue(soldSol, soldUsd)}
${traderHandle.trim() ? `Traded by ${traderHandle.trim()}\n` : ""}#Solana #MemeCoins via Memecoin Journal`;

  const copyShareText = () => {
    navigator.clipboard.writeText(shareText);
    setCopiedText(true);
    showToast("Post text copied for Twitter / Discord!", "success");
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0f1115] border border-neutral-800 rounded-2xl p-4 sm:p-5 w-full max-w-2xl shadow-2xl relative text-white space-y-3.5 my-auto animate-in zoom-in-95 duration-150"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-neutral-800 transition-colors z-20 cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Modal Header & Quick Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
          <div className="flex items-center gap-2">
            <span
              className="p-1.5 rounded-lg border flex items-center justify-center"
              style={{
                backgroundColor: isWin ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                borderColor: isWin ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)",
                color: isWin ? "#10b981" : "#ef4444",
              }}
            >
              {isWin ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">P&amp;L Card</h2>
                <BetaBadge tone="dark" />
                <span
                  className="text-[10px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider"
                  style={{
                    backgroundColor: isWin ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                    color: isWin ? "#34d399" : "#f87171",
                  }}
                >
                  {isWin ? "Winner" : "Down Bad"}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Choose a background, preview the result, then download or share.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 bg-black/60 p-0.5 rounded-lg border border-neutral-800 text-[11px]">
              {(["poster", "performance"] as const).map((cardLayout) => (
                <button
                  key={cardLayout}
                  onClick={() => setLayout(cardLayout)}
                  className={`px-2 py-0.5 rounded-md font-bold capitalize transition-all cursor-pointer ${
                    layout === cardLayout ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {cardLayout === "poster" ? "Wide" : "Square"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5 bg-black/60 p-0.5 rounded-lg border border-neutral-800 text-[11px] font-mono">
              {(["SOL", "USD"] as const).map((curr) => (
                <button
                  key={curr}
                  onClick={() => setUnit(curr)}
                  className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                    unit === curr ? "bg-white text-black" : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Controls Bar: Category Filter & Trader Handle */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 border-t border-b border-neutral-800/80 py-2">
          {/* Mood Preset Filter */}
          <div className="flex items-center gap-1 bg-neutral-900/90 p-0.5 rounded-lg border border-neutral-800 text-xs">
            <button
              onClick={() => setThemeFilter("all")}
              className={`px-2 py-1 rounded font-medium text-[11px] transition-colors cursor-pointer ${
                themeFilter === "all" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setThemeFilter("win")}
              className={`px-2 py-1 rounded font-medium text-[11px] flex items-center gap-1 transition-colors cursor-pointer ${
                themeFilter === "win"
                  ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/30"
                  : "text-neutral-400 hover:text-emerald-300"
              }`}
            >
              <TrendingUp size={12} />
              <span>Wins</span>
            </button>
            <button
              onClick={() => setThemeFilter("loss")}
              className={`px-2 py-1 rounded font-medium text-[11px] flex items-center gap-1 transition-colors cursor-pointer ${
                themeFilter === "loss"
                  ? "bg-rose-950/80 text-rose-300 border border-rose-500/30"
                  : "text-neutral-400 hover:text-rose-300"
              }`}
            >
              <TrendingDown size={12} />
              <span>Losses</span>
            </button>
          </div>

          {/* Trader Handle / Watermark Input */}
          <div className="flex items-center gap-1.5 bg-neutral-900/90 px-2 py-1 rounded-lg border border-neutral-800 text-xs min-w-[170px] flex-1 sm:flex-initial">
            <AtSign size={13} className="text-neutral-400 shrink-0" />
            <input
              type="text"
              value={traderHandle}
              onChange={(e) => handleHandleChange(e.target.value)}
              placeholder="Your Twitter (e.g. @phil)"
              className="bg-transparent border-none text-[11px] text-white placeholder-neutral-500 focus:outline-none w-full"
            />
          </div>
        </div>

        {/* Theme Thumbnails Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full scrollbar-none">
          {filteredPresets.map((preset) => {
            const isSelected = selectedThemeId === preset.id && !customImageSrc;
            return (
              <button
                key={preset.id}
                onClick={() => {
                  setSelectedThemeId(preset.id);
                  setCustomImageSrc(null);
                }}
                className={`relative rounded-lg overflow-hidden border-2 transition-all p-0.5 group flex items-center gap-1.5 pr-2 bg-neutral-900 cursor-pointer shrink-0 ${
                  isSelected
                    ? "border-emerald-400 shadow-md ring-2 ring-emerald-500/30"
                    : "border-neutral-800 opacity-70 hover:opacity-100 hover:border-neutral-600"
                }`}
              >
                <img
                  src={preset.imageSrc}
                  alt={preset.name}
                  loading="lazy"
                  decoding="async"
                  className="w-8 h-6 object-cover rounded"
                />
                <span className="text-[11px] font-semibold text-white whitespace-nowrap">
                  {preset.name}
                </span>
              </button>
            );
          })}

          {/* Custom Upload Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-lg border border-dashed px-2 py-1 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
              customImageSrc
                ? "border-emerald-400 text-emerald-300 bg-emerald-950/40"
                : "border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 bg-neutral-900"
            }`}
            title="Upload custom background image"
          >
            <Upload size={12} />
            <span>{customImageSrc ? "Custom Active" : "Upload Custom"}</span>
          </button>
        </div>

        {/* Live Visual P&L Card Container */}
        <div className="flex items-center justify-center bg-black/40 p-1.5 rounded-xl border border-neutral-900">
          <div
            className={`relative w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl select-none ${
              layout === "performance" ? "aspect-square max-h-[480px] max-w-[480px]" : "aspect-[16/9] max-h-[340px]"
            }`}
          >
            {loadedBackgroundSrc !== activeImageSrc && (
              <div className="absolute inset-0 animate-pulse bg-neutral-900" aria-hidden="true" />
            )}
            {/* Pristine Meme Background Image */}
            <img
              src={activeImageSrc}
              alt="Clean Meme Background"
              decoding="async"
              fetchPriority="high"
              onLoad={() => setLoadedBackgroundSrc(activeImageSrc)}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
                loadedBackgroundSrc === activeImageSrc ? "opacity-100" : "opacity-0"
              }`}
              style={{ objectPosition: currentPreset.objectPosition || "center right" }}
            />

            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/90" />

            {/* Subtle Neon Cyber Scanline / Pulse FX (Toggleable) */}
            {cyberFx && (
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.06),transparent_60%)]" />
            )}

            <div className="relative z-10 flex h-full flex-col p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  {tokenLogoUrl ? (
                    <img
                      src={tokenLogoUrl}
                      alt={tokenSymbol}
                      className={`${layout === "performance" ? "h-12 w-12 sm:h-16 sm:w-16" : "h-10 w-10"} shrink-0 rounded-2xl border-2 object-cover shadow-lg`}
                      style={{ borderColor: isWin ? activeAccentColor : "#fb7185" }}
                    />
                  ) : (
                    <div
                      className={`${layout === "performance" ? "h-12 w-12 sm:h-16 sm:w-16" : "h-10 w-10"} flex shrink-0 items-center justify-center rounded-2xl text-sm font-black text-black shadow-lg`}
                      style={{ backgroundColor: isWin ? activeAccentColor : "#fb7185" }}
                    >
                      {tokenSymbol.slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className={`${layout === "performance" ? "text-xl sm:text-3xl" : "text-lg sm:text-2xl"} truncate font-black leading-tight tracking-tight text-white drop-shadow-md`}>
                      {tokenName}
                    </h3>
                    <p className="font-mono text-xs font-bold text-white/70 sm:text-sm">${tokenSymbol}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right text-[8px] font-bold uppercase tracking-wide text-white/65 sm:text-[10px]">
                  {traderHandle.trim() ? `BY ${traderHandle}` : "MEMECOIN JOURNAL"}
                </div>
              </div>

              <div className={layout === "performance" ? "mt-6 sm:mt-8" : "mt-auto"}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70 sm:text-xs">Realized profit</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3">
                  <strong
                    className={`${layout === "performance" ? "text-3xl sm:text-5xl" : "text-3xl sm:text-5xl"} font-black tracking-tight drop-shadow-lg`}
                    style={{ color: isWin ? activeAccentColor : "#fb7185" }}
                  >
                    {profitHeadline}
                  </strong>
                  <span
                    className="rounded-lg border px-2 py-1 text-sm font-black sm:text-lg"
                    style={{ color: isWin ? activeAccentColor : "#fb7185", borderColor: isWin ? `${activeAccentColor}80` : "#fb718580", backgroundColor: isWin ? `${activeAccentColor}22` : "#fb718522" }}
                  >
                    {isWin ? "▲" : "▼"} {roiFormatted}
                  </span>
                </div>
              </div>

              {layout === "performance" && (
                <svg className="mt-auto h-[23%] w-full overflow-visible" viewBox="0 0 600 150" role="img" aria-label={`${isWin ? "Upward" : "Downward"} decorative trade result curve`}>
                  <defs>
                    <linearGradient id="pnlArea" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor={isWin ? activeAccentColor : "#fb7185"} stopOpacity=".4" />
                      <stop offset="1" stopColor={isWin ? activeAccentColor : "#fb7185"} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={isWin ? "M0 132 C70 132 75 58 150 88 S235 43 315 98 S420 48 475 74 S545 18 600 35 L600 150 L0 150Z" : "M0 45 C80 25 100 95 170 65 S270 115 340 82 S450 130 510 105 S570 138 600 125 L600 150 L0 150Z"} fill="url(#pnlArea)" />
                  <path d={isWin ? "M0 132 C70 132 75 58 150 88 S235 43 315 98 S420 48 475 74 S545 18 600 35" : "M0 45 C80 25 100 95 170 65 S270 115 340 82 S450 130 510 105 S570 138 600 125"} fill="none" stroke={isWin ? activeAccentColor : "#fb7185"} strokeWidth="5" strokeLinecap="round" />
                </svg>
              )}

              <div className={`${layout === "performance" ? "mt-3" : "mt-auto"} grid grid-cols-3 gap-2 border-t border-white/20 pt-3`}>
                {[
                  [layout === "performance" ? "Spent" : "Invested", spentHeadline],
                  [layout === "performance" ? "Avg. entry" : "Position", layout === "performance" ? (trade.entryMarketCapUsd ? `$${trade.entryMarketCapUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—") : formatValue(soldSol, soldUsd)],
                  [layout === "performance" ? "Market cap" : "ROI", layout === "performance" ? marketCapHeadline : roiFormatted],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <strong className="block truncate text-xs font-black text-white sm:text-base">{value}</strong>
                    <span className="text-[8px] font-medium text-white/70 sm:text-[10px]">{label}</span>
                  </div>
                ))}
              </div>

              {layout === "performance" && (
                <div className="mt-3 flex items-center justify-between rounded-lg bg-black/45 px-3 py-2 font-mono text-[9px] font-semibold text-white/80 sm:text-xs">
                  <span>{trade.wallet ? `${trade.wallet.slice(0, 7)}…${trade.wallet.slice(-5)}` : "PRIVATE WALLET"}</span>
                  <span>{trade.venue || "SOLANA"}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {/* 1-Click Share to X (Twitter) */}
          <button
            onClick={handleShareToTwitter}
            className="bg-black hover:bg-neutral-900 text-white py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-neutral-700 shadow-md active:scale-98 cursor-pointer group"
          >
            {/* Official X Logo SVG */}
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span>Share to 𝕏</span>
          </button>

          {/* Download HD Card */}
          <button
            onClick={handleDownloadImage}
            disabled={downloading}
            className="bg-white hover:bg-neutral-200 text-black py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-98 cursor-pointer"
          >
            <Download size={14} />
            <span>{downloading ? "Rendering..." : "Download HD"}</span>
          </button>

          {/* Copy Image to Clipboard */}
          <button
            onClick={handleCopyImage}
            className="bg-neutral-800 hover:bg-neutral-700 text-white py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-neutral-700 active:scale-98 cursor-pointer"
          >
            {copiedImage ? <Check size={14} className="text-emerald-400" /> : <ImageIcon size={14} />}
            <span>{copiedImage ? "Copied!" : "Copy Image"}</span>
          </button>

          {/* Copy Post Text */}
          <button
            onClick={copyShareText}
            className="bg-neutral-800 hover:bg-neutral-700 text-white py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-neutral-700 active:scale-98 cursor-pointer"
          >
            {copiedText ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copiedText ? "Copied!" : "Copy Post"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
