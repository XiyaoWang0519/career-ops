import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { parseRunCost } from "@/lib/run-cost.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PersistedJob = {
  id: string;
  title: string;
  subtitle?: string;
  kind?: string;
  page?: string;
  input?: string;
  status: "done";
  steps: { kind: "tool" | "status"; label: string; ts: number }[];
  text: string;
  result?: { score: number | null; summary: string; tone: "good" | "warn" | "bad" | "muted" };
  cost?: { tokens: number; usd?: number; billing?: "plan" | "metered" | "unknown" };
  startedAt: number;
  endedAt?: number;
};

function toneFor(score: number | null): "good" | "warn" | "bad" | "muted" {
  if (score == null || Number.isNaN(score)) return "muted";
  if (score >= 4) return "good";
  if (score >= 3) return "warn";
  return "bad";
}

/** Parse a markdown log written by /api/runs/save back into a Job-shaped object. */
function parseRunMd(id: string, md: string, mtimeMs: number): PersistedJob {
  const title = (md.match(/^# Web run · (.+)$/m) || [])[1]?.trim() || id;
  const kind = (md.match(/^- kind:\s*(.+)$/m) || [])[1]?.trim();
  const subtitle = (md.match(/^- subtitle:\s*(.+)$/m) || [])[1]?.trim();
  const page = (md.match(/^- page:\s*(.+)$/m) || [])[1]?.trim();
  const input = (md.match(/^- input:\s*(.+)$/m) || [])[1]?.trim();
  const verdictRaw = (md.match(/^- verdict:\s*(.+)$/m) || [])[1]?.trim() || "";
  const vm = verdictRaw.match(/^([\d.]+)\s*\/\s*5\s*[—:-]+\s*(.*)$/);
  const score = vm ? parseFloat(vm[1]) : null;
  const summary = vm ? (vm[2] || "").trim() : verdictRaw === "—" ? "" : verdictRaw;

  const stepsBlock = (md.split("## Steps\n")[1] || "").split("\n## ")[0] || "";
  const steps = stepsBlock
    .split("\n")
    .map((l) => l.replace(/^- /, "").trim())
    .filter(Boolean)
    .map((label) => {
      if (label.startsWith("🔧 ")) return { kind: "tool" as const, label: label.slice(2).trim(), ts: mtimeMs };
      return { kind: "status" as const, label, ts: mtimeMs };
    });

  const output = (md.split("## Output\n")[1] || "").trim();

  return {
    id,
    title,
    kind: kind && kind !== "-" ? kind : undefined,
    subtitle: subtitle && subtitle !== "-" ? subtitle : undefined,
    page: page && page !== "-" ? page : undefined,
    input: input && input !== "-" ? input : undefined,
    status: "done",
    steps,
    text: output.slice(-8000),
    result: score != null || summary ? { score, summary, tone: toneFor(score) } : undefined,
    cost: parseRunCost(md),
    startedAt: mtimeMs,
    endedAt: mtimeMs,
  };
}

/** List persisted worker logs from `.career-ops-web/runs/` (survives reloads). */
export async function GET() {
  const dir = path.join(careerOpsRoot(), ".career-ops-web", "runs");
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch {
    return NextResponse.json({ runs: [] });
  }

  const runs: PersistedJob[] = [];
  for (const f of files) {
    try {
      const full = path.join(dir, f);
      const st = fs.statSync(full);
      const md = fs.readFileSync(full, "utf8");
      const idFromFile = f.replace(/\.md$/, "");
      const idFromBody = (md.match(/^- id:\s*(.+)$/m) || [])[1]?.trim();
      runs.push(parseRunMd(idFromBody || idFromFile, md, st.mtimeMs));
    } catch {
      /* skip bad file */
    }
  }
  runs.sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
  return NextResponse.json({ runs: runs.slice(0, 40) });
}
