import assert from "node:assert/strict";
import test from "node:test";
import { dispatch } from "../../src/app/actions/registry.ts";

function context(overrides = {}) {
  const calls = { pushed: [], replaced: [], explored: [] };
  return {
    calls,
    value: {
      push: (path) => calls.pushed.push(path),
      replace: (path) => calls.replaced.push(path),
      startJob: () => null,
      inbox: [],
      applications: [],
      jobForUrl: () => undefined,
      rememberFact: () => {},
      writeStatus: () => {},
      setApplyField: () => {},
      startApply: () => {},
      applyExplore: (patch, opts) => calls.explored.push({ patch, opts }),
      ...overrides,
    },
  };
}

test("navigate renders an agent-native widget instead of leaving /chat", () => {
  const ctx = context({ inlineNavigation: true });
  const result = dispatch("navigate", { path: "/pipeline?tab=OFFER" }, ctx.value);
  assert.deepEqual(result, { status: "done", surface: "/pipeline?tab=OFFER" });
  assert.deepEqual(ctx.calls.pushed, []);
});

test("navigate still changes pages outside the Assistant page", () => {
  const ctx = context();
  const result = dispatch("navigate", { path: "/analytics" }, ctx.value);
  assert.deepEqual(result, { status: "done" });
  assert.deepEqual(ctx.calls.pushed, ["/analytics"]);
});

test("pipeline filters become an inline Opportunities widget", () => {
  const ctx = context({ inlineNavigation: true });
  const result = dispatch("filterPipeline", { tab: "offer", min: 4, sort: "score", dir: -1 }, ctx.value);
  assert.deepEqual(result, { status: "done", surface: "/pipeline?tab=OFFER&min=4&sort=score&dir=-1" });
  assert.deepEqual(ctx.calls.replaced, []);
});

test("free scans carry assistant filters into the native Find roles widget", () => {
  const ctx = context({ inlineNavigation: true });
  const result = dispatch(
    "explore",
    { positive: ["AI infrastructure", "ML performance"], allow: ["Toronto"], since: 14, run: true },
    ctx.value,
  );
  assert.deepEqual(result, {
    status: "done",
    surface: "/explore?q=AI+infrastructure%2CML+performance&loc=Toronto&since=14&run=1",
    note: "Scanning the ATS network for fresh roles (free)…",
  });
  assert.deepEqual(ctx.calls.pushed, []);
  assert.deepEqual(ctx.calls.explored, [{
    patch: { positive: ["AI infrastructure", "ML performance"], allow: ["Toronto"], since: 14, run: true },
    opts: { merge: false, run: true },
  }]);
});
