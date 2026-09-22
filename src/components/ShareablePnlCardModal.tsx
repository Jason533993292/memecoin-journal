"use client";

import { useState, useRef, useEffect } from "react";
import { Trade } from "../lib/types";
import {
  X,
  Copy,
  Check,
  Download,
  Sparkles,
  Image as ImageIcon,
  Upload,
  AtSign,
  TrendingUp,
  TrendingDown,
  Layers,
  Smartphone,
  Monitor,
  Square,
  Zap,
} from "lucide-react";
import { useToast } from "./Toast";

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
    id: "gigachad_custom",
    name: "Custom GigaChad",
    category: "win",
    imageSrc: "/memes/GigaChad.jpeg",
    accentColor: "#14f195",
    nodeColor: "rgba(20, 241, 149, 0.45)",
    objectPosition: "center right",
    scrimColor: "rgba(10, 10, 14, 0.95)",
  },
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
    id: "vince",
    name: "Vince Cash",
    category: "win",
    imageSrc: "/memes/vince.png",
    accentColor: "#00ff88",
    nodeColor: "rgba(0, 255, 136, 0.45)",
    objectPosition: "center right",
    scrimColor: "rgba(5, 18, 10, 0.95)",
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
  {
    id: "gigachad",
    name: "GigaChad",
    category: "win",
    imageSrc: "/memes/win_chad.jpg",
    accentColor: "#14f195",
    nodeColor: "rgba(20, 241, 149, 0.45)",
    objectPosition: "center right",
    scrimColor: "rgba(10, 10, 14, 0.95)",
  },
  {
    id: "bateman",
    name: "Patrick Bateman",
    category: "win",
    imageSrc: "/memes/bateman.jpg",
    accentColor: "#e2e8f0",
    nodeColor: "rgba(226, 232, 240, 0.45)",
    objectPosition: "center right",
    scrimColor: "rgba(15, 15, 18, 0.95)",
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

type AspectRatio = "16:9" | "1:1" | "9:16";

export default function ShareablePnlCardModal({
  trade,
  isOpen,
  onClose,
  solPrice = 150,
}: ShareablePnlCardModalProps) {
  const { showToast } = useToast();
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState<string>("wolf");
  const [themeFilter, setThemeFilter] = useState<"all" | "win" | "loss">("all");
  const [customImageSrc, setCustomImageSrc] = useState<string | null>(null);
  const [unit, setUnit] = useState<"SOL" | "USD" | "EUR">("SOL");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [tokenLogoUrl, setTokenLogoUrl] = useState<string | null>(null);
  const [cyberFx, setCyberFx] = useState(true);
  const [traderHandle, setTraderHandle] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved trader handle from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("journal_trader_handle");
      if (saved) setTraderHandle(saved);
    }
  }, []);

  const handleHandleChange = (val: string) => {
    setTraderHandle(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("journal_trader_handle", val);
    }
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
    const isWin = (trade.pnlSol || 0) >= 0;
    if (isWin) {
      setSelectedThemeId("wolf");
      setThemeFilter("win");
    } else {
      setSelectedThemeId("wojak");
      setThemeFilter("loss");
    }
    setCustomImageSrc(null);

    // Fetch token logo from DexScreener if CA is present
    if (trade.ca) {
      const cleanCa = trade.ca.trim();
      let active = true;
      fetch(`/api/token/${cleanCa}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (active && data?.imageUrl) {
            setTokenLogoUrl(data.imageUrl);
          }
        })
        .catch((e) => console.warn("Failed to fetch token logo:", e));

      return () => {
        active = false;
      };
    } else {
      setTokenLogoUrl(null);
    }
  }, [trade?.id, trade?.ca]);

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
  const USD_TO_EUR = 0.92;
  const pnlSol = trade.pnlSol || 0;
  const pnlUsd = trade.pnlUsd || pnlSol * solPrice;
  const pnlEur = pnlUsd * USD_TO_EUR;

  const boughtSol = trade.boughtSol || 0;
  const boughtUsd = trade.boughtUsd || boughtSol * solPrice;
  const boughtEur = boughtUsd * USD_TO_EUR;

  const soldSol = trade.soldSol || 0;
  const soldUsd = trade.soldUsd || soldSol * solPrice;
  const soldEur = soldUsd * USD_TO_EUR;

  const formatValue = (sol: number, usd: number, eur: number, showSign = false) => {
    if (unit === "SOL") {
      const sign = showSign && sol > 0 ? "+" : "";
      return `${sign}${sol.toFixed(2)} SOL`;
    }
    if (unit === "USD") {
      const sign = showSign && usd > 0 ? "+" : usd < 0 ? "-" : "";
      return `${sign}$${Math.abs(usd).toFixed(2)}`;
    }
    const sign = showSign && eur > 0 ? "+" : eur < 0 ? "-" : "";
    return `${sign}€${Math.abs(eur).toFixed(2)}`;
  };

  const badgeText = `≡ ${formatValue(pnlSol, pnlUsd, pnlEur, true)}`;
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
    let width = 1200;
    let height = 675; // default 16:9

    if (aspectRatio === "1:1") {
      width = 1080;
      height = 1080;
    } else if (aspectRatio === "9:16") {
      width = 1080;
      height = 1920;
    }

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

    // 2. Apply Scrim Gradient
    if (aspectRatio === "9:16") {
      // For vertical 9:16, dark gradient from top to bottom
      const scrimGrad = ctx.createLinearGradient(0, 0, 0, height);
      scrimGrad.addColorStop(0, "rgba(5, 8, 14, 0.96)");
      scrimGrad.addColorStop(0.35, "rgba(5, 8, 14, 0.88)");
      scrimGrad.addColorStop(0.65, "rgba(5, 8, 14, 0.4)");
      scrimGrad.addColorStop(1, "rgba(5, 8, 14, 0.95)");
      ctx.fillStyle = scrimGrad;
      ctx.fillRect(0, 0, width, height);
    } else {
      // For 16:9 and 1:1, horizontal left-side dark scrim
      const scrimGrad = ctx.createLinearGradient(0, 0, width, 0);
      scrimGrad.addColorStop(0, "rgba(5, 10, 18, 0.96)");
      scrimGrad.addColorStop(0.4, "rgba(5, 10, 18, 0.88)");
      scrimGrad.addColorStop(0.7, "rgba(5, 10, 18, 0.4)");
      scrimGrad.addColorStop(1, "rgba(5, 10, 18, 0.15)");
      ctx.fillStyle = scrimGrad;
      ctx.fillRect(0, 0, width, height);
    }

    // 3. Removed Digital Constellation Nodes

    // 4. Brand Watermark & Trader Tag (Top Right)
    ctx.textAlign = "right";

    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "bold 15px monospace";
    const watermarkText = traderHandle.trim()
      ? `BY ${traderHandle.toUpperCase()} • MEMECOIN JOURNAL`
      : "MEMECOIN JOURNAL";
    ctx.fillText(watermarkText, width - 60, 90);

    // 5. Token Logo + Name (Top Left)
    let textStartX = 60;
    const headerY = 100;

    // Draw circular token logo if available
    if (tokenLogoUrl) {
      try {
        const logoImg = await loadImage(tokenLogoUrl);
        const logoSize = 64;
        const logoX = 60;
        const logoY = headerY - 50;

        ctx.save();
        ctx.beginPath();
        ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
        ctx.restore();

        // Border ring around logo
        ctx.strokeStyle = activeAccentColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
        ctx.stroke();

        textStartX = 140;
      } catch {
        // Ignore logo load failure
      }
    }

    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 52px sans-serif";
    ctx.fillText(tokenName, textStartX, headerY);

    // 6. Pill Badge (≡ +X.XX SOL)
    ctx.font = "bold 24px sans-serif";
    const textWidth = ctx.measureText(badgeText).width;
    const badgeW = textWidth + 30;
    const badgeH = 44;
    const badgeX = textStartX;
    const badgeY = headerY + 22;

    ctx.fillStyle = activeAccentColor;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
    ctx.fill();

    ctx.fillStyle = "#000000";
    ctx.fillText(badgeText, badgeX + 15, badgeY + 31);

    // Multiple badge if available (e.g. 2.4x)
    if (multiplierVal) {
      const multText = `${multiplierVal}x`;
      const multWidth = ctx.measureText(multText).width + 24;
      const multX = badgeX + badgeW + 12;

      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.beginPath();
      ctx.roundRect(multX, badgeY, multWidth, badgeH, 6);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.fillText(multText, multX + 12, badgeY + 31);
    }

    // 7. Giant ROI Percentage (+80.91%)
    const roiY = aspectRatio === "9:16" ? 380 : 300;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 105px sans-serif";
    ctx.fillText(roiFormatted, 60, roiY);

    // 8. Financial Execution Table (BOUGHT / SOLD / PROFIT)
    const startY = aspectRatio === "9:16" ? 540 : 420;
    const rowGap = 65;
    const valueColX = 290;

    // Labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText("BOUGHT", 60, startY);
    ctx.fillText("SOLD", 60, startY + rowGap);
    ctx.fillText("PROFIT", 60, startY + rowGap * 2);

    // Values
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 34px sans-serif";
    ctx.fillText(formatValue(boughtSol, boughtUsd, boughtEur), valueColX, startY);
    ctx.fillText(formatValue(soldSol, soldUsd, soldEur), valueColX, startY + rowGap);

    // Profit Value (Glowing Highlight)
    ctx.fillStyle = isWin ? activeAccentColor : "#f87171";
    ctx.fillText(formatValue(pnlSol, pnlUsd, pnlEur, true), valueColX, startY + rowGap * 2);

    // Extra stats for 9:16 story format
    if (aspectRatio === "9:16" && trade.mcap) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.font = "bold 26px monospace";
      ctx.fillText(`MCAP AT TRADE: $${trade.mcap.toLocaleString()}`, 60, startY + rowGap * 3.5);
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
      a.download = `${tokenSymbol}-PnL-${aspectRatio.replace(":", "x")}-${selectedThemeId}.png`;
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

    // 2. Format viral CT tweet copy
    const authorTag = traderHandle.trim() ? `${traderHandle.trim()} ` : "";
    const emoji = isWin ? "🚀" : "😭";
    const statusPhrase = isWin
      ? `Closed another winner on $${tokenSymbol}`
      : `Took an L on $${tokenSymbol}... back to McDonald's`;

    const tweetText = `${emoji} ${statusPhrase} (${roiFormatted})

💰 P&L: ${formatValue(pnlSol, pnlUsd, pnlEur, true)}
💸 In: ${formatValue(boughtSol, boughtUsd, boughtEur)} | Out: ${formatValue(soldSol, soldUsd, soldEur)}${multiplierVal ? ` (${multiplierVal}x)` : ""}

${authorTag ? `Traded by ${authorTag}\n` : ""}Logged on Memecoin Journal 📊
#Solana #MemeCoins $${tokenSymbol}`;

    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    showToast("Card copied to clipboard! Paste (Cmd+V) into your tweet.", "info");
  };

  const shareText = `🚀 $${tokenSymbol} Trade Closed!
📈 ROI: ${roiFormatted}${multiplierVal ? ` (${multiplierVal}x)` : ""}
💰 Net: ${badgeText}
💸 Bought: ${formatValue(boughtSol, boughtUsd, boughtEur)} | Sold: ${formatValue(soldSol, soldUsd, soldEur)}
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
                <h2 className="text-sm font-bold tracking-tight">Dryflip Meme P&L Card Studio</h2>
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
                Pristine meme backgrounds, live token logo & 1-click X share.
              </p>
            </div>
          </div>

          {/* Currency Unit Toggle */}
          <div className="flex items-center gap-0.5 bg-black/60 p-0.5 rounded-lg border border-neutral-800 text-[11px] font-mono">
            {(["SOL", "USD", "EUR"] as const).map((curr) => (
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

        {/* Controls Bar: Category Filter, Aspect Ratio & Trader Handle */}
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
              <span>🚀 Win Memes</span>
            </button>
            <button
              onClick={() => setThemeFilter("loss")}
              className={`px-2 py-1 rounded font-medium text-[11px] flex items-center gap-1 transition-colors cursor-pointer ${
                themeFilter === "loss"
                  ? "bg-rose-950/80 text-rose-300 border border-rose-500/30"
                  : "text-neutral-400 hover:text-rose-300"
              }`}
            >
              <span>😭 Loss Memes</span>
            </button>
          </div>

          {/* Aspect Ratio Switcher */}
          <div className="flex items-center gap-1 bg-neutral-900/90 p-0.5 rounded-lg border border-neutral-800 text-xs">
            <button
              onClick={() => setAspectRatio("16:9")}
              title="Twitter / Desktop (16:9)"
              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                aspectRatio === "16:9" ? "bg-white text-black font-bold" : "text-neutral-400 hover:text-white"
              }`}
            >
              <Monitor size={12} />
              <span>16:9</span>
            </button>
            <button
              onClick={() => setAspectRatio("1:1")}
              title="Square / Instagram (1:1)"
              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                aspectRatio === "1:1" ? "bg-white text-black font-bold" : "text-neutral-400 hover:text-white"
              }`}
            >
              <Square size={12} />
              <span>1:1</span>
            </button>
            <button
              onClick={() => setAspectRatio("9:16")}
              title="Story / Telegram / TikTok (9:16)"
              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                aspectRatio === "9:16" ? "bg-white text-black font-bold" : "text-neutral-400 hover:text-white"
              }`}
            >
              <Smartphone size={12} />
              <span>9:16</span>
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
            className={`relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl select-none w-full transition-all duration-300 ${
              aspectRatio === "9:16"
                ? "max-w-[270px] aspect-[9/16]"
                : aspectRatio === "1:1"
                ? "max-w-[340px] aspect-square"
                : "aspect-[16/9] max-h-[320px]"
            }`}
          >
            {/* Pristine Meme Background Image */}
            <img
              src={activeImageSrc}
              alt="Clean Meme Background"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: currentPreset.objectPosition || "center right" }}
            />

            {/* Left-to-Right / Top-to-Bottom Contrast Gradient Scrim */}
            <div
              className={`absolute inset-0 ${
                aspectRatio === "9:16"
                  ? "bg-gradient-to-b from-[#060e18]/95 via-[#060e18]/70 to-[#060e18]/95"
                  : "bg-gradient-to-r from-[#060e18]/95 via-[#060e18]/85 to-transparent"
              }`}
            />

            {/* Subtle Neon Cyber Scanline / Pulse FX (Toggleable) */}
            {cyberFx && (
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.06),transparent_60%)]" />
            )}

            {/* Card Content Overlay */}
            <div className="relative z-10 p-4 sm:p-5 flex flex-col justify-between h-full space-y-2">
              {/* Top Row: Token Name + Logo + Watermark */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {/* Real Token Logo Avatar */}
                  {tokenLogoUrl ? (
                    <img
                      src={tokenLogoUrl}
                      alt={tokenSymbol}
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 shadow-lg shrink-0"
                      style={{ borderColor: activeAccentColor }}
                    />
                  ) : (
                    <div
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-xs sm:text-sm text-black shadow-lg shrink-0"
                      style={{ backgroundColor: activeAccentColor }}
                    >
                      {tokenSymbol.slice(0, 2)}
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg sm:text-2xl font-black tracking-tight text-white drop-shadow-md leading-tight">
                      {tokenName}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {/* Accent Pill Badge */}
                      <div
                        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] sm:text-xs font-black shadow-md"
                        style={{ backgroundColor: activeAccentColor, color: "#000000" }}
                      >
                        <span>{badgeText}</span>
                      </div>

                      {/* Multiplier Badge (if available) */}
                      {multiplierVal && (
                        <div className="px-1.5 py-0.5 rounded bg-white/20 text-white font-mono text-[10px] sm:text-[11px] font-bold">
                          {multiplierVal}x
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Watermark & Trader Handle */}
                <div className="text-right">
                  <div className="text-[10px] font-mono text-white/60 tracking-tight mt-0.5 uppercase">
                    {traderHandle.trim() ? `BY ${traderHandle} • MEMECOIN JOURNAL` : "MEMECOIN JOURNAL"}
                  </div>
                </div>
              </div>

              {/* Giant Bold ROI Percentage */}
              <div className="py-0.5">
                <div className="text-3xl sm:text-5xl font-black tracking-tight font-sans text-white drop-shadow-lg">
                  {roiFormatted}
                </div>
              </div>

              {/* Financial Execution Breakdown */}
              <div className="space-y-1 text-[11px] sm:text-xs font-semibold max-w-[260px] bg-black/40 p-2 sm:p-2.5 rounded-xl border border-white/5 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <span className="text-white/70 uppercase tracking-wider text-[10px]">BOUGHT</span>
                  <span className="font-mono text-white">{formatValue(boughtSol, boughtUsd, boughtEur)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/70 uppercase tracking-wider text-[10px]">SOLD</span>
                  <span className="font-mono text-white">{formatValue(soldSol, soldUsd, soldEur)}</span>
                </div>
                <div className="flex items-center justify-between pt-0.5 border-t border-white/10">
                  <span className="text-white/70 uppercase tracking-wider text-[10px]">PROFIT</span>
                  <span
                    className="font-mono font-bold"
                    style={{ color: isWin ? activeAccentColor : "#f87171" }}
                  >
                    {formatValue(pnlSol, pnlUsd, pnlEur, true)}
                  </span>
                </div>
              </div>
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
