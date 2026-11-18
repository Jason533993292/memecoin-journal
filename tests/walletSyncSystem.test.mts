import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("wallet sync schema is owner-scoped and duplicate-safe", async () => {
  const migration = await readFile(new URL("supabase/migrations/20261117203920_wallet_sync_system.sql", root), "utf8");
  assert.match(migration, /create table public\.wallet_links/);
  assert.match(migration, /create table public\.wallet_events/);
  assert.match(migration, /unique \(user_id, address\)/);
  assert.match(migration, /unique \(wallet_link_id, signature, event_index\)/);
  assert.match(migration, /alter table public\.wallet_links enable row level security/);
  assert.match(migration, /alter table public\.wallet_events enable row level security/);
  assert.match(migration, /Only memecoin-journal Firebase tokens use wallet events/);
});

test("wallet sync uses a saved cursor and requires context before journal import", async () => {
  const server = await readFile(new URL("src/lib/walletSyncServer.ts", root), "utf8");
  const panel = await readFile(new URL("src/components/WalletSyncPanel.tsx", root), "utf8");
  assert.match(server, /options\.until = cursor/);
  assert.match(server, /ignoreDuplicates: true/);
  assert.match(server, /TRANSACTION_BATCH_SIZE = 5/);
  assert.match(server, /TRANSACTION_BATCH_DELAY_MS = 650/);
  assert.match(server, /TRANSACTION_FETCH_DEADLINE_MS = 22_000/);
  assert.match(server, /retried individually/);
  assert.match(server, /maxSupportedTransactionVersion: 1/);
  assert.match(server, /assertLikelyWalletAddress/);
  assert.match(server, /not a personal Solana wallet/);
  assert.match(server, /isUsable/);
  assert.match(server, /mode === "rescan"/);
  assert.match(server, /sync cursor was not advanced/);
  assert.match(server, /missingTransactions > 0/);
  assert.match(server, /HELIUS_API_KEY/);
  assert.match(server, /tokenSnapshots/);
  assert.match(server, /marketCapSnapshotAt/);
  assert.match(panel, /Reason and setup are required/);
  assert.match(panel, /walletEventIds: reviewing\.eventIds/);
  assert.match(panel, /Verify ownership/);
  assert.match(panel, /Update activity/);
  assert.match(panel, /Rescan recent history/);
  assert.match(panel, /existingSignatureSet\.has\(event\.signature\)/);
  assert.match(panel, /setLinks\(\(current\) => current\.filter/);
});
