import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { resolveCliOrDefault } from "@/lib/clis";
import { careerOpsRoot, readMemory, findReportFile } from "@/lib/career-ops";
import { resolvePdfPaths, type PdfPaths } from "@/lib/pdf-paths.mjs";
import { renderAndMarkPdf } from "@/lib/pdf-render.mjs";
import { acquireTrackerWrite, releaseTrackerWrite } from "@/lib/core/run-registry";
import {
  attachRunKiller,
  createActiveRun,
  finishActiveRun,
  pushRunEvent,
  subscribeActiveRun,
} from "@/lib/core/active-runs";
import { codexStderrSummary, parseCodexLine } from "@/lib/codex-stream.mjs";
import { codexBillingMode } from "@/lib/codex-billing.mjs";
import {
  classifyEvaluationPersistence,
  ensureEvaluationTracker,
  evaluationTimeoutMs,
  findPersistedEvaluation,
  shouldRetireEvaluatedInboxItem,
  snapshotReportNames,
} from "@/lib/evaluation-run.mjs";
import { setPipelineReviewed } from "@/lib/triage-state";
import {
  artifactsForCvPdf,
  artifactsForEvaluation,
  artifactsForKind,
  companyLabelFromSlug,
  parseReportFilename,
} from "@/lib/job-artifacts.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800; // a real oferta evaluation / pdf-mode CV tailoring + render is heavy and multi-step

function claudeToolFamily(name: string): "web_search" | "file_change" | "command" | "mcp" | "plan" {
  if (/web(search|fetch)|search_web/i.test(name)) return "web_search";
  if (/^(edit|write|notebookedit|multiedit)$/i.test(name)) return "file_change";
  if (/^(bash|shell)$/i.test(name)) return "command";
  if (/^(todowrite|plan)$/i.test(name)) return "plan";
  if (/^(read|grep|glob)$/i.test(name)) return "command";
  return "mcp";
}

function claudeToolDetail(name: string, input: Record<string, unknown>): string | undefined {
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = input[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };
  const lowered = name.toLowerCase();
  let detail = "";
  if (/websearch|search_web/i.test(lowered)) detail = pick("query", "q", "search");
  else if (/webfetch/i.test(lowered)) detail = pick("url", "href");
  else if (/^(read|edit|write|notebookedit)$/i.test(lowered)) detail = pick("file_path", "path", "filename");
  else if (/^grep$/i.test(lowered)) detail = [pick("pattern"), pick("path", "glob")].filter(Boolean).join(" in ");
  else if (/^glob$/i.test(lowered)) detail = pick("pattern", "glob", "path");
  else if (/^(bash|shell)$/i.test(lowered)) detail = pick("command", "cmd");
  else detail = pick("query", "path", "file_path", "command", "url");
  const compact = detail.replace(/\s+/g, " ").trim();
  if (!compact) return undefined;
  return compact.length > 180 ? `${compact.slice(0, 177)}…` : compact;
}

// The web ORCHESTRATES the real career-ops engine — it does NOT reimplement it.
// kind "evaluate" runs the REAL modes/oferta.md and persists the canonical
// artifacts (A–F report + tracker row) via the SAME scripts the CLI uses
// (reserve-report-num.mjs → reports/ → batch/tracker-additions/ → merge-tracker.mjs),
// so a web evaluation is byte-identical to a CLI one (single source of truth, no
// drift). kind "research" stays read-only. Streams progress as NDJSON events.
type BuildPromptArgs = { kind: string; input: string; memory: string; today: string; pdfPaths?: PdfPaths };

function buildPrompt({ kind, input, memory, today, pdfPaths }: BuildPromptArgs): string {
  const mem = memory.trim() ? `\n\nDurable notes about the user (from their profile):\n${memory.trim()}\n` : "";
  if (kind === "research") {
    return `You are investigating the user's OWN work / portfolio to surface job-search-relevant strengths, headless. Investigate the target (use WebFetch for URLs; read local files if referenced) and report: what it is, why it is impressive, and how to leverage it in their job search — which roles/claims it supports and how to frame it on a CV. Be specific, honest, and encouraging.${mem}

End with EXACTLY one final line: VERDICT: {0-5 signal strength}/5 — {why it helps their search, ≤12 words}

Target: ${input}`;
  }
  if (kind === "pdf") {
    // The agent tailors content only — it never renders the PDF itself. Rendering
    // launches a real browser, which an agent CLI's own sandbox may block with no
    // human present to approve an escalation (headless/web-triggered run, #2172).
    // The backend (a plain Node process, no CLI sandbox) renders after this closes.
    return `You are tailoring the user's ATS-optimized CV for application #${input}, headless, on their machine. Run the REAL career-ops "pdf" mode's CONTENT step — follow modes/pdf.md EXACTLY for tailoring (do not improvise a format).
1. Read modes/pdf.md, cv.md, config/profile.yml, and the evaluation report at reports/${input}-*.md (for the JD keywords + analysis).
2. Tailor the CV per modes/pdf.md: inject the JD's keywords into the summary + first bullets, reorder experience by relevance, build the competency grid, pick the top 3–4 projects. NEVER invent skills — only reword REAL experience using the JD's vocabulary.
3. Fill templates/cv-template.html's {{...}} placeholders with the tailored content; write the HTML to EXACTLY this path: ${pdfPaths?.html}
4. Decide the page format for this company (letter for US/Canada, else a4) and write EXACTLY this JSON (nothing else) to EXACTLY this path: ${pdfPaths?.meta}
   {"format": "letter"} or {"format": "a4"}
Do NOT run generate-pdf.mjs yourself and do NOT render a PDF — the platform renders it after you finish, from the HTML and format file you wrote. Do NOT touch data/applications.md — the platform updates the tracker's PDF column itself, only after a confirmed successful render. Do not submit anything anywhere.

End with EXACTLY one final line: VERDICT: {5 if the HTML and format file were written, else 1}/5 — {a one-line summary, ≤12 words}`;
  }
  if (kind === "fix-portal") {
    return `A company's job-portal ATS slug is BROKEN — career-ops can no longer scan it, so it silently disappears from every future scan. Repair it (headless, on the user's machine):
1. Run \`node verify-portals.mjs --add "${input}"\` — it probes Greenhouse/Ashby/Lever for the company's correct ATS slug and prints the suggested ats + slug.
2. Open portals.yml, find the "${input}" entry under tracked_companies, and update its careers_url (and any api/slug field) to the suggested WORKING ATS URL. Change ONLY this one company; preserve all other YAML structure, comments and formatting exactly.
3. Re-run \`node verify-portals.mjs\` and confirm "${input}" now shows ✅ live (not ❌).
If NO slug variant resolves, say so clearly and leave portals.yml unchanged. Never touch any other company.

End with EXACTLY one final line: VERDICT: {5 if now live, else 1}/5 — {what you changed, ≤12 words}`;
  }
  // evaluate (default) — run the REAL oferta mode + persist canonically
  return `You are running the OFFICIAL career-ops job evaluation, HEADLESS, on the user's own machine. Today is ${today}. Run the REAL career-ops evaluation — do NOT improvise your own scoring.

1. Read modes/oferta.md and follow it EXACTLY (blocks A–F, G posting-legitimacy, and the Machine Summary). Ground the fit in THIS person: read cv.md, config/profile.yml and modes/_profile.md. Use WebFetch to read the posting (you are headless — Playwright is unavailable, so use WebFetch and mark the report header "Verification: unconfirmed (batch mode)").

2. Persist the result CANONICALLY so the web and the CLI share ONE source of truth:
   a. Reserve a report number: run \`node reserve-report-num.mjs\` — its stdout is a 3-digit number (e.g. 035).
   b. Write the full report to reports/{num}-{company-slug}-${today}.md  (company-slug = company lowercased, non-alphanumerics → hyphens).
   c. Append ONE row of 9 TAB-separated columns to batch/tracker-additions/{num}-{company-slug}.tsv, in THIS exact order (real \\t tabs, status BEFORE score):
      {num}\t${today}\t{Company}\t{Role}\t{CanonicalStatus e.g. Evaluated}\t{score}/5\t❌\t[{num}](reports/{num}-{company-slug}-${today}.md)\t{one-line note}
   d. Merge into the tracker: run \`node merge-tracker.mjs\` (it dedupes by company+role+report-num, validates the status, and writes data/applications.md — NEVER edit applications.md by hand).

3. NEVER submit an application, fill no forms, contact no one. This is evaluation + persistence ONLY.${mem}

After everything above is written and merged, output EXACTLY one final line, nothing after it:
VERDICT: {score}/5 — {reason in 12 words or fewer}

Posting URL: ${input}`;
}

export async function POST(req: Request) {
  let body: {
    kind?: string;
    input?: string;
    cliId?: string;
    id?: string;
    title?: string;
    subtitle?: string;
    page?: string;
    batchId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "bad json" }), { status: 400 });
  }
  const { kind = "evaluate", input, cliId, title, subtitle, page, batchId } = body;
  if (!input) {
    return new Response(JSON.stringify({ error: "input required" }), { status: 400 });
  }
  const runId =
    typeof body.id === "string" && body.id.trim()
      ? body.id.trim().slice(0, 120)
      : `job-${Date.now()}-srv`;
  const resolved = resolveCliOrDefault(cliId);
  if (!resolved) {
    return new Response(JSON.stringify({ error: cliId ? `CLI '${cliId}' not found` : "No AI tool configured — set one in Config, or CAREER_OPS_DEFAULT_CLI on the server." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { spec, binPath, id: resolvedCliId } = resolved;

  // These run the REAL core (modes/scripts), not just data — fail clearly if the
  // root is incomplete instead of faking it.
  const needsScript: Record<string, string> = { evaluate: "modes/oferta.md", "fix-portal": "verify-portals.mjs", pdf: "generate-pdf.mjs" };
  const required = needsScript[kind];
  if (required && !fs.existsSync(path.join(careerOpsRoot(), required))) {
    return new Response(
      JSON.stringify({
        error: `This needs a complete career-ops checkout (${required}). CAREER_OPS_ROOT has data only — point it at a full checkout.`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // An A–F score is meaningless without a CV to score against — the CLI would
  // hallucinate a fit narrative and still emit a VERDICT. Require cv.md first.
  if ((kind === "evaluate" || kind === "pdf") && !fs.existsSync(path.join(careerOpsRoot(), "cv.md"))) {
    return new Response(
      JSON.stringify({ error: "Add your CV first so I can score this against you — drop it on the home page." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  // A fresh install may not have a tracker yet. Create it before any evaluator
  // starts so every parallel merge resolves and locks the same canonical path.
  // The exclusive create never overwrites an existing user tracker.
  if (kind === "evaluate") {
    try {
      ensureEvaluationTracker(careerOpsRoot());
    } catch (error) {
      return new Response(
        JSON.stringify({ error: `Could not initialize the application tracker: ${error instanceof Error ? error.message : String(error)}` }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // Precompute deterministic scratch + final paths so the agent never chooses
  // its own filenames — the backend owns naming and, later, rendering (#2172).
  let pdfPaths: PdfPaths | undefined;
  if (kind === "pdf") {
    const pathsResult = resolvePdfPaths(input, today, careerOpsRoot(), findReportFile);
    if (!pathsResult.ok) {
      return new Response(JSON.stringify({ error: pathsResult.error }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    pdfPaths = pathsResult.paths;
    // Clear any stale scratch artifacts left by an earlier run of this same
    // report before the agent starts, so their existence after this run
    // genuinely proves THIS run produced them. Without this, a re-run whose
    // agent emits some output and exits cleanly but doesn't actually
    // (re)write the HTML could pass the honesty gate on a leftover file from
    // a prior attempt and render/report stale content as if it were fresh.
    for (const p of [pdfPaths.html, pdfPaths.meta]) {
      // force:true already suppresses "doesn't exist" internally, so anything
      // reaching this catch is a real failure (permissions, etc.) — silently
      // swallowing it would defeat the invariant this whole block exists for:
      // an un-cleared stale file could then pass the later existence+non-empty
      // check as if it were fresh.
      try {
        fs.rmSync(p, { force: true });
      } catch (err) {
        console.warn(`Failed to clear stale PDF scratch artifact ${p}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  const prompt = buildPrompt({ kind, input, memory: readMemory(), today, pdfPaths });

  const isClaude = resolvedCliId === "claude";
  const isCodex = resolvedCliId === "codex";
  const billing = isCodex ? codexBillingMode() : undefined;
  // Tool scope by kind (comma-separated lists; disallowedTools is the hard
  // guardrail). 'evaluate'/'fix-portal' run the REAL mode + persist canonical
  // artifacts → they need Write + Bash (reserve-report-num / merge-tracker /
  // verify-portals). 'pdf' only tailors content and writes the HTML + format
  // sidecar (Write, no Bash — deliberately: the backend renders the PDF itself
  // afterward via renderAndMarkPdf, see pdf-render.mjs; granting Bash here would
  // let the agent improvise its own render/fallback exactly like the #2172
  // incident this fix closes). 'research' stays fully read-only. Task
  // (sub-agents) is always blocked (runaway cost). NEVER auto-submits — that is
  // a prompt-level guarantee.
  const tools =
    kind === "evaluate" || kind === "fix-portal"
      ? { allowed: "Read,WebFetch,WebSearch,Write,Edit,Bash,Glob,Grep", disallowed: "Task,NotebookEdit" }
      : kind === "pdf"
        ? { allowed: "Read,WebFetch,WebSearch,Write,Edit,Glob,Grep", disallowed: "Bash,Task,NotebookEdit" }
        : { allowed: "Read,WebFetch,WebSearch,Glob,Grep", disallowed: "Bash,Write,Edit,NotebookEdit,Task" };
  const args = isClaude
    ? ["-p", prompt, "--output-format", "stream-json", "--verbose", "--include-partial-messages",
       "--permission-mode", "acceptEdits",
       "--allowedTools", tools.allowed,
       "--disallowedTools", tools.disallowed]
    : spec.args(prompt, kind);

  // For write-needing kinds, snapshot reports/ so we can verify the worker
  // actually persisted (non-Claude CLIs lack Write auth and silently no-op).
  const reportsDir = path.join(careerOpsRoot(), "reports");
  const persists = kind === "evaluate";
  const reportsBefore = persists ? snapshotReportNames(reportsDir) : new Set<string>();
  // Tracker-mutating runs hold a write token so a row delete can't race their merge
  // (tracker.mjs delete doesn't yet share a lock with merge-tracker — see run-registry).
  const writeToken = kind === "evaluate" || kind === "pdf" ? acquireTrackerWrite() : null;

  try {
    createActiveRun({
      id: runId,
      kind,
      input,
      title: typeof title === "string" ? title : undefined,
      subtitle: typeof subtitle === "string" ? subtitle : undefined,
      page: typeof page === "string" ? page : undefined,
      batchId: typeof batchId === "string" ? batchId : undefined,
      startedAt: Date.now(),
    });
  } catch {
    if (writeToken !== null) releaseTrackerWrite(writeToken);
    return new Response(JSON.stringify({ error: "A worker with this id is already running" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  const child = spawn(binPath, args, { cwd: careerOpsRoot(), env: process.env, stdio: ["ignore", "pipe", "pipe"] });

  // Server-owned run: HTTP cancel only unsubscribes. `finished` gates event
  // fanout + honesty-gate re-entry; it is NOT flipped on client disconnect.
  let finished = false;
  let terminalStatus: "done" | "error" = "done";
  let killer: ReturnType<typeof setTimeout> | undefined;
  // pdf-kind's render+mark work keeps running after the agent child closes.
  // Defer write-token release until that promise settles.
  let pdfRenderPromise: Promise<void> | null = null;
  let writeTokenReleased = false;
  const releaseWriteTokenOnce = () => {
    if (writeToken !== null && !writeTokenReleased) {
      writeTokenReleased = true;
      releaseTrackerWrite(writeToken);
    }
  };
  const finalize = (status: "done" | "error") => {
    if (finished) return;
    finished = true;
    terminalStatus = status;
    if (killer) clearTimeout(killer);
    finishActiveRun(runId, status);
    if (pdfRenderPromise) {
      pdfRenderPromise.finally(releaseWriteTokenOnce);
    } else {
      releaseWriteTokenOnce();
    }
  };

  let buf = "";
  let emittedText = false; // any assistant text delta → the CLI actually ran
  let sawError = false;
  let runError: string | null = null;
  let lastTokens = 0; // per-run token cost from the Claude result event (#6) — local only
  let lastCostUsd: number | null = null;
  // Tail of assistant text for building light artifacts (research / portal)
  // without keeping the full stream on the server.
  let textTail = "";
  const noteText = (t: string) => {
    textTail = (textTail + t).slice(-4000);
  };
  // pdf-mode's agent only tailors content now (rendering moved to the
  // backend, #2172) — but its killMs still has to leave real headroom
  // inside the route's overall maxDuration (800s): the render+mark phase
  // (renderPdf, below) starts only after this timer's window and has no
  // timeout of its own, so an agent that runs close to its full budget
  // would otherwise leave the platform's hard maxDuration cutoff to kill
  // generate-pdf.mjs mid-render. 600s agent / ~200s render is ample —
  // a Chromium PDF render normally takes low tens of seconds even with a
  // cold Playwright launch.
  const killMs = evaluationTimeoutMs(kind);
  killer = setTimeout(() => {
    try { child.kill("SIGTERM"); } catch { /* ignore */ }
  }, killMs);
  const send = (obj: unknown) => {
    if (finished) return;
    pushRunEvent(runId, obj);
  };
  // Record whether the last terminal push was an error so finalize can
  // classify done vs error when the caller doesn't pass a status.
  const close = (status?: "done" | "error") => {
    finalize(status ?? terminalStatus);
  };
  const fail = (msg: string) => {
    terminalStatus = "error";
    send({ type: "error", msg });
    finalize("error");
  };

  attachRunKiller(runId, () => {
    try { child.kill("SIGTERM"); } catch { /* ignore */ }
  });

  child.stdout.on("data", (d: Buffer) => {
    if (finished) return;
    if (!isClaude && !isCodex) {
      emittedText = true;
      const t = d.toString();
      noteText(t);
      send({ type: "text", text: t });
      return;
    }
    buf += d.toString();
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      if (isCodex) {
        for (const ev of parseCodexLine(line)) {
          if (ev.type === "tool") {
            send({
              type: "tool",
              name: ev.name,
              ...(ev.family ? { family: ev.family } : {}),
              ...(ev.detail ? { detail: ev.detail } : {}),
            });
          }
          else if (ev.type === "status") send({ type: "status", label: ev.label });
          else if (ev.type === "text") {
            emittedText = true;
            noteText(ev.text);
            send({ type: "text", text: ev.text });
          } else if (ev.type === "error") {
            sawError = true;
            // Reconcile the terminal error with on-disk artifacts at close.
            // A turn can fail after its report and tracker merge completed.
            runError ??= ev.msg;
          } else if (ev.type === "tokens") {
            lastTokens = ev.tokens;
          }
        }
        continue;
      }
      try {
        const ev = JSON.parse(line);
        if (ev.type === "stream_event") {
          const e = ev.event;
          if (e?.type === "content_block_start" && e.content_block?.type === "tool_use") {
            const name = String(e.content_block.name || "tool");
            const input = e.content_block.input && typeof e.content_block.input === "object"
              ? (e.content_block.input as Record<string, unknown>)
              : {};
            const detail = claudeToolDetail(name, input);
            send({
              type: "tool",
              name,
              family: claudeToolFamily(name),
              ...(detail ? { detail } : {}),
            });
          } else if (e?.type === "content_block_delta" && e.delta?.text) {
            emittedText = true;
            noteText(e.delta.text);
            send({ type: "text", text: e.delta.text });
          }
        } else if (ev.type === "system" && ev.subtype === "init") {
          send({ type: "status", label: "Agent ready" });
        } else if (ev.type === "result") {
          // Capture the per-run cost; the authoritative "done" is sent on close
          // (so the honesty gate decides done-vs-error first). Tokens = the same
          // formula /api/usage uses: input + output + cache-creation.
          const u = ev.usage || {};
          lastTokens = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0);
          if (typeof ev.total_cost_usd === "number") lastCostUsd = ev.total_cost_usd;
        }
      } catch {
        /* partial line */
      }
    }
  });
  child.stderr.on("data", (d: Buffer) => {
    const s = d.toString();
    // Codex routinely logs cache/model refresh failures to stderr and then
    // completes successfully. Use its dedicated actionable-error filter;
    // structured turn failures still arrive on stdout via parseCodexLine.
    const actionable = isCodex
      ? codexStderrSummary(s)
      : /error|denied|fatal|not found|unauthorized|forbidden|auth|login|credential|api[ -]?key|quota|rate limit|not authenticated/i.test(s)
        ? s.trim().slice(0, 200)
        : "";
    if (actionable) {
      sawError = true;
      // Do not fail the browser immediately. The child may already have
      // persisted a complete evaluation; the close-time honesty gate
      // reconciles stderr, exit status, report, and tracker atomically.
      runError ??= actionable;
    }
  });
  // Render + mark-tracker-ready live in pdf-render.mjs (plain, dependency-
  // injected, unit-tested) so the render-then-mark orchestration isn't
  // buried untested inside this transport-layer closure. Runs generate-
  // pdf.mjs and mark-pdf-ready.mjs as plain Node child processes — no agent
  // CLI or its sandbox involved — so a browser launch never depends on an
  // interactive approval nobody is present to grant in a headless/web-
  // triggered run (#2172). The tracker is marked ✅ only after a CONFIRMED
  // successful render, not optimistically — same honesty-gate discipline as
  // the evaluate path below.
  const renderPdf = async (paths: PdfPaths) => {
    send({ type: "status", label: "Rendering PDF…" });
    try {
      const result = await renderAndMarkPdf({
        spawnFn: spawn,
        execPath: process.execPath,
        root: careerOpsRoot(),
        pdfPaths: paths,
        reportNum: input,
      });
      if (result.kind === "render-failed") {
        fail(result.error.slice(0, 200));
        return;
      }
      // Non-fatal issues (missing format sidecar, tracker not marked) still
      // surface here rather than only in a server log nobody sees.
      for (const w of result.warnings) send({ type: "text", text: `⚠️ ${w}\n` });
      const reportFile = findReportFile(input);
      const { companySlug } = parseReportFilename(reportFile ? path.basename(reportFile) : "");
      const company = companySlug ? companyLabelFromSlug(companySlug) : "company";
      send({
        type: "done",
        tokens: lastTokens,
        costUsd: lastCostUsd,
        billing,
        artifacts: artifactsForCvPdf({ reportNum: input, company }),
      });
      close("done");
    } catch (e) {
      fail(`PDF rendering crashed unexpectedly: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200));
    }
  };

  child.on("error", (e) => { fail(e.message); });
  child.on("close", (code) => {
    if (finished) return;
    const cleanExit = code === 0; // non-zero OR null (killed/signal) = NOT clean
    // Shared by both honesty gates below: a CLI that produced no output at
    // all is the same failure mode whether it was evaluating or tailoring
    // a PDF — one place for the condition/message pair instead of two.
    const noOutputError = (): string | null => {
      if (!emittedText && runError) return runError;
      if (!emittedText && !sawError && !cleanExit) return "The AI tool exited with an error — is it installed and signed in?";
      if (!emittedText && !sawError) return "The AI tool produced no output — is it installed and signed in?";
      return null;
    };

    if (kind === "pdf") {
      // Non-empty, not just existing: paired with clearing pdfPaths.html/meta
      // before the agent started (above), this proves the file is both fresh
      // (not a leftover from an earlier run of this same report) and real
      // (not a zero-byte artifact from a half-finished write).
      const wroteHtml = pdfPaths !== undefined && fs.existsSync(pdfPaths.html) && fs.statSync(pdfPaths.html).size > 0;
      // Same honesty-gate shape as below, plus the actual bug-fix check: verify
      // a real HTML artifact exists before ever reporting success (previously
      // nothing checked this, so an agent that improvised past a failure — e.g.
      // falling back to wkhtmltopdf — could still report a fake "done").
      const baseErr = noOutputError();
      if (baseErr) {
        fail(baseErr);
      } else if (!wroteHtml || !cleanExit || sawError || !pdfPaths) {
        fail("This run didn't produce a tailored CV to render, so no PDF was generated — re-run it to verify.");
      } else {
        // close()/finalize happens once rendering finishes, not here.
        pdfRenderPromise = renderPdf(pdfPaths);
      }
      return;
    }

    const persisted = persists
      ? findPersistedEvaluation({ root: careerOpsRoot(), reportsBefore, input })
      : { reportFile: null, score: null, trackerRecorded: false };
    // Honesty gate (#9): an evaluation is complete only when this run's
    // URL-matched report and its tracker row both exist. Once persistence
    // is verified, a missing final prose line or late process error is a
    // recoverable transport failure, not a failed evaluation.
    const baseErr = noOutputError();
    const evaluationResult = persists
      ? classifyEvaluationPersistence({ persisted, cleanExit, sawError, baseError: baseErr, runError })
      : null;
    if (shouldRetireEvaluatedInboxItem(evaluationResult)) {
      setPipelineReviewed(input, true);
    }
    const lightArtifacts = () => artifactsForKind({ kind, input, text: textTail });
    if (evaluationResult?.status === "error") {
      fail(evaluationResult.message);
    } else if (evaluationResult?.status === "recovered") {
      // Persistence is the authoritative completion boundary. A worker may
      // be terminated after report+merge but before its final prose line;
      // recover the verdict from the canonical report instead of showing a
      // false failure for work that is already safely recorded.
      send({ type: "text", text: "⚠️ The worker ended after saving the evaluation; the report and tracker entry were verified.\n" });
      if (persisted.score !== null) {
        send({ type: "text", text: `VERDICT: ${persisted.score}/5 — Evaluation saved and verified\n` });
      }
      send({
        type: "done",
        tokens: lastTokens,
        costUsd: lastCostUsd,
        billing,
        artifacts: artifactsForEvaluation(persisted),
      });
      close("done");
    } else if (baseErr) {
      fail(baseErr);
    } else if (!cleanExit || sawError) {
      // Produced output (maybe even a report) but did NOT finish cleanly — flag it
      // instead of recording a confident score off a half-finished run.
      fail(runError ?? "This run hit an error before finishing, so it isn't recorded as a confident result — re-run it to verify.");
    } else if (persists) {
      send({
        type: "done",
        tokens: lastTokens,
        costUsd: lastCostUsd,
        billing,
        artifacts: artifactsForEvaluation(persisted),
      });
      close("done");
    } else {
      send({
        type: "done",
        tokens: lastTokens,
        costUsd: lastCostUsd,
        billing,
        artifacts: lightArtifacts(),
      });
      close("done");
    }
  });

  const stream = subscribeActiveRun(runId);
  if (!stream) {
    // Should be unreachable — we just created the run.
    try { child.kill("SIGTERM"); } catch { /* ignore */ }
    releaseWriteTokenOnce();
    return new Response(JSON.stringify({ error: "Failed to attach to worker stream" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-Career-Ops-Run-Id": runId,
    },
  });
}
