"use client";

import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { cn } from "@/lib/cn";
import { resolveClientCliId } from "@/lib/client-cli";
import { useRuntime } from "@/components/runtime-provider";

type ClaudeUsage = {
  source?: "claude";
  window5h: { tokens: number };
  window7d: { tokens: number };
};

type CodexWindow = {
  label: string;
  usedPercent: number;
  resetsAt?: number | null;
  resetAfterSeconds?: number | null;
};

type CodexUsage = {
  source: "codex";
  planType?: string | null;
  windows: CodexWindow[];
  error?: string;
};

type UsagePayload = ClaudeUsage | CodexUsage | { source?: string; error?: string };

// Soft budgets for Claude local-log totals (tunable via localStorage
// `career-ops:usage-budget`). Codex uses real plan used% from the API.
const DEFAULT_BUDGET = { w5: 140_000_000, w7: 1_000_000_000 };

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${n}`;
}

function tone(pct: number): string {
  if (pct >= 85) return "bg-red-400";
  if (pct >= 60) return "bg-amber-400";
  return "bg-emerald-400";
}

function fmtReset(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "";
  if (seconds < 60) return "resets <1m";
  if (seconds < 3600) return `resets ${Math.round(seconds / 60)}m`;
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return m ? `resets ${h}h ${m}m` : `resets ${h}h`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.round((seconds % 86400) / 3600);
  return h ? `resets ${d}d ${h}h` : `resets ${d}d`;
}

type Row = { label: string; pct: number; detail: string; title: string };

function claudeRows(data: ClaudeUsage, budget: { w5: number; w7: number }): Row[] {
  return [
    { label: "5h", tokens: data.window5h?.tokens ?? 0, budget: budget.w5 },
    { label: "7d", tokens: data.window7d?.tokens ?? 0, budget: budget.w7 },
  ].map((r) => {
    const pct = Math.min(100, Math.round((r.tokens / r.budget) * 100));
    return {
      label: r.label,
      pct,
      detail: `${fmt(r.tokens)} · ${pct}%`,
      title: `${r.tokens.toLocaleString()} tokens in the last ${r.label}`,
    };
  });
}

function codexRows(data: CodexUsage): Row[] {
  return (data.windows || []).map((w) => {
    const pct = Math.min(100, Math.max(0, Math.round(w.usedPercent)));
    const reset = fmtReset(w.resetAfterSeconds);
    return {
      label: w.label,
      pct,
      detail: reset ? `${pct}% · ${reset}` : `${pct}%`,
      title: w.resetsAt
        ? `${pct}% used · resets ${new Date(w.resetsAt * 1000).toLocaleString()}`
        : `${pct}% used`,
    };
  });
}

export function UsageMeter() {
  const runtime = useRuntime();
  const [data, setData] = useState<UsagePayload | null>(null);
  const [cli, setCli] = useState<string | null>(null);
  const [budget, setBudget] = useState(DEFAULT_BUDGET);

  useEffect(() => {
    try {
      const b = localStorage.getItem("career-ops:usage-budget");
      if (b) setBudget({ ...DEFAULT_BUDGET, ...JSON.parse(b) });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!runtime.loaded) return;
    setCli(resolveClientCliId(runtime.defaultCli));
  }, [runtime.loaded, runtime.defaultCli]);

  useEffect(() => {
    if (!runtime.loaded) return;
    const active = resolveClientCliId(runtime.defaultCli);
    // Only Claude + Codex have a usage source today.
    if (active && active !== "claude" && active !== "codex") {
      setData(null);
      return;
    }
    let alive = true;
    const load = () => {
      const q = active ? `?cli=${encodeURIComponent(active)}` : "";
      fetch(`/api/usage${q}`)
        .then((r) => r.json())
        .then((d) => {
          if (alive) setData(d);
        })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [runtime.loaded, runtime.defaultCli]);

  if (!runtime.loaded) return null;
  if (cli && cli !== "claude" && cli !== "codex") return null;
  if (!data) return null;

  if ("error" in data && data.error) {
    return (
      <div className="border-t border-border pt-3">
        <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
          <Gauge className="size-3" /> Usage
        </div>
        <p className="px-1 text-[10px] leading-snug text-faint" title={data.error}>
          {data.error}
        </p>
      </div>
    );
  }

  const isCodex = data.source === "codex" || cli === "codex";
  const rows = isCodex
    ? codexRows(data as CodexUsage)
    : claudeRows(data as ClaudeUsage, budget);

  if (!rows.length) return null;

  return (
    <div className="border-t border-border pt-3">
      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
        <Gauge className="size-3" /> Usage
        {isCodex && (data as CodexUsage).planType ? (
          <span className="font-medium normal-case tracking-normal text-faint/80">
            · {(data as CodexUsage).planType}
          </span>
        ) : null}
      </div>
      <div className="space-y-2 px-1">
        {rows.map((r) => (
          <div key={r.label} title={r.title}>
            <div className="flex items-center justify-between text-[10px] text-faint">
              <span>{r.label}</span>
              <span className="tabular-nums">{r.detail}</span>
            </div>
            <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-surface-hover">
              <div
                className={cn("h-full rounded-full transition-all", tone(r.pct))}
                style={{ width: `${Math.max(r.pct, 2)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
