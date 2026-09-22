"use client";

import { Trade } from "../lib/types";
import {
  X,
  ExternalLink,
  Copy,
  Check,
  Edit2,
  Trash2,
  ShieldAlert,
  Wallet,
  Calendar,
  DollarSign,
  FileText,
  Share2,
  Image as ImageIcon,
  Clock,
  Layers,
  Maximize2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "./Toast";
import ImageLightboxModal from "./ImageLightboxModal";

interface TradeDetailDrawerProps {
  trade: Trade | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (trade: Trade) => void;
  onDelete: (id: string) => void;
  onShare?: (trade: Trade) => void;
}

export default function TradeDetailDrawer({
  trade,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onShare,
}: TradeDetailDrawerProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !lightboxOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, lightboxOpen]);

  if (!isOpen || !trade) return null;

  const copyCa = () => {
    if (!trade.ca) return;
    navigator.clipboard.writeText(trade.ca);
    setCopied(true);
    showToast("CA copied to clipboard", "success");
    setTimeout(() => setCopied(false), 1500);
  };

  const dateStr = trade.date?.seconds
    ? new Date(trade.date.seconds * 1000).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Recent";

  const roiPercent =
    trade.boughtSol && trade.boughtSol > 0
      ? (((trade.pnlSol || 0) / trade.boughtSol) * 100).toFixed(1)
      : null;

  const formatDuration = (mins?: number) => {
    if (!mins) return null;
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainder = mins % 60;
    return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
  };

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity duration-150"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200 border-l border-[#e9e9e7] text-[#37352f]"
        >
          {/* Main Content Area */}
          <div>
            {/* Header */}
            <div className="p-3.5 px-5 border-b border-[#f1f1ef] flex items-center justify-between bg-[#fbfbfa]">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-xs font-bold text-neutral-700 shadow-2xs">
                  {trade.symbol?.substring(0, 2).toUpperCase()}
                </span>
                <div>
                  <h2 className="text-sm font-bold text-[#37352f] flex items-center gap-1.5 leading-tight">
                    <span>{trade.name || trade.symbol}</span>
                    <span className="text-[11px] font-mono font-normal text-[#787774]">${trade.symbol}</span>
                  </h2>
                  <div className="text-[10px] text-[#787774] flex items-center gap-1 mt-0.5">
                    <Calendar size={11} />
                    <span>{dateStr}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    onClose();
                    onEdit(trade);
                  }}
                  className="p-1.5 rounded-md hover:bg-[#f1f1ef] text-[#787774] hover:text-[#37352f] transition-colors"
                  title="Edit trade"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onDelete(trade.id);
                  }}
                  className="p-1.5 rounded-md hover:bg-rose-50 text-[#787774] hover:text-rose-600 transition-colors"
                  title="Delete trade"
                >
                  <Trash2 size={15} />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-md hover:bg-[#f1f1ef] text-[#787774] hover:text-[#37352f] transition-colors ml-0.5"
                  title="Close drawer"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3.5">
              {/* Outcome Banner */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  trade.result === "Win"
                    ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                    : trade.result === "Loss"
                    ? "bg-rose-50/80 border-rose-200 text-rose-900"
                    : "bg-neutral-100/80 border-neutral-200 text-neutral-800"
                }`}
              >
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-semibold opacity-75">
                    Result Outcome
                  </span>
                  <div className="text-lg font-extrabold flex items-center gap-1.5">
                    <span>{trade.result === "Win" ? "🏆 Win" : trade.result === "Loss" ? "💥 Loss" : "⚖️ Breakeven"}</span>
                    {roiPercent && (
                      <span className="text-xs font-semibold opacity-85">
                        ({Number(roiPercent) > 0 ? `+${roiPercent}` : roiPercent}%)
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider font-semibold opacity-75">
                    Net Realized
                  </span>
                  <div className="text-base font-mono font-bold">
                    {(trade.pnlSol || 0) > 0 ? `+${trade.pnlSol} SOL` : `${trade.pnlSol || 0} SOL`}
                  </div>
                  <div className="text-[11px] font-mono opacity-80">
                    {(trade.pnlUsd || 0) >= 0 ? `+$${(trade.pnlUsd || 0).toFixed(2)}` : `-$${Math.abs(trade.pnlUsd || 0).toFixed(2)}`}
                  </div>
                </div>
              </div>

              {/* Setup & Duration Badges */}
              {(trade.setupType || trade.durationMinutes) && (
                <div className="flex flex-wrap items-center gap-2">
                  {trade.setupType && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-[#2383e2] border border-blue-200">
                      <Layers size={12} />
                      <span>{trade.setupType}</span>
                    </div>
                  )}

                  {trade.durationMinutes && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
                      <Clock size={12} />
                      <span>Hold Time: {formatDuration(trade.durationMinutes)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Chart Screenshot Section */}
              {trade.screenshotUrl && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold text-[#787774] uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <ImageIcon size={11} className="text-purple-600" />
                      <span>Chart Setup Screenshot</span>
                    </span>
                    <button
                      onClick={() => setLightboxOpen(true)}
                      className="text-[#2383e2] hover:underline flex items-center gap-0.5 normal-case font-medium"
                    >
                      <Maximize2 size={10} />
                      <span>View Fullscreen</span>
                    </button>
                  </div>

                  <div
                    onClick={() => setLightboxOpen(true)}
                    className="relative rounded-xl border border-[#e9e9e7] overflow-hidden bg-neutral-950 cursor-pointer group shadow-xs"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={trade.screenshotUrl}
                      alt="Trade Chart"
                      className="w-full h-44 object-contain group-hover:scale-102 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="bg-neutral-900/90 text-white text-[11px] font-medium px-3 py-1.5 rounded-lg backdrop-blur-xs flex items-center gap-1 shadow-lg">
                        <Maximize2 size={12} />
                        <span>Click to Expand</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Contract Address Box & Quick External Links */}
              {trade.ca && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-2 bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg">
                    <span className="font-mono text-[11px] text-[#37352f] truncate mr-2" title={trade.ca}>
                      {trade.ca}
                    </span>
                    <button
                      onClick={copyCa}
                      className="p-1 text-[#787774] hover:text-[#37352f] rounded hover:bg-[#f1f1ef] transition-colors shrink-0"
                      title="Copy CA"
                    >
                      {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    </button>
                  </div>

                  {/* External Trading Tool Links */}
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <a
                      href={`https://dexscreener.com/solana/${trade.ca}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-0.5 bg-[#f7f6f3] hover:bg-[#eeece8] border border-[#e3e2de] rounded text-[#37352f] font-medium flex items-center gap-1 transition-colors"
                    >
                      <ExternalLink size={10} className="text-[#2383e2]" />
                      <span>DexScreener</span>
                    </a>
                    <a
                      href={`https://axiom.trade/token/${trade.ca}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-0.5 bg-[#f7f6f3] hover:bg-[#eeece8] border border-[#e3e2de] rounded text-[#37352f] font-medium flex items-center gap-1 transition-colors"
                    >
                      <ExternalLink size={10} className="text-[#2383e2]" />
                      <span>Axiom</span>
                    </a>
                    <a
                      href={`https://bullx.io/terminal?chainId=1399811149&address=${trade.ca}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-0.5 bg-[#f7f6f3] hover:bg-[#eeece8] border border-[#e3e2de] rounded text-[#37352f] font-medium flex items-center gap-1 transition-colors"
                    >
                      <ExternalLink size={10} className="text-emerald-600" />
                      <span>BullX</span>
                    </a>
                    <a
                      href={`https://rugcheck.xyz/tokens/${trade.ca}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-0.5 bg-[#f7f6f3] hover:bg-[#eeece8] border border-[#e3e2de] rounded text-[#37352f] font-medium flex items-center gap-1 transition-colors"
                    >
                      <ShieldAlert size={10} className="text-amber-600" />
                      <span>RugCheck</span>
                    </a>
                    <a
                      href={`https://solscan.io/token/${trade.ca}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-0.5 bg-[#f7f6f3] hover:bg-[#eeece8] border border-[#e3e2de] rounded text-[#37352f] font-medium flex items-center gap-1 transition-colors"
                    >
                      <span>Solscan</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Position Size & Execution Details */}
              <div>
                <h3 className="text-[10px] font-bold text-[#787774] uppercase tracking-wider mb-1.5">
                  Execution Breakdown
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg">
                    <span className="text-[10px] text-[#787774] block">Bought (Position)</span>
                    <div className="font-mono font-semibold text-xs text-[#37352f] mt-0.5">
                      {trade.boughtSol || 0} SOL
                    </div>
                    <span className="text-[10px] text-[#9b9a97]">${(trade.boughtUsd || (trade.boughtSol || 0) * 150).toFixed(2)}</span>
                  </div>

                  <div className="p-2.5 bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg">
                    <span className="text-[10px] text-[#787774] block">Sold (Proceeds)</span>
                    <div className="font-mono font-semibold text-xs text-[#37352f] mt-0.5">
                      {trade.soldSol || 0} SOL
                    </div>
                    <span className="text-[10px] text-[#9b9a97]">${(trade.soldUsd || (trade.soldSol || 0) * 150).toFixed(2)}</span>
                  </div>

                  <div className="p-2.5 bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg">
                    <span className="text-[10px] text-[#787774] block">Wallet</span>
                    <div className="font-medium text-xs text-[#37352f] mt-0.5 flex items-center gap-1">
                      <Wallet size={12} className="text-[#787774]" />
                      <span>{trade.wallet || "Main"}</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg">
                    <span className="text-[10px] text-[#787774] block">MCap at Trade</span>
                    <div className="font-medium text-xs text-[#37352f] mt-0.5">
                      {trade.mcap ? `$${trade.mcap.toLocaleString()}` : "Not logged"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mistake & Discipline Tags */}
              <div>
                <h3 className="text-[10px] font-bold text-[#787774] uppercase tracking-wider mb-1.5">
                  Discipline & Psychology Tags
                </h3>
                {trade.mistakes && trade.mistakes.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {trade.mistakes.map((tag, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                          tag.includes("Followed Rules") || tag.includes("Good Entry") || tag.includes("Safe") || tag.includes("Secured")
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[#9b9a97] italic">No emotional tags recorded for this trade.</p>
                )}
              </div>

              {/* Notes & Journal Diary */}
              <div>
                <h3 className="text-[10px] font-bold text-[#787774] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <FileText size={11} />
                  <span>Trade Journal Entry</span>
                </h3>
                <div className="p-2.5 bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg text-xs text-[#37352f] leading-relaxed whitespace-pre-line max-h-24 overflow-y-auto">
                  {trade.notes || "No additional notes or rationale logged for this trade."}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-3 px-5 border-t border-[#f1f1ef] bg-[#fcfbf9] flex items-center justify-between shrink-0">
            <button
              onClick={() => {
                onClose();
                onDelete(trade.id);
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium px-2.5 py-1 rounded hover:bg-rose-50 transition-colors"
            >
              Delete Trade
            </button>
            <div className="flex items-center gap-2">
              {onShare && (
                <button
                  onClick={() => {
                    onClose();
                    onShare(trade);
                  }}
                  className="bg-neutral-900 hover:bg-black text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Share2 size={13} />
                  <span>Share P&L Card</span>
                </button>
              )}
              <button
                onClick={() => {
                  onClose();
                  onEdit(trade);
                }}
                className="bg-[#2383e2] hover:bg-[#1a73ca] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-xs"
              >
                Edit Trade
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Screenshot Lightbox */}
      {trade.screenshotUrl && (
        <ImageLightboxModal
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          imageUrl={trade.screenshotUrl}
          title={`${trade.name || trade.symbol} Chart Setup`}
        />
      )}
    </>
  );
}
