"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import ThemePreviewControl from "./ThemePreviewControl";
import CursorPicker from "./CursorPicker";
import {
  LayoutDashboard,
  BookOpen,
  Wallet,
  BarChart3,
  Bot,
  Command,
  Sparkles,
  Plus,
  Microscope,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquarePlus,
  BookOpenCheck,
  Wifi,
  WifiOff,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { LogIn, LogOut, MailCheck, Trash2, User as UserIcon } from "lucide-react";
import { useToast } from "./Toast";

interface TopBannerProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenNewTrade: () => void;
  onOpenCommandPalette?: () => void;
  onOpenDailyRecap?: () => void;
  onDeleteAccount?: () => void;
  onOpenFeedback?: () => void;
  onOpenGuide?: () => void;
  solPrice?: number;
  solChange24h?: number;
  solPriceStatus?: "live" | "cached" | "stale" | "unavailable";
  solPriceUpdatedAt?: number | null;
  sidebarCollapsed?: boolean;
  onSidebarCollapsedChange?: (collapsed: boolean) => void;
}

export default function TopBanner({
  currentTab,
  setCurrentTab,
  onOpenNewTrade,
  onOpenCommandPalette,
  onOpenDailyRecap,
  onDeleteAccount,
  onOpenFeedback,
  onOpenGuide,
  solPrice = 0,
  solChange24h = 0,
  solPriceStatus = "unavailable",
  solPriceUpdatedAt = null,
  sidebarCollapsed = false,
  onSidebarCollapsedChange,
}: TopBannerProps) {
  const { user, loginWithGoogle, logout, resendVerification } = useAuth();
  const { showToast } = useToast();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [connectionState, setConnectionState] = useState<"online" | "offline" | "reconnecting">("online");

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const goOffline = () => setConnectionState("offline");
    const goOnline = () => {
      setConnectionState("reconnecting");
      reconnectTimer = setTimeout(() => setConnectionState("online"), 1_200);
    };
    const initialTimer = setTimeout(() => setConnectionState(navigator.onLine ? "online" : "offline"), 0);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      clearTimeout(initialTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    onSidebarCollapsedChange?.(next);
    setAccountMenuOpen(false);
  };

  const tabs = [
    { id: "dashboard", label: "Dashboard", title: "MemeCoins Dashboard", icon: LayoutDashboard },
    { id: "journal", label: "Journal", title: "Trade Journal", icon: BookOpen },
    { id: "wallets", label: "Wallets", title: "Wallets & Paychecks", icon: Wallet },
    { id: "statistics", label: "Analytics", title: "Statistics", icon: BarChart3 },
    { id: "research", label: "Research", title: "Coin Research & Thesis", icon: Microscope },
    { id: "ai-coach", label: "AI Coach", title: "AI Trader Coach", icon: Bot },
  ];

  const activeTab = currentTab === "guide"
    ? { id: "guide", label: "Guide", title: "Guide & Improvements", icon: BookOpenCheck }
    : tabs.find((tab) => tab.id === currentTab) ?? tabs[0];
  const ActiveTabIcon = activeTab.icon;

  return (
    <>
      <aside className={`fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-white/8 bg-[#0b0c0e] text-white transition-[width] duration-200 md:flex ${sidebarCollapsed ? "w-[4.5rem]" : "w-60"}`}>
        <div className={`flex h-16 items-center border-b border-white/8 ${sidebarCollapsed ? "justify-center px-2" : "gap-3 px-5"}`}>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2383e2] text-xs font-black tracking-tight text-white shadow-lg shadow-blue-950/30">MJ</div>
          <div className={`min-w-0 ${sidebarCollapsed ? "hidden" : "block"}`}>
            <p className="truncate text-sm font-semibold tracking-tight">Memecoin Journal</p>
            <p className="text-[10px] text-neutral-500">Trading workspace</p>
          </div>
        </div>

        {user && !sidebarCollapsed && (
          <div className="mx-3 mt-4 flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-3">
            {user.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoURL} alt="" className="h-9 w-9 rounded-full border border-white/10" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#24272c] text-xs font-bold text-neutral-200">
                {user.email?.charAt(0).toUpperCase() || "U"}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{user.displayName || "Trader"}</p>
              <p className="truncate text-[10px] text-neutral-500">{user.email}</p>
            </div>
          </div>
        )}

        <nav className="mt-5 flex flex-1 flex-col gap-1 px-3" aria-label="Journal sections">
          {!sidebarCollapsed && <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-neutral-600">Workspace</p>}
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                data-tour={`nav-${tab.id}`}
                type="button"
                onClick={() => setCurrentTab(tab.id)}
                title={tab.title}
                aria-current={isActive ? "page" : undefined}
                className={`flex w-full items-center rounded-xl py-2.5 text-left text-xs font-medium transition-colors ${sidebarCollapsed ? "justify-center px-2" : "gap-3 px-3"} ${
                  isActive
                    ? "bg-white/[0.11] text-white"
                    : "text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-100"
                }`}
              >
                <Icon size={16} className={isActive ? "text-[#55a7f1]" : "text-neutral-500"} />
                {!sidebarCollapsed && <span>{tab.title}</span>}
              </button>
            );
          })}
        </nav>

        <div className="relative space-y-2 border-t border-white/8 p-3">
          <div className={sidebarCollapsed ? "hidden" : "block"}>
            <ThemePreviewControl />
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex w-full items-center rounded-xl px-3 py-2.5 text-xs text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white ${sidebarCollapsed ? "justify-center" : "gap-3"}`}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {!sidebarCollapsed && <span>Collapse sidebar</span>}
          </button>
          {onOpenFeedback && (
            <button
              type="button"
              data-tour="feedback"
              onClick={onOpenFeedback}
              title="Send feedback"
              aria-label="Send feedback"
              className={`flex w-full items-center rounded-xl px-3 py-2.5 text-xs text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white ${sidebarCollapsed ? "justify-center" : "gap-3"}`}
            >
              <MessageSquarePlus size={16} />
              {!sidebarCollapsed && <span>Feedback</span>}
            </button>
          )}
          {onOpenGuide && (
            <button
              type="button"
              onClick={onOpenGuide}
              title="Guide and improvements"
              aria-label="Guide and improvements"
              className={`flex w-full items-center rounded-xl px-3 py-2.5 text-xs text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white ${sidebarCollapsed ? "justify-center" : "gap-3"}`}
            >
              <BookOpenCheck size={16} />
              {!sidebarCollapsed && <span>Guide & improvements</span>}
            </button>
          )}
          {user && !sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setAccountMenuOpen((open) => !open)}
              aria-label="Open account menu"
              aria-expanded={accountMenuOpen}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <UserIcon size={16} />
              <span className="flex-1 text-left">Account & privacy</span>
            </button>
          )}
          {accountMenuOpen && user && (
            <div className="absolute bottom-14 left-3 right-3 z-50 rounded-xl border border-white/10 bg-[#17191d] p-2 shadow-2xl">
              {!user.emailVerified && (
                <button
                  type="button"
                  onClick={() => {
                    void resendVerification()
                      .then(() => {
                        setAccountMenuOpen(false);
                        showToast("Verification email sent", "success", "Check your inbox and spam folder.");
                      })
                      .catch(() => showToast("Could not send verification email", "error", "Wait a moment and try again."));
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-amber-300 hover:bg-white/[0.06]"
                >
                  <MailCheck size={14} /> Resend verification email
                </button>
              )}
              {onDeleteAccount && (
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    onDeleteAccount();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-rose-300 hover:bg-white/[0.06]"
                >
                  <Trash2 size={14} /> Delete account and data
                </button>
              )}
              <button
                type="button"
                onClick={() => void logout()}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-neutral-300 hover:bg-white/[0.06]"
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      <header className={`fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/8 bg-[#0f1015]/95 px-4 backdrop-blur-xl transition-[left] duration-200 md:px-6 ${sidebarCollapsed ? "md:left-[4.5rem]" : "md:left-60"}`}>
        <div className="flex min-w-0 items-center gap-3">
          <ActiveTabIcon size={17} className="shrink-0 text-[#2383e2]" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-neutral-100">{activeTab.title}</h1>
            <p className="hidden text-[10px] text-neutral-500 sm:block">Private trading workspace</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <CursorPicker />
          <div role="status" aria-live="polite" title={connectionState === "online" ? "Connected" : connectionState === "reconnecting" ? "Connection restored; checking services" : "Offline; browser drafts remain available"} className={`hidden items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold sm:flex ${connectionState === "online" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : connectionState === "reconnecting" ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-rose-500/30 bg-rose-500/10 text-rose-200"}`}>
            {connectionState === "offline" ? <WifiOff size={12}/> : <Wifi size={12}/>}<span>{connectionState === "online" ? "Online" : connectionState === "reconnecting" ? "Reconnecting…" : "Offline"}</span>
          </div>
          {/* Live SOL Price Badge */}
          <div
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 bg-white border border-[#e3e2de] rounded-md text-[11px] font-mono shadow-xs"
            title={solPriceUpdatedAt ? `${solPriceStatus === "stale" ? "Stale cached" : solPriceStatus} SOL price, updated ${new Date(solPriceUpdatedAt).toLocaleTimeString()}` : "SOL price unavailable"}
          >
            <span className={`w-2 h-2 rounded-full ${solPriceStatus === "live" ? "bg-emerald-500 animate-pulse" : solPriceStatus === "cached" ? "bg-amber-400" : solPriceStatus === "stale" ? "bg-rose-500" : "bg-neutral-300"}`}></span>
            <span className="text-[#37352f] font-semibold">
              {solPrice > 0 ? `$${solPrice.toFixed(2)}` : "SOL —"}
            </span>
            {solPriceStatus === "stale" && <span className="text-[9px] font-sans text-rose-600">stale</span>}
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
          <Button
            type="button"
            data-tour="new-trade"
            size="sm"
            onPress={onOpenNewTrade}
            className="h-7 min-w-0 rounded-md bg-[#1a73ca] px-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#155fa8] sm:px-3"
          >
            <Plus size={14} className="sm:hidden" />
            <span className="hidden sm:inline">+ New Trade</span>
          </Button>

          {!user && (
            <button
              onClick={loginWithGoogle}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-[#e3e2de] hover:bg-[#f1f1ef] text-[#37352f] rounded-md text-xs font-medium shadow-xs transition-colors"
            >
              <LogIn size={13} className="text-[#2383e2]" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* Mobile Bottom Dock for fast 1-thumb navigation */}
      <div
        className="mobile-bottom-dock md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#e9e9e7] px-2 pt-1.5 flex items-center justify-around shadow-lg"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              data-tour={`nav-${tab.id}`}
              onClick={() => setCurrentTab(tab.id)}
              aria-current={isActive ? "page" : undefined}
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
      {onOpenFeedback && (
        <button type="button" data-tour="feedback" onClick={onOpenFeedback} aria-label="Send feedback" title="Send feedback" className="fixed bottom-[5.6rem] right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#1a73ca] text-white shadow-xl transition hover:bg-[#155fa8] md:hidden">
          <MessageSquarePlus size={19} />
        </button>
      )}
      {onOpenGuide && (
        <button type="button" onClick={onOpenGuide} aria-label="Open guide and improvements" title="Guide and improvements" className="fixed bottom-[5.6rem] right-[4.25rem] z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#24272c] text-white shadow-xl transition hover:bg-[#30343a] md:hidden">
          <BookOpenCheck size={19} />
        </button>
      )}
    </>
  );
}
