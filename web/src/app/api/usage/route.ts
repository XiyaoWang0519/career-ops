import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pinnedDefaultCli } from "@/lib/clis";
import { CodexUsageError, fetchCodexUsage } from "@/lib/codex-usage-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Usage for the sidebar meter.
// - claude: sums tokens from ~/.claude/projects/**/*.jsonl in rolling 5h / 7d
//   windows (same scope as Claude Code's local rate-limit view). Soft budgets
//   live on the client.
// - codex: reads the signed-in ChatGPT plan limits from
//   chatgpt.com/backend-api/wham/usage using ~/.codex/auth.json (same source
//   Codex CLI /status uses).

type ClaudeUsage = {
  source: "claude";
  window5h: { tokens: number; messages: number };
  window7d: { tokens: number; messages: number };
  computedAt: number;
};

type CodexWindow = {
  label: string;
  usedPercent: number;
  resetsAt: number | null;
  resetAfterSeconds: number | null;
};

type CodexUsage = {
  source: "codex";
  planType: string | null;
  windows: CodexWindow[];
  computedAt: number;
};

type UsageError = { source: string; error: string; computedAt: number };

type CacheEntry = { at: number; data: ClaudeUsage | CodexUsage | UsageError };
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 60_000;

function projectsDir(): string {
  return path.join(os.homedir(), ".claude", "projects");
}

function* walkJsonl(dir: string): Generator<string> {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walkJsonl(p);
    else if (e.isFile() && e.name.endsWith(".jsonl")) yield p;
  }
}

function computeClaude(): ClaudeUsage {
  const now = Date.now();
  const w5 = now - 5 * 3600 * 1000;
  const w7 = now - 7 * 24 * 3600 * 1000;
  const cutoffMtime = w7 - 3600 * 1000;
  let t5 = 0;
  let t7 = 0;
  let m5 = 0;
  let m7 = 0;

  for (const file of walkJsonl(projectsDir())) {
    let st: fs.Stats;
    try {
      st = fs.statSync(file);
    } catch {
      continue;
    }
    if (st.mtimeMs < cutoffMtime) continue;
    let content: string;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of content.split("\n")) {
      if (!line.includes('"usage"')) continue;
      let d: { message?: { usage?: Record<string, number> }; timestamp?: string };
      try {
        d = JSON.parse(line);
      } catch {
        continue;
      }
      const u = d.message?.usage;
      const ts = d.timestamp ? Date.parse(d.timestamp) : NaN;
      if (!u || Number.isNaN(ts) || ts < w7) continue;
      const tok = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0);
      t7 += tok;
      m7 += 1;
      if (ts >= w5) {
        t5 += tok;
        m5 += 1;
      }
    }
  }
  return {
    source: "claude",
    window5h: { tokens: t5, messages: m5 },
    window7d: { tokens: t7, messages: m7 },
    computedAt: now,
  };
}

function resolveCli(req: NextRequest): string {
  const q = (req.nextUrl.searchParams.get("cli") || "").trim().toLowerCase();
  if (q === "claude" || q === "codex") return q;
  const pinned = pinnedDefaultCli();
  if (pinned === "claude" || pinned === "codex") return pinned;
  return "claude";
}

export async function GET(req: NextRequest) {
  const cli = resolveCli(req);
  const hit = cache.get(cli);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json(hit.data);

  if (cli === "codex") {
    try {
      const data = await fetchCodexUsage();
      cache.set(cli, { at: Date.now(), data });
      return NextResponse.json(data);
    } catch (err) {
      const message =
        err instanceof CodexUsageError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to read Codex usage.";
      const data: UsageError = { source: "codex", error: message, computedAt: Date.now() };
      // Don't cache auth/config errors for long — allow quick recovery after login.
      cache.set(cli, { at: Date.now() - CACHE_MS + 10_000, data });
      return NextResponse.json(data, { status: 200 });
    }
  }

  const data = computeClaude();
  cache.set(cli, { at: Date.now(), data });
  return NextResponse.json(data);
}
