export const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export type WebhookEvent = { address: string; signature: string; blockTime: number; mint: string; direction: string; solChange?: number; tokenChange?: number; feeSol?: number; executionMarketCapUsd?: number; eventIndex?: number };

export function isWebhookBatch(input: unknown): input is WebhookEvent[] {
  return Array.isArray(input) && input.length > 0 && input.length <= 100 && input.every((event) =>
    event && typeof event === "object" &&
    typeof event.address === "string" && SOLANA_ADDRESS_PATTERN.test(event.address) &&
    typeof event.mint === "string" && SOLANA_ADDRESS_PATTERN.test(event.mint) &&
    typeof event.signature === "string" && /^[1-9A-HJ-NP-Za-km-z]{64,128}$/.test(event.signature) &&
    typeof event.direction === "string" && Number.isSafeInteger(event.blockTime) &&
    Number.isFinite(new Date(event.blockTime).getTime()) &&
    [event.solChange, event.tokenChange, event.feeSol, event.executionMarketCapUsd].every(
      (value) => value === undefined || Number.isFinite(value)
    ) && (event.eventIndex === undefined || (Number.isSafeInteger(event.eventIndex) && event.eventIndex >= 0 && event.eventIndex <= 2147483647))
  );
}
