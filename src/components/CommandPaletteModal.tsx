"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  LayoutDashboard,
  BookOpen,
  Wallet,
  BarChart3,
  Bot,
  Plus,
  FileSpreadsheet,
  Zap,
  ArrowRight,
  Sparkles,
  Command,
  X
} from "lucide-react";
import { Trade } from "../lib/types";

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
  onOpenNewTrade: () => void;
  trades: Trade[];
  onSelectTrade: (trade: Trade) => void;
}

export default function CommandPaletteModal({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenNewTrade,
  trades,
  onSelectTrade,
}: CommandPaletteModalProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredTrades = trades
    .filter(
      (t) =>
        t.name?.toLowerCase().includes(query.toLowerCase()) ||
        t.symbol?.toLowerCase().includes(query.toLowerCase()) ||
        t.ca?.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 5);

  const actions = [
    {
      id: "action-new-trade",
      title: "Log New Trade",
      category: "Actions",
      icon: Plus,
      shortcut: "N",
      run: () => {
        onClose();
        onOpenNewTrade();
      },
    },
    {
      id: "nav-dashboard",
      title: "Go to Dashboard",
      category: "Navigation",
      icon: LayoutDashboard,
      run: () => {
        onClose();
        onNavigateTab("dashboard");
      },
    },
    {
      id: "nav-journal",
      title: "Go to Trade Journal",
      category: "Navigation",
      icon: BookOpen,
      run: () => {
        onClose();
        onNavigateTab("journal");
      },
    },
    {
      id: "nav-wallets",
      title: "Go to Wallets & Balance Scanner",
      category: "Navigation",
      icon: Wallet,
      run: () => {
        onClose();
        onNavigateTab("wallets");
      },
    },
    {
      id: "nav-stats",
      title: "Go to Statistics & Equity Curve",
      category: "Navigation",
      icon: BarChart3,
      run: () => {
        onClose();
        onNavigateTab("statistics");
      },
    },
    {
      id: "nav-ai",
      title: "Open DeepSeek AI Coach Review",
      category: "AI Coach",
      icon: Bot,
      run: () => {
        onClose();
        onNavigateTab("ai-coach");
      },
    },
  ].filter((a) => a.title.toLowerCase().includes(query.toLowerCase()) || a.category.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white border border-[#e9e9e7] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-[#37352f]">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#f1f1ef] gap-2.5">
          <Search size={17} className="text-[#9b9a97] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
            placeholder="Type a command, coin name, CA, or navigate..."
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-[#9b9a97]"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-[#9b9a97] bg-[#f1f1ef] rounded border border-[#e3e2de]">
            Esc
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1 text-xs">
          {/* Recent Trades matching query */}
          {filteredTrades.length > 0 && (
            <div className="pb-2">
              <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#9b9a97] block">
                Matching Trades
              </span>
              {filteredTrades.map((trade) => (
                <button
                  key={trade.id}
                  onClick={() => {
                    onClose();
                    onSelectTrade(trade);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-[#f7f6f3] transition-colors text-left group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-[10px] font-bold">
                      {trade.symbol?.substring(0, 1)}
                    </span>
                    <span className="font-semibold text-[#37352f]">{trade.name}</span>
                    <span className="text-[#9b9a97]">${trade.symbol}</span>
                  </div>
                  <span
                    className={`font-mono font-bold text-[11px] ${
                      (trade.pnlSol || 0) >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {(trade.pnlSol || 0) >= 0 ? `+${trade.pnlSol}` : trade.pnlSol} SOL
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Quick Actions & Navigation */}
          <div>
            <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#9b9a97] block">
              Commands & Navigation
            </span>
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={action.run}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-[#f7f6f3] transition-colors text-left group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="p-1.5 rounded-md bg-[#f1f1ef] text-[#787774] group-hover:bg-blue-50 group-hover:text-[#2383e2] transition-colors">
                      <Icon size={14} />
                    </span>
                    <span className="font-medium text-[#37352f]">{action.title}</span>
                  </div>
                  {action.shortcut && (
                    <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-[#9b9a97] bg-[#f1f1ef] rounded border border-[#e3e2de]">
                      {action.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })}
          </div>

          {filteredTrades.length === 0 && actions.length === 0 && (
            <div className="py-8 text-center text-[#9b9a97] text-xs">No matching commands or trades found.</div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-[#fcfbf9] border-t border-[#f1f1ef] flex items-center justify-between text-[11px] text-[#9b9a97]">
          <span>Tip: Press <kbd className="font-mono bg-white px-1 border rounded">Cmd+K</kbd> anywhere</span>
          <span>Antigravity Journal Engine</span>
        </div>
      </div>
    </div>
  );
}
