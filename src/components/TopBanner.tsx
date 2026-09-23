"use client";

import SolanaLogo from "./SolanaLogo";
import {
  LayoutDashboard,
  BookOpen,
  Wallet,
  BarChart3,
  Bot,
  TrendingUp,
  TrendingDown,
  Command,
  Sparkles,
  Plus,
} from "lucide-react";

interface TopBannerProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenNewTrade: () => void;
  onOpenCommandPalette?: () => void;
  onOpenDailyRecap?: () => void;
  solPrice?: number;
  solChange24h?: number;
}

export default function TopBanner({
  currentTab,
  setCurrentTab,
  onOpenNewTrade,
  onOpenCommandPalette,
  onOpenDailyRecap,
  solPrice = 150,
  solChange24h = 0,
}: TopBannerProps) {
  const tabs = [
    { id: "dashboard", label: "Dashboard", fullLabel: "MemeCoins Dashboard", icon: LayoutDashboard },
    { id: "journal", label: "Journal", fullLabel: "Trade Journal", icon: BookOpen },
    { id: "wallets", label: "Wallets", fullLabel: "Wallets & Paychecks", icon: Wallet },
    { id: "statistics", label: "Analytics", fullLabel: "Statistics", icon: BarChart3 },
    { id: "ai-coach", label: "AI Coach", fullLabel: "AI Trader Coach", icon: Bot },
  ];

  return (
    <div className="w-full">
      {/* Top Navigation Bar */}
      <div className="bg-[#f7f6f3] border-b border-[#e9e9e7] px-3 sm:px-4 py-2 flex items-center justify-between text-xs text-[#787774] sticky top-0 z-40 backdrop-blur-md">
        {/* Desktop & Mobile Scrollable Tab Bar */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 max-w-[65%] sm:max-w-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md transition-all whitespace-nowrap text-xs ${
                  isActive
                    ? "bg-white text-[#37352f] font-semibold shadow-xs border border-[#e3e2de]"
                    : "hover:bg-[#eeece8] text-[#5a5957]"
                }`}
              >
                <Icon size={14} className={isActive ? "text-[#2383e2]" : "text-[#908e89]"} />
                <span className="hidden md:inline">{tab.fullLabel}</span>
                <span className="md:hidden">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Live SOL Price Badge */}
          <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 bg-white border border-[#e3e2de] rounded-md text-[11px] font-mono shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[#37352f] font-semibold">
              ${solPrice.toFixed(2)}
            </span>
            {solChange24h !== 0 && (
              <span
                className={`hidden sm:inline text-[10px] font-medium ${
                  solChange24h >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {solChange24h >= 0 ? `+${solChange24h.toFixed(1)}%` : `${solChange24h.toFixed(1)}%`}
              </span>
            )}
          </div>

          {/* Daily Recap Button on Header */}
          {onOpenDailyRecap && (
            <button
              onClick={onOpenDailyRecap}
              className="hidden lg:flex items-center gap-1 text-[11px] text-[#37352f] border border-[#e3e2de] rounded-md px-2.5 py-1 bg-white hover:bg-[#f1f1ef] transition-colors shadow-xs font-medium"
              title="Today's Trading Recap"
            >
              <Sparkles size={12} className="text-amber-600" />
              <span>Recap</span>
            </button>
          )}

          {/* Cmd+K shortcut */}
          <button
            onClick={onOpenCommandPalette}
            className="hidden md:flex items-center gap-1 text-[11px] text-[#787774] border border-[#e3e2de] rounded-md px-2 py-1 bg-white hover:bg-[#f1f1ef] transition-colors shadow-xs"
            title="Open Command Palette"
          >
            <Command size={12} />
            <kbd className="font-mono">K</kbd>
          </button>

          {/* New Trade Primary Action */}
          <button
            onClick={onOpenNewTrade}
            className="bg-[#2383e2] hover:bg-[#1a73ca] text-white px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors"
          >
            <Plus size={14} className="sm:hidden" />
            <span className="hidden sm:inline">+ New Trade</span>
          </button>
        </div>
      </div>

      {/* Main black banner with "TRUST THE PROCESS" */}
      <div className="relative w-full bg-[#050505] h-36 sm:h-44 md:h-52 flex items-center justify-center overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-radial from-neutral-800/20 via-transparent to-transparent opacity-60"></div>

        {/* Banner Text */}
        <h1 className="relative z-10 text-white font-medium text-xl sm:text-2xl md:text-3xl tracking-[0.25em] select-none text-center px-4 font-sans">
          TRUST THE PROCESS
        </h1>
      </div>

      {/* Solana Logo Badge overlapping bottom-left */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 relative">
        <div className="absolute -top-6 sm:-top-7 left-4 sm:left-6 md:left-10 z-20">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black border-4 border-white shadow-md flex items-center justify-center group hover:scale-105 transition-transform cursor-pointer">
            <SolanaLogo size={24} />
          </div>
        </div>
      </div>

      {/* Mobile Bottom Dock for fast 1-thumb navigation */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#e9e9e7] px-2 pt-1.5 flex items-center justify-around shadow-lg"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors text-[10px] ${
                isActive ? "text-[#2383e2] font-bold" : "text-[#787774]"
              }`}
            >
              <Icon size={18} className={isActive ? "text-[#2383e2]" : "text-[#908e89]"} />
              <span className="mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
