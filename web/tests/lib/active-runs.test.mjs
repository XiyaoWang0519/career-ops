import { test } from "node:test";
import assert from "node:assert/strict";

const {
  createActiveRun,
  pushRunEvent,
  finishActiveRun,
  getActiveRun,
  listKnownRuns,
  subscribeActiveRun,
} = await import("../../src/lib/core/active-runs.ts");

async function readAll(stream) {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += dec.decode(value, { stream: true });
  }
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

test("active run fans out events and survives subscriber cancel", async () => {
  const id = `test-${Date.now()}-a`;
  createActiveRun({ id, kind: "evaluate", input: "https://example.com", title: "Score · example", startedAt: Date.now() });

  const stream1 = subscribeActiveRun(id);
  assert.ok(stream1);
  const reader1 = stream1.getReader();

  pushRunEvent(id, { type: "status", label: "Agent ready" });
  pushRunEvent(id, { type: "text", text: "hello" });

  const first = await reader1.read();
  assert.equal(JSON.parse(new TextDecoder().decode(first.value)).label, "Agent ready");

  // Simulate page refresh: cancel the HTTP consumer without finishing the run.
  await reader1.cancel();
  assert.equal(getActiveRun(id)?.status, "running");

  pushRunEvent(id, { type: "text", text: " still going" });
  finishActiveRun(id, "done");

  const stream2 = subscribeActiveRun(id);
  assert.ok(stream2);
  const events = await readAll(stream2);
  assert.ok(events.some((e) => e.type === "status" && e.label === "Agent ready"));
  assert.ok(events.some((e) => e.type === "text" && String(e.text).includes("still going")));
  assert.equal(getActiveRun(id)?.status, "done");
  assert.ok(listKnownRuns().some((r) => r.id === id));
});

test("duplicate create is rejected", () => {
  const id = `test-${Date.now()}-b`;
  createActiveRun({ id, kind: "research", input: "portfolio", startedAt: Date.now() });
  assert.throws(() => createActiveRun({ id, kind: "research", input: "portfolio", startedAt: Date.now() }));
  finishActiveRun(id, "error");
});
