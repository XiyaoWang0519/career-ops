import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCodexLine,
  codexStderrSummary,
  codexTextDelta,
  stripLegacyCodexDiagnostics,
} from "../../src/lib/codex-stream.mjs";

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
  assert.equal(evs[0].id, "item_1");
  assert.equal(evs[0].family, "command");
  assert.equal(evs[0].detail, "bash -lc 'node reserve-report-num.mjs'");
});

test("shell wrappers expose the inner executable for orb selection", () => {
  const evs = parseCodexLine(
    JSON.stringify({
      type: "item.started",
      item: { id: "item_wrapped", type: "command_execution", command: "/bin/zsh -lc 'rg -n progressText web/src'" },
    }),
  );
  assert.equal(evs[0].name, "rg");
  assert.equal(evs[0].family, "command");
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

test("Codex commentary becomes a reasoning summary and final answers remain visible", () => {
  const commentary = parseCodexLine(
    JSON.stringify({
      type: "item.completed",
      item: { id: "reason_1", type: "agent_message", phase: "commentary", text: "I’ll inspect the page now." },
    }),
  );
  assert.deepEqual(commentary, [
    { type: "reasoning", id: "reason_1", text: "I’ll inspect the page now." },
  ]);

  const final = parseCodexLine(
    JSON.stringify({
      type: "item.updated",
      item: { type: "agent_message", phase: "final_answer", text: "The application is ready for review." },
    }),
  );
  assert.deepEqual(final, [
    { type: "text", text: "The application is ready for review.", phase: "final_answer" },
  ]);
});

test("file_change item.completed → Edit tool", () => {
  const evs = parseCodexLine(
    JSON.stringify({
      type: "item.completed",
      item: { id: "item_2", type: "file_change", changes: [] },
    }),
  );
  assert.deepEqual(evs, [{ type: "tool", id: "item_2", name: "Edit", family: "file_change" }]);
});

test("reasoning items expose summaries but never raw reasoning", () => {
  const evs = parseCodexLine(
    JSON.stringify({
      type: "item.updated",
      item: {
        id: "reason_2",
        type: "reasoning",
        summary: [{ type: "summary_text", text: "Checked the profile and application tracker." }],
        raw_content: "private chain of thought",
      },
    }),
  );
  assert.deepEqual(evs, [
    { type: "reasoning", id: "reason_2", text: "Checked the profile and application tracker." },
  ]);
  assert.equal(JSON.stringify(evs).includes("private chain"), false);
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

test("Codex stderr hides recoverable diagnostics but keeps actionable failures", () => {
  assert.equal(codexStderrSummary("WARN failed to warm featured plugin ids cache\nERROR failed to refresh models cache"), "");
  assert.equal(
    codexStderrSummary("warning\nerror: unexpected argument '-a' found\nUsage: codex exec"),
    "error: unexpected argument '-a' found",
  );
  assert.equal(codexStderrSummary("Authentication required: run codex login"), "Authentication required: run codex login");
});

test("legacy Codex diagnostics are removed without touching real assistant text", () => {
  const mixed = [
    "[Codex] 2026-08-10T03:35:38Z ERROR failed to load models cache",
    "The application is ready for review.",
    "[Codex] WARN stream disconnected - retrying",
    "You make the final submission.",
  ].join("\n");
  assert.equal(
    stripLegacyCodexDiagnostics(mixed),
    "The application is ready for review.\nYou make the final submission.",
  );
  assert.equal(stripLegacyCodexDiagnostics("Normal final answer."), "Normal final answer.");
});
