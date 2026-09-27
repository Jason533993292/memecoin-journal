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
 * Returns local YYYY-MM-DD string key for standard calendar grouping
 */
export function getLocalDayKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

/**
 * Client-side canvas image compression to keep base64 payloads safely below Firestore limits (< 500KB)
 */
export async function compressImage(dataUrl: string, maxBytes = 500_000): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:image")) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxDim = 1200;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.85;
      let result = canvas.toDataURL("image/jpeg", quality);
      while (result.length > maxBytes && quality > 0.3) {
        quality -= 0.1;
        result = canvas.toDataURL("image/jpeg", quality);
      }
      resolve(result);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
