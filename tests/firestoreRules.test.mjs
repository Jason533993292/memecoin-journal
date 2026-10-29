import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const projectId = "memecoin-journal-rules-test";
let environment;

function validTrade() {
  return {
    ca: "So11111111111111111111111111111111111111112",
    name: "Test Coin",
    symbol: "TEST",
    wallet: "Main",
    result: "Win",
    setupType: "Breakout",
    boughtSol: 1,
    pnlSol: 0.25,
    pnlUsd: 37.5,
    mistakes: [],
    goodTags: ["patient"],
    notes: "Rules emulator trade",
    date: Timestamp.fromMillis(1_700_000_000_000),
    createdAt: 1_700_000_000_000,
  };
}

function validWallet(id = "wallet-1") {
  return {
    id,
    name: "Main Wallet",
    balanceSol: 4.5,
    address: "So11111111111111111111111111111111111111112",
    updatedAt: 1_700_000_000_000,
  };
}

function validWalletTransaction(id = "tx-1") {
  return {
    id,
    walletId: "wallet-1",
    walletName: "Main Wallet",
    type: "deposit",
    amountSol: 1,
    amountUsd: 150,
    notes: "Test deposit",
    date: Timestamp.fromMillis(1_700_000_000_000),
    createdAt: 1_700_000_000_000,
  };
}

function validResearch(ca = "So11111111111111111111111111111111111111112") {
  return {
    ca,
    name: "Test Coin",
    symbol: "TEST",
    stage: "researching",
    thesis: "A bounded test thesis.",
    bullCase: "Demand grows.",
    bearCase: "Demand fades.",
    catalysts: ["Confirmed catalyst"],
    risks: ["Thin liquidity"],
    invalidation: "Liquidity leaves.",
    entryPlan: "Wait for confirmation.",
    stopPlan: "Exit on invalidation.",
    targetPlan: "Scale out.",
    horizon: "Days",
    confidence: 60,
    tags: ["test"],
    sources: ["https://example.com/source"],
    snapshots: [],
    decisions: [],
    reminders: [],
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  };
}

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
    },
  });
});

after(async () => {
  await environment?.cleanup();
});

test("trade data is private to its owner and cannot be listed publicly", async () => {
  const ownerDb = environment.authenticatedContext("owner-a").firestore();
  const otherDb = environment.authenticatedContext("owner-b").firestore();
  const publicDb = environment.unauthenticatedContext().firestore();
  const tradePath = "users/owner-a/trades/trade-1";

  await assertSucceeds(setDoc(doc(ownerDb, tradePath), validTrade()));
  await assertSucceeds(getDoc(doc(ownerDb, tradePath)));
  await assertFails(getDoc(doc(otherDb, tradePath)));
  await assertFails(getDocs(collection(publicDb, "users/owner-a/trades")));
  await assertFails(deleteDoc(doc(otherDb, tradePath)));
});

test("new quote currency and trading venue fields remain owner-scoped", async () => {
  const ownerDb = environment.authenticatedContext("owner-a").firestore();
  const otherDb = environment.authenticatedContext("owner-b").firestore();
  const path = "users/owner-a/trades/quote-trade";
  await assertSucceeds(setDoc(doc(ownerDb, path), {
    ...validTrade(), quoteCurrency: "ETH", quoteSymbol: "ETH", boughtQuote: 1,
    soldQuote: 1.2, pnlQuote: 0.2, quoteUsdRate: 2500, venue: "Robinhood",
  }));
  await assertFails(getDoc(doc(otherDb, path)));
});

test("trade updates can correct the trade date but cannot mutate createdAt", async () => {
  const ownerDb = environment.authenticatedContext("trade-editor").firestore();
  const reference = doc(ownerDb, "users/trade-editor/trades/trade-1");
  await assertSucceeds(setDoc(reference, validTrade()));
  await assertSucceeds(updateDoc(reference, { date: Timestamp.fromMillis(1_710_000_000_000) }));
  await assertFails(updateDoc(reference, { createdAt: 1_720_000_000_000 }));
  await assertFails(updateDoc(reference, { notes: "x".repeat(4_001) }));
});

test("wallets and paper capital are owner-only and schema validated", async () => {
  const ownerDb = environment.authenticatedContext("wallet-owner").firestore();
  const otherDb = environment.authenticatedContext("other-owner").firestore();
  const walletPath = "users/wallet-owner/wallets/wallet-1";
  const configPath = "users/wallet-owner/settings/walletConfig";

  await assertSucceeds(setDoc(doc(ownerDb, walletPath), validWallet()));
  await assertSucceeds(updateDoc(doc(ownerDb, walletPath), { balanceSol: 6, updatedAt: 1_710_000_000_000 }));
  await assertFails(getDoc(doc(otherDb, walletPath)));
  await assertFails(setDoc(doc(ownerDb, "users/wallet-owner/wallets/wallet-2"), validWallet("wrong-id")));
  await assertFails(setDoc(doc(ownerDb, "users/wallet-owner/wallets/wallet-3"), {
    ...validWallet("wallet-3"),
    balanceSol: -1,
  }));

  await assertSucceeds(setDoc(doc(ownerDb, configPath), {
    paperCapitalSol: 25,
    updatedAt: 1_700_000_000_000,
  }));
  await assertFails(setDoc(doc(otherDb, configPath), {
    paperCapitalSol: 50,
    updatedAt: 1_700_000_000_000,
  }));
});

test("wallet transactions are private, validated, and append-only", async () => {
  const ownerDb = environment.authenticatedContext("history-owner").firestore();
  const otherDb = environment.authenticatedContext("history-other").firestore();
  const path = "users/history-owner/walletTransactions/tx-1";

  await assertSucceeds(setDoc(doc(ownerDb, path), validWalletTransaction()));
  await assertFails(getDoc(doc(otherDb, path)));
  await assertFails(updateDoc(doc(ownerDb, path), { notes: "rewritten" }));
  await assertFails(setDoc(doc(ownerDb, "users/history-owner/walletTransactions/tx-bad"), {
    ...validWalletTransaction("tx-bad"),
    notes: "x".repeat(501),
  }));
});

test("coin research is owner-only and rejects mismatched or oversized records", async () => {
  const ownerDb = environment.authenticatedContext("research-owner").firestore();
  const otherDb = environment.authenticatedContext("research-other").firestore();
  const ca = "So11111111111111111111111111111111111111112";
  const path = `users/research-owner/research/${ca}`;

  await assertSucceeds(setDoc(doc(ownerDb, path), validResearch(ca)));
  await assertSucceeds(setDoc(doc(ownerDb, path), {
    ...validResearch(ca),
    stage: "watching",
    reminders: [{ id: "launch", title: "Check confirmed launch", dueAt: 1_800_000_000_000 }],
  }));
  await assertSucceeds(getDoc(doc(ownerDb, path)));
  await assertFails(getDoc(doc(otherDb, path)));
  await assertFails(getDocs(collection(otherDb, "users/research-owner/research")));
  await assertFails(setDoc(doc(ownerDb, `users/research-owner/research/${ca}x`), validResearch(ca)));
  await assertFails(setDoc(doc(ownerDb, "users/research-owner/research/short-address"), {
    ...validResearch("short-address"),
    thesis: "x".repeat(5_001),
  }));
  await assertFails(setDoc(doc(ownerDb, path), {
    ...validResearch(ca),
    reminders: Array.from({ length: 21 }, (_, index) => ({ id: String(index), title: "Reminder", dueAt: 1_800_000_000_000 })),
  }));
});

test("undeclared paths and schema pollution remain denied", async () => {
  const ownerDb = environment.authenticatedContext("schema-owner").firestore();
  await assertFails(setDoc(doc(ownerDb, "users/schema-owner/private/admin"), { role: "admin" }));
  await assertFails(setDoc(doc(ownerDb, "users/schema-owner/trades/trade-extra"), {
    ...validTrade(),
    role: "admin",
  }));
  assert.ok(true);
});
