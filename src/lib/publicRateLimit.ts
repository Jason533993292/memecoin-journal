const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX_REQUESTS = 60;
const MAX_TRACKED_CLIENTS = 5_000;

type RateLimitEntry = { count: number; resetsAt: number };
type RateLimitOptions = { now?: number; windowMs?: number; maxRequests?: number };

const rateLimits = new Map<string, RateLimitEntry>();

export function allowPriceRequest(clientId: string, options: RateLimitOptions = {}) {
  const now = options.now ?? Date.now();
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const current = rateLimits.get(clientId);

  if (!current || current.resetsAt <= now) {
    if (rateLimits.size >= MAX_TRACKED_CLIENTS) {
      for (const [key, value] of rateLimits) {
        if (value.resetsAt <= now) rateLimits.delete(key);
      }
      if (rateLimits.size >= MAX_TRACKED_CLIENTS) {
        const oldest = rateLimits.keys().next().value;
        if (oldest) rateLimits.delete(oldest);
      }
    }
    rateLimits.set(clientId, { count: 1, resetsAt: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) return false;
  current.count += 1;
  return true;
}
