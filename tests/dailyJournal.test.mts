import assert from "node:assert/strict";
import test from "node:test";
import { createDailyJournalEntry, GUIDED_JOURNAL_PROMPTS, matchesDailyJournalSearch } from "../src/lib/dailyJournal.ts";

test("daily journal exposes one free-writing mode and the three approved guided formats", () => {
  assert.deepEqual(Object.keys(GUIDED_JOURNAL_PROMPTS), ["pre_trade", "post_trade", "end_of_day"]);
  const free = createDailyJournalEntry("free", new Date("2026-10-25T12:00:00Z"));
  assert.equal(free.entryType, "free");
  assert.equal(free.entryDate, "2026-10-25");
  assert.equal(free.contentHtml, "<p><br></p>");
  const guided = createDailyJournalEntry("post_trade", new Date("2026-10-25T12:00:00Z"));
  assert.equal(guided.title, "Post-trade reflection");
  assert.match(guided.contentHtml, /Did I follow my plan/);
  const justAfterLocalMidnight = createDailyJournalEntry("free", new Date(2026, 9, 26, 0, 15));
  assert.equal(justAfterLocalMidnight.entryDate, "2026-10-26");
});

test("journal search includes writing, emotions, and tags without changing the entry", () => {
  const entry = createDailyJournalEntry("end_of_day", new Date("2026-10-25T12:00:00Z"));
  entry.plainText = "Waited for confirmation before entering.";
  entry.emotions = ["Calm"];
  entry.tags = ["patience"];
  assert.equal(matchesDailyJournalSearch(entry, "confirmation"), true);
  assert.equal(matchesDailyJournalSearch(entry, "calm"), true);
  assert.equal(matchesDailyJournalSearch(entry, "PATIENCE"), true);
  assert.equal(matchesDailyJournalSearch(entry, "revenge"), false);
});
