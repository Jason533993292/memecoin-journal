// A program invocation alone can be liquidity management. Require a swap instruction
// emitted while a known swap program is executing, including nested router calls.
const venues = new Set([
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK", "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
]);

type Instruction = { program?: string; programId?: string; parsed?: { type?: string; info?: { source?: string; destination?: string; authority?: string } } };

export function receiptEvidence(logs: string[], instructions: Instruction[], owner: string) {
  const stack: string[] = [];
  for (const line of logs) {
    const invoke = /^Program (\w+) invoke \[(\d+)\]$/.exec(line);
    if (invoke) {
      stack.length = Number(invoke[2]) - 1;
      stack.push(invoke[1]);
    } else if (/^Program \w+ (?:success|failed:)/.test(line)) {
      stack.pop();
    } else if (venues.has(stack.at(-1) ?? "") && /^Program log: Instruction: (?:Buy|Sell|Swap|Route|SharedAccountsRoute|ExactOutRoute|SharedAccountsExactOutRoute)\w*$/.test(line)) {
      return "swap";
    }
  }
  const plain = instructions.every(ix => ["system", "spl-token", "spl-token-2022", "spl-associated-token-account", "spl-memo"].includes(ix.program ?? "") || ix.programId === "ComputeBudget111111111111111111111111111111");
  const transfer = instructions.some(ix => ix.parsed?.type === "transfer" || ix.parsed?.type === "transferChecked");
  const nativeTransfer = instructions.some(ix => ix.program === "system" && ix.parsed?.type === "transfer" && [ix.parsed.info?.source, ix.parsed.info?.destination].includes(owner));
  return plain && transfer ? (nativeTransfer ? "native-transfer" : "token-transfer") : "unknown";
}
