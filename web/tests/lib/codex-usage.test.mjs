import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCodexUsageResponse, windowFromApi, windowLabel } from "../../src/lib/codex-usage.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = {
  both: {
    plan_type: "plus",
    rate_limit: {
      primary_window: {
        used_percent: 30,
        limit_window_seconds: 18000,
        reset_after_seconds: 10800,
        reset_at: 1779842256,
      },
      secondary_window: {
        used_percent: 45,
        limit_window_seconds: 604800,
        reset_after_seconds: 302400,
        reset_at: 1780429056,
      },
    },
    code_review_rate_limit: null,
  },
  freeWeeklyPrimary: {
    plan_type: "free",
    rate_limit: {
      primary_window: {
        used_percent: 12,
        limit_window_seconds: 604800,
        reset_after_seconds: 500000,
        reset_at: 1780429056,
      },
      secondary_window: null,
    },
  },
};

test("windowLabel maps known durations", () => {
  assert.equal(windowLabel(18000), "5h");
  assert.equal(windowLabel(604800), "7d");
  assert.equal(windowLabel(2592000), "30d");
});

test("windowFromApi drops inactive reset_at=0 windows", () => {
  assert.equal(windowFromApi({ used_percent: 0, limit_window_seconds: 18000, reset_at: 0 }), null);
});

test("parseCodexUsageResponse labels by duration not slot", () => {
  const paid = parseCodexUsageResponse(fixtures.both, { nowMs: 1_700_000_000_000 });
  assert.equal(paid.source, "codex");
  assert.equal(paid.planType, "plus");
  assert.deepEqual(
    paid.windows.map((w) => ({ label: w.label, usedPercent: w.usedPercent })),
    [
      { label: "5h", usedPercent: 30 },
      { label: "7d", usedPercent: 45 },
    ],
  );

  const free = parseCodexUsageResponse(fixtures.freeWeeklyPrimary, { nowMs: 1_700_000_000_000 });
  assert.equal(free.windows.length, 1);
  assert.equal(free.windows[0].label, "7d");
  assert.equal(free.windows[0].usedPercent, 12);
});

test("usage route and meter are wired for Codex", () => {
  const route = fs.readFileSync(path.join(here, "../../src/app/api/usage/route.ts"), "utf8");
  const meter = fs.readFileSync(path.join(here, "../../src/components/usage-meter.tsx"), "utf8");
  assert.match(route, /fetchCodexUsage/);
  assert.match(route, /wham\/usage|codex-usage-fetch/);
  assert.match(route, /pinnedDefaultCli/);
  assert.match(meter, /resolveClientCliId/);
  assert.match(meter, /cli === "codex"/);
  assert.doesNotMatch(meter, /only meaningful when Claude/);
});
