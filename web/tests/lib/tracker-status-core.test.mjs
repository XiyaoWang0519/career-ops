import { test } from "node:test";
import assert from "node:assert/strict";
import { replaceTrackerStatus } from "../../src/lib/tracker-status-core.mjs";

const TRACKER = `# Applications Tracker

| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|---|---|---|---|---|---|---|---|
| 7 | 2026-08-12 | Acme | ML Intern | 4.2/5 | Evaluated | ❌ | [7](../reports/007.md) | strong fit |
| 8 | 2026-08-12 | Beta | SWE Intern | 3.2/5 | Evaluated | ❌ | [8](../reports/008.md) | gap |`;

test("opportunity decisions update only the selected existing status cell", () => {
  const updated = replaceTrackerStatus(TRACKER, "7", "Pursuing");
  assert.ok(updated);
  assert.match(updated, /\| 7 \| 2026-08-12 \| Acme \| ML Intern \| 4\.2\/5 \| Pursuing \|/);
  assert.match(updated, /\| 8 \| 2026-08-12 \| Beta \| SWE Intern \| 3\.2\/5 \| Evaluated \|/);
});

test("opportunity decisions fail closed instead of adding a missing row", () => {
  assert.equal(replaceTrackerStatus(TRACKER, "999", "Discarded"), null);
});
