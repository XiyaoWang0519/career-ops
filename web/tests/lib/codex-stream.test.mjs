import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCodexLine, codexTextDelta } from "../../src/lib/codex-stream.mjs";

test("thread.started → status Agent ready", () => {
  const evs = parseCodexLine(JSON.stringify({ type: "thread.started", thread_id: "t1" }));
  assert.deepEqual(evs, [{ type: "status", label: "Agent ready" }]);
});

test("command_execution item.started → tool pill", () => {
  const evs = parseCodexLine(
    JSON.stringify({
      type: "item.started",
      item: { id: "item_1", type: "command_execution", command: "bash -lc 'node reserve-report-num.mjs'", status: "in_progress" },
    }),
  );
  assert.equal(evs.length, 1);
  assert.equal(evs[0].type, "tool");
  assert.equal(evs[0].name, "node");
});

test("agent_message item.completed → text", () => {
  const evs = parseCodexLine(
    JSON.stringify({
      type: "item.completed",
      item: { id: "item_3", type: "agent_message", text: "VERDICT: 4.2/5 — strong fit" },
    }),
  );
  assert.deepEqual(evs, [{ type: "text", text: "VERDICT: 4.2/5 — strong fit" }]);
  assert.equal(codexTextDelta(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "hi" } })), "hi");
});

test("file_change item.completed → Edit tool", () => {
  const evs = parseCodexLine(
    JSON.stringify({
      type: "item.completed",
      item: { id: "item_2", type: "file_change", changes: [] },
    }),
  );
  assert.deepEqual(evs, [{ type: "tool", name: "Edit" }]);
});

test("turn.completed usage → tokens", () => {
  const evs = parseCodexLine(
    JSON.stringify({
      type: "turn.completed",
      usage: { input_tokens: 100, cached_input_tokens: 50, output_tokens: 20, reasoning_output_tokens: 5 },
    }),
  );
  assert.equal(evs[0].type, "tokens");
  assert.equal(evs[0].tokens, 175);
});

test("turn.failed / error → error events", () => {
  assert.equal(parseCodexLine(JSON.stringify({ type: "turn.failed", error: { message: "boom" } }))[0].type, "error");
  assert.equal(parseCodexLine(JSON.stringify({ type: "error", message: "nope" }))[0].msg, "nope");
});

test("non-json and empty lines are ignored", () => {
  assert.deepEqual(parseCodexLine(""), []);
  assert.deepEqual(parseCodexLine("not json"), []);
  assert.equal(codexTextDelta("garbage"), "");
});
