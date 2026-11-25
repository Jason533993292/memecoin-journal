import assert from "node:assert/strict";
import test from "node:test";
import { receiptEvidence } from "../src/lib/walletReceipt.ts";

const venue = "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo";
test("a nested venue swap is recognized but an unknown program or liquidity instruction is not", () => {
  const logs = ["Program Router invoke [1]", `Program ${venue} invoke [2]`];
  assert.equal(receiptEvidence([...logs, "Program log: Instruction: Swap2"], [], "wallet"), "swap");
  assert.equal(receiptEvidence([...logs, "Program log: Instruction: AddLiquidity"], [], "wallet"), "unknown");
  assert.equal(receiptEvidence([...logs, `Program ${venue} success`, "Program log: Instruction: Swap2"], [], "wallet"), "unknown");
});
test("plain token and native transfers remain transfers even alongside a payment", () => {
  const token = {program:"spl-token", parsed:{type:"transferChecked"}};
  const payment = {program:"system", parsed:{type:"transfer",info:{source:"wallet"}}};
  assert.equal(receiptEvidence([], [token], "wallet"), "token-transfer");
  assert.equal(receiptEvidence([], [payment, token], "wallet"), "native-transfer");
  assert.equal(receiptEvidence([], [token, {programId:"unknown"}], "wallet"), "unknown");
});
