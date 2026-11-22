export type SignatureRow = { err?: unknown; signature?: string; blockTime?: number };
export type SignatureEntry = { signature: string; blockTime?: number };

export const SYNC_BATCH_LIMIT = 50;

export type SignatureWindow = {
  /** Successful transactions to process, oldest first. */
  ordered: SignatureEntry[];
  /** Signature the cursor may advance to once every entry in `ordered` is saved. */
  windowEnd: string | null;
  failedTransactions: number;
  /** More activity is waiting after this batch; another update will continue from it. */
  hasMore: boolean;
  /** The cursor could not be reached within the page limit, so older activity was skipped. */
  skippedOlder: boolean;
};

/**
 * Decides which transactions one sync processes.
 *
 * `rowsNewestFirst` is what getSignaturesForAddress returns. For an incremental sync with a
 * saved cursor the rows stop at that cursor, so the batch is taken from the OLDEST end. That
 * keeps the cursor contiguous: advancing it never skips activity between the old cursor and
 * the new one, even when more than SYNC_BATCH_LIMIT transactions arrived since the last sync.
 *
 * A first sync or a manual rescan inspects only the newest transactions and does not backfill
 * older history.
 */
export function planSignatureWindow(
  rowsNewestFirst: SignatureRow[],
  options: { incrementalWithCursor: boolean; pageLimitHit?: boolean; limit?: number },
): SignatureWindow {
  const limit = options.limit ?? SYNC_BATCH_LIMIT;
  const rows = rowsNewestFirst.filter((row): row is SignatureRow & { signature: string } => Boolean(row.signature));
  const ordered: SignatureEntry[] = [];
  let failedTransactions = 0;

  if (options.incrementalWithCursor) {
    const oldestFirst = [...rows].reverse();
    let consumed = 0;
    for (const row of oldestFirst) {
      consumed += 1;
      if (row.err) failedTransactions += 1;
      else ordered.push({ signature: row.signature, blockTime: row.blockTime });
      if (ordered.length === limit) break;
    }
    return {
      ordered,
      windowEnd: consumed > 0 ? oldestFirst[consumed - 1].signature : null,
      failedTransactions,
      hasMore: consumed < oldestFirst.length,
      skippedOlder: Boolean(options.pageLimitHit),
    };
  }

  const newestSuccessful: SignatureEntry[] = [];
  for (const row of rows) {
    if (row.err) failedTransactions += 1;
    else newestSuccessful.push({ signature: row.signature, blockTime: row.blockTime });
    if (newestSuccessful.length === limit) break;
  }
  ordered.push(...newestSuccessful.reverse());
  return { ordered, windowEnd: rows[0]?.signature ?? null, failedTransactions, hasMore: false, skippedOlder: false };
}

/**
 * The cursor only moves over transactions that were actually saved. If the provider failed to
 * return transaction N, everything before N is kept and the cursor stops there, so the next
 * update retries N instead of silently skipping it.
 */
export function nextSyncCursor(input: {
  previousCursor: string | null;
  mode: "incremental" | "rescan";
  window: Pick<SignatureWindow, "ordered" | "windowEnd">;
  usableCount: number;
}) {
  // A rescan repairs history; it must not move an existing cursor.
  if (input.mode === "rescan" && input.previousCursor) return input.previousCursor;
  const truncated = input.usableCount < input.window.ordered.length;
  const advanceTo = truncated ? input.window.ordered[input.usableCount - 1]?.signature : input.window.windowEnd ?? input.window.ordered.at(-1)?.signature;
  return advanceTo || input.previousCursor;
}
