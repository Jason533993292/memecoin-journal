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
  if (!t) return 0;
  const d = t.date;
  if (d instanceof Date) return d.getTime();
  if (d && typeof d === "object" && "seconds" in d && typeof d.seconds === "number") {
    return d.seconds * 1000;
  }
  if (typeof d === "number") {
    return d;
  }
  if (typeof d === "string") {
    const parsed = Date.parse(d);
    if (!isNaN(parsed)) return parsed;
  }
  return t.createdAt ?? 0;
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

/** Format SOL without hiding lamport-scale balances through two-decimal rounding. */
export function formatSol(value: number, maximumFractionDigits = 9): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: Math.min(9, Math.max(0, maximumFractionDigits)),
  }).format(value);
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
 * Client-side image compression with a strict Firestore-safe output size.
 */
export async function compressImage(dataUrl: string, maxBytes = 450_000): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    throw new TypeError("A valid image is required.");
  }
  if (dataUrl.length > 14_000_000) {
    throw new RangeError("Image is too large to process safely.");
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const maxDim = 1200;
        const initialScale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Image compression is unavailable in this browser."));
          return;
        }

        for (let scale = initialScale; scale >= 0.25; scale *= 0.75) {
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));
          canvas.width = width;
          canvas.height = height;
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          for (let quality = 0.85; quality >= 0.25; quality -= 0.1) {
            const result = canvas.toDataURL("image/jpeg", quality);
            if (result.length <= maxBytes) {
              resolve(result);
              return;
            }
          }
        }
        reject(new RangeError("The image could not be compressed small enough to save."));
      } catch {
        reject(new Error("The image could not be compressed in this browser."));
      }
    };
    img.onerror = () => reject(new Error("The selected image could not be read."));
    img.src = dataUrl;
  });
}
