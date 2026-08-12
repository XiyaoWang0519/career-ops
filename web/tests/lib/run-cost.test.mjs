import { test } from "node:test";
import assert from "node:assert/strict";
import { formatRunCost, normalizeRunCost, parseRunCost } from "../../src/lib/run-cost.mjs";

test("run cost survives markdown persistence", () => {
  const md = formatRunCost({ tokens: 24337, usd: 0.42, billing: "metered" });
  assert.deepEqual(parseRunCost(md), { tokens: 24337, usd: 0.42, billing: "metered" });
});

test("plan billing survives without a synthetic dollar amount", () => {
  const md = formatRunCost({ tokens: 24337, billing: "plan" });
  assert.deepEqual(parseRunCost(md), { tokens: 24337, billing: "plan" });
});

test("invalid or legacy missing cost metadata is ignored", () => {
  assert.equal(normalizeRunCost({ tokens: 0, usd: -1, billing: "surprise" }), undefined);
  assert.equal(parseRunCost("# legacy run\n- verdict: 4/5 — good"), undefined);
});
