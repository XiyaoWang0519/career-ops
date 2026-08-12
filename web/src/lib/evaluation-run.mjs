import fs from "node:fs";
import path from "node:path";

export const TRACKER_HEADER = `# Applications Tracker

| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|------|---------|------|-------|--------|-----|--------|-------|
`;

/**
 * Ensure every concurrently launched evaluator resolves the same tracker path.
 *
 * merge-tracker.mjs supports both a legacy root applications.md and the current
 * data/applications.md layout. Its path is selected when each worker process
 * starts, so a missing tracker can make simultaneous workers choose different
 * files. Create the canonical data tracker once, before spawning any worker.
 * `wx` makes the create race safe without ever overwriting an existing tracker.
 */
export function ensureEvaluationTracker(root) {
  const dataTracker = path.join(root, "data", "applications.md");
  const legacyTracker = path.join(root, "applications.md");
  if (fs.existsSync(dataTracker)) return { path: dataTracker, created: false };
  if (fs.existsSync(legacyTracker)) return { path: legacyTracker, created: false };

  fs.mkdirSync(path.dirname(dataTracker), { recursive: true });
  try {
    fs.writeFileSync(dataTracker, TRACKER_HEADER, { encoding: "utf8", flag: "wx" });
    return { path: dataTracker, created: true };
  } catch (error) {
    if (error && typeof error === "object" && error.code === "EEXIST") {
      return { path: dataTracker, created: false };
    }
    throw error;
  }
}

export function evaluationTimeoutMs(kind) {
  if (kind === "pdf") return 600_000;
  if (kind === "evaluate") return 720_000;
  return 285_000;
}

export function snapshotReportNames(reportsDir) {
  try {
    return new Set(fs.readdirSync(reportsDir).filter((name) => name.endsWith(".md")));
  } catch {
    return new Set();
  }
}

function canonicalUrl(value) {
  try {
    const parsed = new URL(String(value).trim());
    parsed.hash = "";
    if (parsed.pathname !== "/") parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return parsed.toString();
  } catch {
    return String(value).trim().replace(/\/+$/, "");
  }
}

/**
 * Find the report created by this run, not merely any report another parallel
 * worker happened to create. Then verify that exact report is referenced by a
 * tracker row. This is the artifact-level success signal used when a worker is
 * terminated just after persistence but before its final prose message.
 */
export function findPersistedEvaluation({ root, reportsBefore, input }) {
  const reportsDir = path.join(root, "reports");
  const wantedUrl = canonicalUrl(input);
  let names = [];
  try {
    names = fs.readdirSync(reportsDir)
      .filter((name) => name.endsWith(".md") && !name.endsWith("-RESERVED.md") && !reportsBefore.has(name))
      .sort((a, b) => {
        const aTime = fs.statSync(path.join(reportsDir, a)).mtimeMs;
        const bTime = fs.statSync(path.join(reportsDir, b)).mtimeMs;
        return bTime - aTime;
      });
  } catch {
    return { reportFile: null, score: null, trackerRecorded: false };
  }

  for (const name of names) {
    let report = "";
    try {
      report = fs.readFileSync(path.join(reportsDir, name), "utf8");
    } catch {
      continue;
    }
    const reportUrl = report.match(/^\*\*URL:\*\*\s*(\S+)/m)?.[1];
    if (!reportUrl || canonicalUrl(reportUrl) !== wantedUrl) continue;

    const rawScore = report.match(/^\*\*Score:\*\*\s*([0-5](?:\.\d+)?)\s*\/\s*5/m)?.[1];
    const score = rawScore === undefined ? null : Number(rawScore);
    const trackerRecorded = [path.join(root, "data", "applications.md"), path.join(root, "applications.md")]
      .some((trackerPath) => {
        try {
          return fs.readFileSync(trackerPath, "utf8").includes(name);
        } catch {
          return false;
        }
      });
    return { reportFile: name, score: Number.isFinite(score) ? score : null, trackerRecorded };
  }

  return { reportFile: null, score: null, trackerRecorded: false };
}

export function classifyEvaluationPersistence({ persisted, cleanExit, sawError, baseError, runError }) {
  if (persisted.reportFile === null) {
    return {
      status: "error",
      message: baseError ?? runError ?? "This evaluation didn't save a report, so it's not in your tracker. Re-run it (Codex and Claude Code both persist reports when signed in).",
    };
  }
  if (!persisted.trackerRecorded) {
    return { status: "error", message: "The report was saved, but its tracker row is missing. Re-run the evaluation to repair the tracker." };
  }
  if (!cleanExit || sawError || baseError) return { status: "recovered" };
  return { status: "complete" };
}

/** A verified evaluation has completed the inbox's review step. Recovered
 * runs count because their report and tracker row were both verified; failed
 * or incomplete runs stay pending so the user can retry them. */
export function shouldRetireEvaluatedInboxItem(evaluationResult) {
  return evaluationResult?.status === "complete" || evaluationResult?.status === "recovered";
}
