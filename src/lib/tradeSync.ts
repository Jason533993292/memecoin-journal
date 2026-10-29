export const TRADE_SYNC_CHANNEL = "memecoin-journal-trades";

export type TradeSyncMessage = {
  type: "saved" | "deleted";
  tradeId: string;
  sentAt: number;
};

export function isTradeSyncMessage(value: unknown): value is TradeSyncMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const message = value as Partial<TradeSyncMessage>;
  return (message.type === "saved" || message.type === "deleted")
    && typeof message.tradeId === "string"
    && message.tradeId.length > 0
    && message.tradeId.length <= 150
    && typeof message.sentAt === "number"
    && Number.isFinite(message.sentAt);
}

export function publishTradeSync(message: TradeSyncMessage) {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
  const channel = new BroadcastChannel(TRADE_SYNC_CHANNEL);
  channel.postMessage(message);
  channel.close();
}

