import test from "node:test";
import assert from "node:assert/strict";
import { clearGuestTrades, GUEST_TRADES_KEY, readGuestTrades, writeGuestTrades } from "../src/lib/guestSession.ts";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const trade = {
  id: "guest-1", ca: "mint", name: "Demo", symbol: "DEMO", wallet: "Paper", result: "Win" as const,
  boughtSol: 1, pnlSol: 0.25, mistakes: [], createdAt: Date.now(),
};

test("guest trades stay in the provided tab-scoped storage and can be cleared", () => {
  const storage = new MemoryStorage() as unknown as Storage;
  assert.equal(writeGuestTrades([trade], storage), true);
  assert.deepEqual(readGuestTrades(storage), [trade]);
  clearGuestTrades(storage);
  assert.equal(storage.getItem(GUEST_TRADES_KEY), null);
});

test("guest storage rejects corrupt entries instead of importing them", () => {
  const storage = new MemoryStorage() as unknown as Storage;
  storage.setItem(GUEST_TRADES_KEY, JSON.stringify([{ id: "bad", name: "Missing financial fields" }, trade]));
  assert.deepEqual(readGuestTrades(storage), [trade]);
});
