# Agent notes

Phase 1 is the weekly manager review (week picker, same calendar dates last month, rep / customer / SKU review, line detail, HKD). Phase 2 adds monthly totals, the sell-out pie, and hand import. Phase 3 keeps that working set in the browser (IndexedDB for the lines, localStorage for the review filters) and adds monthly target vs MTD, pace, and a working-day forecast. Later phases keep all of this. Kingdee auto-sync stays deferred.

## Standing rules

- Keep Phase 1 features when adding a later phase. Do not drop the weekly review to make room for the next chart.
- Soft Earth tokens live in `src/lib/palette.ts` (`INK`, `TAUPE`, `OLIVE`, `AMBER`, `CLAY`, `SAGE`, `CREAM`). Use that palette. Do not invent a second theme.
- Charts use Customer Name (`customer`, short labels), not the raw 往来单位 string. On **Merge into current**, `mergeImportedItems` applies `src/lib/partnerAliases.ts` (wGAL map) so `駿業電腦用品公司 Vision computer` becomes **Vision** when the sheet has no separate short name. An explicit 客户 / Customer Name column wins.
- Hong Kong working days come from `src/lib/hkHolidays.ts`. `isWorkingDay` excludes weekends and gazetted HK holidays. Do not count those days as working days.
- Ship as draft pull requests. Merge to `main` only after Aaron’s explicit go.
- No Kingdee auto-sync until Aaron opens that phase. Hand import stays on `ingestRecords` and `mergeImportedItems`. A future sync should call that mapper instead of growing a second one.
