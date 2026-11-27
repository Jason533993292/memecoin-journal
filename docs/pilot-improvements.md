# Pilot improvements and retest guide

This checklist maps the requested 32 improvements to their implementation. Some safeguards already existed and were retained rather than duplicated.

## UI

1. Wallet positions show Open position, Partly sold, Ready to review, or Missing entry history.
2. Each position exposes bought, sold, and remaining token amounts.
3. Historical market-cap estimates show their sample time; missing values can stay blank.
4. Performance reports show the selected date range. Statistics identifies its all-time scope.
5. Journal editor announces Ready, Saving, Saved, Browser draft, and Offline status near the heading.
6. Equity charts show the closed-trade count and active range.
7. Research shows the latest recorded change beside the thesis editor.
8. Trade forms use Save trade / Save changes, and the journal uses Save reflection.

## UX

9. A completed wallet import offers View saved trade.
10. Source transaction receipts are accessible from each position.
11. Wallet review explains that unavailable market caps are optional, not zero.
12. Editing retains the trade list and selection; the details drawer uses the updated trade.
13. Dismissed wallet positions offer Undo dismiss.
14. Tutorial offers a six-step trade/reflection/results introduction.
15. Feedback includes the current screen and release identifier without appending filters or private journal content.
16. Tutorial can restart at a selected chapter or run in full.

## Backend

17. Wallet trade insertion and marking source events imported run in one database transaction. Retry returns the existing trade.
18. Position/parser fixtures cover separate round trips, partial exits, missing purchases, transfers, and incomplete responses.
19. Historical market-cap provenance includes provider and sample time in import notes.
20. Aggregate sync monitoring separates failed syncs from unsupported transaction counts.
21. A per-wallet server lease prevents overlapping sync requests across tabs; it expires after interruption.
22. Service monitoring checks elevated wallet-sync failures separately from basic public liveness.
23. Monthly application-data restore drill runs in a disposable CI database, compares row counts, and records duration. This is not a full infrastructure or authentication recovery drill.
24. First-party checkout, Node setup, and artifact upload actions use pinned current major versions.

## Frontend

25. Protected staging journey exercises wallet save, reload, sync, and one-trade count.
26. The same journey double-clicks save and concurrently replays the request from two tabs.
27. Dashboard, details, and share cards reuse amount-formatting helpers.
28. Trade result/wallet/setup/tag/date filters are stored in the URL fragment and respond to browser Back.
29. Protected staging journey checks an interrupted reflection and draft recovery after refresh.
30. Desktop browser checks capture trade editor, wallet, and journal surfaces across six themes and check overflow; existing axe tests remain enabled. Screenshots are review evidence, not pixel-diff baselines.
31. Optional heavy panels, including share-card rendering, retain lazy loading.
32. Details return keyboard focus on closing; wallet review supports focus containment, Escape, and focus after save or dismissal.

## What to test

- In Wallets, review a completed position, open its receipts, leave unavailable market caps blank, enter reason/setup, and save. Use View saved trade, refresh, then sync again. There should be one trade.
- Dismiss a position and undo it. Check keyboard Tab stays within review, Escape closes it, and focus returns to its button.
- Inspect an open and a partly sold position. Remaining tokens must not be presented as a fully realized loss.
- In Trades, change two filters, use browser Back, open/edit a trade, and confirm the list remains in place and details update.
- In Journal, type a reflection while offline, wait for the offline status, reconnect and reload, then recover the unfinished draft. Save and verify the saved status.
- In Guide, start the short tutorial, finish on Dashboard, then restart from the Journal chapter. Move forward/back through journal and wallet steps.
- Change themes and inspect forms, journal status, wallet buttons, and chart labels.
- Open Feedback and inspect optional diagnostics: screen/release should appear; private notes should not.

## Media

Two 20-second, silent, captioned 720p demo videos use fictional examples. They are explanatory slides with public guest screenshots, not a recording of a real wallet import. The generated journal/crypto logo is used for the website icon. Original media is delivered locally, rather than placing large promotional videos in the application bundle.
