import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Trade } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes timestamp from any valid Trade representation (Firestore Timestamp, epoch ms, ISO string, createdAt)
 */
export function getTradeTimestamp(t: Partial<Trade>): number {
  if (!t) return Date.now();
  const d = t.date as any;
  if (d?.seconds !== undefined) {
    return d.seconds * 1000;
  }
  if (typeof d === "number") {
    return d;
  }
  if (typeof d === "string") {
    const parsed = Date.parse(d);
    if (!isNaN(parsed)) return parsed;
  }
  return t.createdAt ?? Date.now();
}

/**
 * Returns a Javascript Date object for a given Trade
 */
export function getTradeDate(t: Partial<Trade>): Date {
  return new Date(getTradeTimestamp(t));
}

/**
 * Converts SOL amount to USD given live or fallback solPrice
 */
export function toUsd(sol: number | undefined | null, solPrice: number): number {
  return (sol || 0) * solPrice;
}

/**
 * Sanitizes CSV cell content against CSV formula injection (=, +, -, @)
 * and escapes double quotes
 */
export function escapeCsvField(str: string | number | undefined | null): string {
  if (str === undefined || str === null) return '""';
  const s = String(str).replace(/"/g, '""');
  // Guard against CSV formula injection
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe}"`;
}
