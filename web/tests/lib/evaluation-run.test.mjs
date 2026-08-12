import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  TRACKER_HEADER,
  classifyEvaluationPersistence,
  ensureEvaluationTracker,
  evaluationTimeoutMs,
  findPersistedEvaluation,
  shouldRetireEvaluatedInboxItem,
  snapshotReportNames,
} from "../../src/lib/evaluation-run.mjs";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "career-ops-evaluation-run-"));
}

test("tracker preflight creates the canonical file once without overwriting it", () => {
  const root = tempRoot();
  try {
    const first = ensureEvaluationTracker(root);
    assert.equal(first.path, path.join(root, "data", "applications.md"));
    assert.equal(first.created, true);
    assert.equal(fs.readFileSync(first.path, "utf8"), TRACKER_HEADER);

    fs.appendFileSync(first.path, "| 1 | preserved |\n");
    const second = ensureEvaluationTracker(root);
    assert.equal(second.created, false);
    assert.match(fs.readFileSync(first.path, "utf8"), /preserved/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("tracker preflight preserves a legacy root tracker", () => {
  const root = tempRoot();
  try {
    const legacy = path.join(root, "applications.md");
    fs.writeFileSync(legacy, "legacy tracker\n");
    const result = ensureEvaluationTracker(root);
    assert.equal(result.path, legacy);
    assert.equal(result.created, false);
    assert.equal(fs.existsSync(path.join(root, "data", "applications.md")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("evaluation workers get enough time to finish persistence", () => {
  assert.equal(evaluationTimeoutMs("evaluate"), 720_000);
  assert.equal(evaluationTimeoutMs("pdf"), 600_000);
  assert.equal(evaluationTimeoutMs("research"), 285_000);
});

test("persisted evaluation must be new, URL-matched, and tracker-recorded", () => {
  const root = tempRoot();
  try {
    const reports = path.join(root, "reports");
    fs.mkdirSync(reports, { recursive: true });
    ensureEvaluationTracker(root);
    fs.writeFileSync(path.join(reports, "001-old.md"), "**URL:** https://example.com/old\n**Score:** 1.0/5\n");
    const before = snapshotReportNames(reports);

    fs.writeFileSync(path.join(reports, "002-other.md"), "**URL:** https://example.com/other\n**Score:** 2.0/5\n");
    const reportName = "003-target.md";
    fs.writeFileSync(path.join(reports, reportName), "**URL:** https://example.com/job/\n**Score:** 4.2/5\n");
    fs.appendFileSync(path.join(root, "data", "applications.md"), `| 3 | [003](../reports/${reportName}) |\n`);

    assert.deepEqual(
      findPersistedEvaluation({ root, reportsBefore: before, input: "https://example.com/job" }),
      { reportFile: reportName, score: 4.2, trackerRecorded: true },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a saved report without its tracker row is not a completed evaluation", () => {
  const root = tempRoot();
  try {
    const reports = path.join(root, "reports");
    fs.mkdirSync(reports, { recursive: true });
    ensureEvaluationTracker(root);
    const before = snapshotReportNames(reports);
    fs.writeFileSync(path.join(reports, "004-orphan.md"), "**URL:** https://example.com/orphan\n**Score:** 3.1/5\n");

    assert.deepEqual(
      findPersistedEvaluation({ root, reportsBefore: before, input: "https://example.com/orphan" }),
      { reportFile: "004-orphan.md", score: 3.1, trackerRecorded: false },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a post-save timeout is recovered from verified canonical artifacts", () => {
  assert.deepEqual(
    classifyEvaluationPersistence({
      persisted: { reportFile: "007-viggle.md", score: 4.1, trackerRecorded: true },
      cleanExit: false,
      sawError: false,
      baseError: "The AI tool exited with an error",
      runError: null,
    }),
    { status: "recovered" },
  );
});

test("a report without a tracker row still fails closed", () => {
  assert.deepEqual(
    classifyEvaluationPersistence({
      persisted: { reportFile: "007-viggle.md", score: 4.1, trackerRecorded: false },
      cleanExit: true,
      sawError: false,
      baseError: null,
      runError: null,
    }),
    { status: "error", message: "The report was saved, but its tracker row is missing. Re-run the evaluation to repair the tracker." },
  );
});

test("an actionable tool error is preserved when no report was written", () => {
  assert.deepEqual(
    classifyEvaluationPersistence({
      persisted: { reportFile: null, score: null, trackerRecorded: false },
      cleanExit: false,
      sawError: true,
      baseError: "Authentication required: run codex login",
      runError: "Authentication required: run codex login",
    }),
    { status: "error", message: "Authentication required: run codex login" },
  );
});

test("only verified evaluations retire their inbox item", () => {
  assert.equal(shouldRetireEvaluatedInboxItem({ status: "complete" }), true);
  assert.equal(shouldRetireEvaluatedInboxItem({ status: "recovered" }), true);
  assert.equal(shouldRetireEvaluatedInboxItem({ status: "error" }), false);
  assert.equal(shouldRetireEvaluatedInboxItem(null), false);
});
