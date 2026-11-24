import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const EXACT_KINDS = new Set(["table_owner", "rls", "policy", "grant", "default_acl"]);

export function parseSnapshot(text) {
  const snapshot = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const first = line.indexOf("|");
    const second = line.indexOf("|", first + 1);
    if (first < 1 || second < first + 2) throw new Error(`Malformed restore-check row: ${line}`);
    const kind = line.slice(0, first);
    const key = line.slice(first + 1, second);
    const value = line.slice(second + 1);
    const compoundKey = `${kind}|${key}`;
    if (snapshot.has(compoundKey)) throw new Error(`Duplicate restore-check key: ${compoundKey}`);
    snapshot.set(compoundKey, { kind, key, value });
  }
  return snapshot;
}

export function compareSnapshots(source, restored, backupRows) {
  const failures = [];
  const notes = [];
  if (backupRows) {
    const restoredRows = new Map([...restored].filter(([, row]) => row.kind === "rows"));
    for (const key of new Set([...backupRows.keys(), ...restoredRows.keys()])) {
      if (!backupRows.has(key) || backupRows.get(key)?.value !== restoredRows.get(key)?.value) failures.push(`${key}: backup row count mismatch`);
    }
  }
  const allKeys = new Set([...source.keys(), ...restored.keys()]);
  for (const compoundKey of [...allKeys].sort()) {
    const expected = source.get(compoundKey);
    const actual = restored.get(compoundKey);
    if (!expected || !actual) {
      failures.push(`${compoundKey}: ${expected ? "missing from restored database" : "unexpected in restored database"}`);
      continue;
    }
    if (expected.kind === "rows") {
      const sourceRows = Number(expected.value);
      const restoredRows = Number(actual.value);
      if (!Number.isSafeInteger(sourceRows) || !Number.isSafeInteger(restoredRows)) {
        failures.push(`${compoundKey}: invalid row count`);
      } else if (!backupRows && restoredRows !== sourceRows) {
        failures.push(`${compoundKey}: restored has ${restoredRows}, production has ${sourceRows}`);
      } else if (restoredRows !== sourceRows) {
        notes.push(`${compoundKey}: restored ${restoredRows}; production now ${sourceRows}`);
      }
      continue;
    }
    if (EXACT_KINDS.has(expected.kind) && expected.value !== actual.value) {
      failures.push(`${compoundKey}: security metadata differs`);
    }
  }
  return { failures, notes };
}

function capture(url) {
  const script = fileURLToPath(new URL("./restore-drill-checks.sql", import.meta.url));
  return execFileSync("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "--file", script], {
    env: { ...process.env, PGDATABASE: url },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 20 * 1024 * 1024,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sourceUrl = process.env.SOURCE_DB_URL;
  const restoredUrl = process.env.RESTORED_DB_URL;
  if (!sourceUrl || !restoredUrl) throw new Error("Set SOURCE_DB_URL and RESTORED_DB_URL.");
  if (!process.env.BACKUP_ROW_MANIFEST) throw new Error("Set BACKUP_ROW_MANIFEST to the extracted row-counts.txt.");
  const manifest = parseSnapshot(readFileSync(process.env.BACKUP_ROW_MANIFEST, "utf8"));
  if (!manifest.size) throw new Error("Empty backup manifest.");
  const result = compareSnapshots(parseSnapshot(capture(sourceUrl)), parseSnapshot(capture(restoredUrl)), manifest);
  for (const note of result.notes) console.log(`NOTE ${note}`);
  if (result.failures.length) {
    for (const failure of result.failures) console.error(`FAIL ${failure}`);
    process.exitCode = 1;
  } else {
    console.log("PASS restored rows and exact security metadata match the backup source.");
  }
}
