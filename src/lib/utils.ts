import type { Trade } from "./types";

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

/** Format displayed SOL amounts consistently while retaining full stored precision. */
export function formatSol(value: number, maximumFractionDigits = 2): string {
  if (!Number.isFinite(value)) return "—";
  const digits = Math.min(9, Math.max(0, maximumFractionDigits));
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Format a stored quantity without changing its underlying precision. */
export function formatQuantity(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return "—";
  const digits = Math.min(9, Math.max(0, fractionDigits));
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Format a USD amount consistently across cards, tables, and calendars. */
export function formatUsd(value: number, options: { signed?: boolean } = {}): string {
  if (!Number.isFinite(value)) return "—";
  const absolute = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  if (!options.signed) return `${value < 0 ? "−" : ""}$${absolute}`;
  return value > 0 ? `+$${absolute}` : value < 0 ? `−$${absolute}` : "$0.00";
}

/** Format a percentage with a bounded, predictable number of decimal places. */
export function formatPercent(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return "—";
  const digits = Math.min(2, Math.max(0, fractionDigits));
  return `${new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)}%`;
}

/** Format realized P&L in the selected display currency. */
export function formatRealizedPnl(value: number, currency: "SOL" | "USD"): string {
  if (!Number.isFinite(value)) return "—";
  if (currency === "USD") return formatUsd(value, { signed: true });
  return `${value > 0 ? "+" : ""}${formatSol(value)} SOL`;
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
