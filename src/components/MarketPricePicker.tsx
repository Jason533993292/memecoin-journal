"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { MARKET_ASSETS, isMarketAssetSymbol, type MarketAssetSymbol } from "@/lib/marketAssets";
import { useLocalStorageValue, writeLocalStorageValue } from "@/lib/useLocalStorage";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

type PriceStatus = "live" | "cached" | "stale" | "unavailable";
type PriceState = { price: number; change24h: number; status: PriceStatus; updatedAt: number | null };

const STORAGE_KEY = "memecoin_journal_market_asset";
const EMPTY_PRICE: PriceState = { price: 0, change24h: 0, status: "unavailable", updatedAt: null };

export default function MarketPricePicker() {
  const storedAsset = useLocalStorageValue(STORAGE_KEY)?.toUpperCase() ?? null;
  const asset: MarketAssetSymbol = isMarketAssetSymbol(storedAsset) ? storedAsset : "SOL";
  const [price, setPrice] = useState<PriceState>(EMPTY_PRICE);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const updatePrice = async () => {
      try {
        const response = await fetchWithTimeout(`/api/market-price?asset=${asset}`, { signal: controller.signal });
        if (!active) return;
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setPrice((current) => ({ ...current, status: "unavailable" }));
          return;
        }
        setPrice({
          price: typeof data.price === "number" && Number.isFinite(data.price) ? data.price : 0,
          change24h: typeof data.change24h === "number" && Number.isFinite(data.change24h) ? data.change24h : 0,
          status: data.status === "live" || data.status === "cached" || data.status === "stale" ? data.status : "unavailable",
          updatedAt: typeof data.timestamp === "number" ? data.timestamp : null,
        });
      } catch {
        if (active) setPrice((current) => ({ ...current, status: "unavailable" }));
      }
    };
    void updatePrice();
    const interval = window.setInterval(updatePrice, 60_000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [asset]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const selectAsset = (nextAsset: MarketAssetSymbol) => {
    setPrice(EMPTY_PRICE);
    writeLocalStorageValue(STORAGE_KEY, nextAsset);
    setOpen(false);
  };
  const title = price.updatedAt
    ? `${price.status === "stale" ? "Stale cached" : price.status} ${asset} price in USD, updated ${new Date(price.updatedAt).toLocaleTimeString()}`
    : `${asset} price is temporarily unavailable`;

  return <div ref={rootRef} className="relative">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label={`Current ${MARKET_ASSETS[asset].name} price. Choose a different asset`} aria-haspopup="menu" aria-expanded={open} title={title} className="flex items-center gap-1.5 rounded-md border border-[#e3e2de] bg-white px-2 py-1 font-mono text-[11px] shadow-xs transition hover:bg-[#f7f6f3] sm:px-2.5">
      <span className={`h-2 w-2 rounded-full ${price.status === "live" ? "animate-pulse bg-emerald-500" : price.status === "cached" ? "bg-amber-400" : price.status === "stale" ? "bg-rose-500" : "bg-neutral-300"}`} />
      <span className="font-sans text-[9px] font-bold text-[#787774]">{asset}</span>
      <span className="font-semibold text-[#37352f]">{price.price > 0 ? `$${price.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</span>
      {price.status === "stale" && <span className="font-sans text-[9px] text-rose-600">stale</span>}
      {price.change24h !== 0 && <span className={`hidden text-[10px] font-medium sm:inline ${price.change24h >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{price.change24h >= 0 ? "+" : ""}{price.change24h.toFixed(1)}%</span>}
      <ChevronDown size={12} className={`text-[#787774] transition ${open ? "rotate-180" : ""}`} />
    </button>
    {open && <div role="menu" aria-label="Choose market price asset" className="absolute right-0 top-[calc(100%+0.4rem)] z-[80] min-w-44 overflow-hidden rounded-lg border border-[#e3e2de] bg-white p-1.5 shadow-xl">
      {(Object.keys(MARKET_ASSETS) as MarketAssetSymbol[]).map((symbol) => <button key={symbol} type="button" role="menuitemradio" aria-checked={asset === symbol} onClick={() => selectAsset(symbol)} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs transition ${asset === symbol ? "bg-blue-50 text-blue-700" : "text-[#37352f] hover:bg-[#f1f1ef]"}`}><span><strong>{symbol}</strong><span className="ml-2 text-[#787774]">{MARKET_ASSETS[symbol].name}</span></span>{asset === symbol && <span aria-hidden="true">✓</span>}</button>)}
    </div>}
  </div>;
}
